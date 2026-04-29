const multer   = require('multer');
const OpenAI   = require('openai');
const { processDocument } = require('../services/documentService');
const { getPresignedUrl }  = require('../utils/s3Client');
const { getPineconeIndex } = require('../utils/pineconeClient');
const Document  = require('../models/Document');
const AuditLog  = require('../models/AuditLog');
const { parseQuery }        = require('../utils/queryParser');
const { filterOptionsCache, queryCache } = require('../utils/cache');
const { normalizeDocumentFields }        = require('../utils/normalizer');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_SIZE = 50 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    ALLOWED_MIMES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only PDF, TXT, and DOCX files are supported.'));
  },
});

/* ─────────────────────────────────────────────────────────── */
/* POST /api/documents/upload-ai                               */
/* ─────────────────────────────────────────────────────────── */
const uploadAI = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const result = await processDocument({
      buffer:       req.file.buffer,
      mimetype:     req.file.mimetype,
      originalname: req.file.originalname,
    });
    /* Invalidate filter-options cache so new values appear immediately */
    filterOptionsCache.clear();
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('[DocumentController] uploadAI error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* POST /api/documents/search  — Smart hybrid search           */
/*   Body: { query, page, limit }                              */
/* ─────────────────────────────────────────────────────────── */
const hybridSearch = async (req, res) => {
  try {
    const { query = '', page = 1, limit = 20 } = req.body;

    if (!query.trim()) {
      return res.status(400).json({ success: false, message: 'Query is required.' });
    }

    /* ── Parse query into structured filters + semantic remainder ── */
    const parsed  = parseQuery(query);
    const semantic = parsed.semantic || query;

    /* ── Build MongoDB filter from parsed fields ── */
    const mongoFilter = {};
    if (parsed.sections)      mongoFilter['additional_fields.sections_involved.value'] = { $elemMatch: { $regex: parsed.sections.split(',')[0].trim(), $options: 'i' } };
    if (parsed.finalDecision) mongoFilter['additional_fields.final_decision.value']    = { $regex: parsed.finalDecision, $options: 'i' };
    if (parsed.state)         mongoFilter['structured_data.state.value']               = { $regex: parsed.state, $options: 'i' };
    if (parsed.court)         mongoFilter['structured_data.court.value']               = { $regex: parsed.court, $options: 'i' };
    if (parsed.dateFrom || parsed.dateTo) {
      const range = {};
      if (parsed.dateFrom) range.$gte = parsed.dateFrom;
      if (parsed.dateTo)   range.$lte = parsed.dateTo;
      mongoFilter['structured_data.date.value'] = range;
    }

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    /* ── Run MongoDB structured search + Pinecone semantic search in parallel ── */
    const [mongoResults, pineconeIds] = await Promise.all([
      /* MongoDB: structured filters + petitioner/key_issue text match on semantic */
      (async () => {
        const textRe = semantic ? { $regex: semantic, $options: 'i' } : null;
        const finalFilter = textRe
          ? {
              $and: [
                mongoFilter,
                {
                  $or: [
                    { 'structured_data.petitioner.value':     textRe },
                    { 'structured_data.respondent.value':     textRe },
                    { 'additional_fields.key_issue.value':    textRe },
                    { 'additional_fields.acts_involved.value': textRe },
                    { summary:                                 textRe },
                  ],
                },
              ],
            }
          : mongoFilter;
        return Document.find(finalFilter)
          .sort({ createdAt: -1 })
          .limit(limitNum * 3)
          .select('-__v -fileKey')
          .lean();
      })(),
      /* Pinecone: semantic similarity */
      (async () => {
        if (!semantic.trim()) return [];
        try {
          const embResp = await openai.embeddings.create({
            model:           'text-embedding-3-large',
            input:           semantic,
            dimensions:      1024,
            encoding_format: 'float',
          });
          const vec   = Array.from(embResp.data[0].embedding);
          const index = getPineconeIndex();
          const resp  = await index.query({
            vector:          vec,
            topK:            20,
            includeMetadata: true,
            filter:          { tag: { $eq: 'ai-upload' } },
          });
          return (resp.matches || [])
            .filter(m => m.score >= 0.1)
            .map(m => ({ id: m.id, score: m.score }));
        } catch (e) {
          console.error('[HybridSearch] Pinecone error:', e.message);
          return [];
        }
      })(),
    ]);

    /* ── Fetch Pinecone-matched docs from MongoDB ── */
    let pineconeScoreMap = new Map(pineconeIds.map(m => [m.id, m.score]));
    const pineconeUniqueIds = pineconeIds.map(m => m.id);
    const pineconeDocsRaw  = pineconeUniqueIds.length
      ? await Document.find({ uniqueId: { $in: pineconeUniqueIds } })
          .select('-__v -fileKey').lean()
      : [];

    /* ── Merge: deduplicate by _id, compute hybrid score ── */
    const merged = new Map();

    /* MongoDB results get a base match bonus */
    for (const doc of mongoResults) {
      merged.set(doc._id.toString(), {
        ...doc,
        _score:       0.5,
        _matchType:   'filter',
        _parsedQuery: parsed,
      });
    }

    /* Pinecone results override/boost score */
    for (const doc of pineconeDocsRaw) {
      const id    = doc._id.toString();
      const pScore = pineconeScoreMap.get(doc.uniqueId) || 0;
      /* Apply filter bonus if this doc also matches parsed filters */
      const filterBonus = Object.keys(mongoFilter).length > 0 && merged.has(id) ? 0.2 : 0;
      const hybrid = Math.min(1, pScore + filterBonus);

      merged.set(id, {
        ...(merged.get(id) || doc),
        _score:     hybrid,
        _matchType: merged.has(id) ? 'hybrid' : 'semantic',
        _parsedQuery: parsed,
      });
    }

    /* ── Sort by score descending, paginate ── */
    const sorted = Array.from(merged.values()).sort((a, b) => b._score - a._score);
    const total  = sorted.length;
    const slice  = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    /* ── Add match explanation to top 2 ── */
    const withExplanation = slice.map((doc, i) => {
      const explanation = buildMatchExplanation(doc, parsed, i);
      return { ...doc, _explanation: explanation };
    });

    return res.status(200).json({
      success: true,
      data:    withExplanation,
      parsed,
      pagination: {
        total,
        page:  pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[DocumentController] hybridSearch error:', err.message);
    return res.status(500).json({ success: false, message: 'Search failed.' });
  }
};

/* ── Build human-readable match explanation ── */
const buildMatchExplanation = (doc, parsed, rank) => {
  const reasons = [];
  const sd = doc.structured_data   || {};
  const af = doc.additional_fields || {};

  if (parsed.sections && af.sections_involved?.value?.length) {
    const matched = af.sections_involved.value.filter(s =>
      parsed.sections.toLowerCase().includes(s.toLowerCase().replace('section ', ''))
    );
    if (matched.length) reasons.push(`Section match: ${matched.join(', ')}`);
  }
  if (parsed.finalDecision && af.final_decision?.value?.toLowerCase().includes(parsed.finalDecision.toLowerCase())) {
    reasons.push(`Decision: ${af.final_decision.value}`);
  }
  if (parsed.state && sd.state?.value?.toLowerCase().includes(parsed.state.toLowerCase())) {
    reasons.push(`State: ${sd.state.value}`);
  }
  if (parsed.court && sd.court?.value?.toLowerCase().includes(parsed.court.toLowerCase())) {
    reasons.push(`Court: ${sd.court.value}`);
  }
  if (parsed.dateFrom || parsed.dateTo) {
    reasons.push(`Date range match`);
  }

  const matchType = doc._matchType === 'hybrid' ? 'Structural + Semantic'
    : doc._matchType === 'semantic'              ? 'Semantic similarity'
    : 'Filter match';

  return {
    matchType,
    reasons,
    isBestMatch: rank < 2,
    scorePercent: Math.round((doc._score || 0) * 100),
  };
};

/* ─────────────────────────────────────────────────────────── */
/* GET /api/documents                                          */
/* ─────────────────────────────────────────────────────────── */
const getDocuments = async (req, res) => {
  try {
    const {
      petitioner, respondent, court, state, date,
      dateFrom, dateTo,
      caseType, finalDecision, sections, judges, counsel,
      isVerified, confidence,
      page  = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    const textFilter = (mongoPath, val) => {
      if (val?.trim()) {
        filter[mongoPath] = { $regex: val.trim(), $options: 'i' };
      }
    };

    textFilter('structured_data.petitioner.value', petitioner);
    textFilter('structured_data.respondent.value',  respondent);
    textFilter('structured_data.court.value',       court);
    textFilter('structured_data.state.value',       state);
    textFilter('structured_data.judges.value',      judges);

    if (date?.trim()) {
      filter['structured_data.date.value'] = { $regex: date.trim(), $options: 'i' };
    } else if (dateFrom?.trim() || dateTo?.trim()) {
      const rangeFilter = {};
      if (dateFrom?.trim()) rangeFilter.$gte = dateFrom.trim();
      if (dateTo?.trim())   rangeFilter.$lte = dateTo.trim();
      filter['structured_data.date.value'] = rangeFilter;
    }

    if (counsel?.trim()) {
      const re = { $regex: counsel.trim(), $options: 'i' };
      filter.$or = filter.$or || [];
      filter.$or.push(
        { 'structured_data.petitioner_counsel.value': re },
        { 'structured_data.respondent_counsel.value': re }
      );
    }

    textFilter('additional_fields.case_type.value',      caseType);
    textFilter('additional_fields.final_decision.value', finalDecision);

    if (sections?.trim()) {
      filter['additional_fields.sections_involved.value'] = {
        $elemMatch: { $regex: sections.trim(), $options: 'i' },
      };
    }

    if (isVerified === 'true')  filter.isVerified = true;
    if (isVerified === 'false') filter.isVerified = false;

    if (confidence === 'HIGH') {
      filter['structured_data.petitioner.confidence'] = 'HIGH';
    } else if (confidence === 'MEDIUM') {
      filter['structured_data.petitioner.confidence'] = { $in: ['HIGH', 'MEDIUM'] };
    }

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip     = (pageNum - 1) * limitNum;

    const [docs, total] = await Promise.all([
      Document.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-__v -fileKey')
        .lean(),
      Document.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: docs,
      pagination: {
        total,
        page:  pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[DocumentController] getDocuments error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch documents.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* GET /api/documents/filter-options  (cached 10 min)          */
/* ─────────────────────────────────────────────────────────── */
const getFilterOptions = async (req, res) => {
  try {
    const CACHE_KEY = 'filter-options';
    const cached = filterOptionsCache.get(CACHE_KEY);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const [courts, states, caseTypes, finalDecisions, sections] = await Promise.all([
      Document.distinct('structured_data.court.value'),
      Document.distinct('structured_data.state.value'),
      Document.distinct('additional_fields.case_type.value'),
      Document.distinct('additional_fields.final_decision.value'),
      Document.distinct('additional_fields.sections_involved.value'),
    ]);

    const clean = (arr) => arr.filter(Boolean).sort();

    const data = {
      courts:         clean(courts),
      states:         clean(states),
      caseTypes:      clean(caseTypes),
      finalDecisions: clean(finalDecisions),
      sections:       clean(sections),
    };

    filterOptionsCache.set(CACHE_KEY, data);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[DocumentController] getFilterOptions error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch filter options.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* PUT /api/documents/:id  — update with audit log             */
/* ─────────────────────────────────────────────────────────── */
const updateDocument = async (req, res) => {
  try {
    const { structured_data, additional_fields, summary } = req.body;

    /* Snapshot current doc for audit */
    const current = await Document.findById(req.params.id)
      .select('structured_data additional_fields summary')
      .lean();
    if (!current) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const $set = {
      isEdited:     true,
      lastEditedAt: new Date(),
    };

    if (typeof summary === 'string') $set.summary = summary;

    if (structured_data && typeof structured_data === 'object') {
      for (const [key, value] of Object.entries(structured_data)) {
        $set[`structured_data.${key}.value`]      = value;
        $set[`structured_data.${key}.confidence`] = 'HIGH';
        $set[`structured_data.${key}.source`]     = 'document';
      }
    }

    const ARRAY_FIELDS = new Set([
      'sections_involved', 'precedents_cited',
      'relevant_notifications', 'relevant_circulars',
    ]);

    if (additional_fields && typeof additional_fields === 'object') {
      for (const [key, value] of Object.entries(additional_fields)) {
        const isArr = ARRAY_FIELDS.has(key);
        const coerced = isArr
          ? (Array.isArray(value) ? value : String(value).split(',').map(s => s.trim()).filter(Boolean))
          : value;
        $set[`additional_fields.${key}.value`]      = coerced;
        $set[`additional_fields.${key}.confidence`] = 'HIGH';
        $set[`additional_fields.${key}.source`]     = 'document';
      }
    }

    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { $set },
      { new: true, runValidators: false, select: '-__v -fileKey' }
    ).lean();

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    /* Write audit log */
    try {
      await AuditLog.create({
        documentId: req.params.id,
        userId:     req.user._id,
        action:     'edit',
        field:      Object.keys(structured_data || {}).concat(Object.keys(additional_fields || {})).join(', '),
        oldValue:   { structured_data: current.structured_data, additional_fields: current.additional_fields, summary: current.summary },
        newValue:   { structured_data, additional_fields, summary },
      });
    } catch (auditErr) {
      console.warn('[AuditLog] write failed:', auditErr.message);
    }

    filterOptionsCache.clear();
    return res.status(200).json({ success: true, data: doc });
  } catch (err) {
    console.error('[DocumentController] updateDocument error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Update failed.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* PATCH /api/documents/:id/verify                             */
/* ─────────────────────────────────────────────────────────── */
const toggleVerify = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).select('isVerified').lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    const nowVerified = !doc.isVerified;
    const updated = await Document.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isVerified: nowVerified,
          verifiedAt: nowVerified ? new Date() : null,
        },
      },
      { new: true, select: '-__v -fileKey' }
    ).lean();

    try {
      await AuditLog.create({
        documentId: req.params.id,
        userId:     req.user._id,
        action:     nowVerified ? 'verify' : 'unverify',
        oldValue:   doc.isVerified,
        newValue:   nowVerified,
      });
    } catch (auditErr) {
      console.warn('[AuditLog] write failed:', auditErr.message);
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('[DocumentController] toggleVerify error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Verify toggle failed.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* PATCH /api/documents/bulk-verify                            */
/*   Body: { ids: string[], verify: boolean }                  */
/* ─────────────────────────────────────────────────────────── */
const bulkVerify = async (req, res) => {
  try {
    const { ids, verify } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids array is required.' });
    }
    const nowVerified = Boolean(verify);
    const result = await Document.updateMany(
      { _id: { $in: ids } },
      { $set: { isVerified: nowVerified, verifiedAt: nowVerified ? new Date() : null } }
    );

    try {
      const logs = ids.map(id => ({
        documentId: id,
        userId:     req.user._id,
        action:     'bulk_verify',
        newValue:   nowVerified,
      }));
      await AuditLog.insertMany(logs, { ordered: false });
    } catch (auditErr) {
      console.warn('[AuditLog] bulk write failed:', auditErr.message);
    }

    return res.status(200).json({ success: true, modified: result.modifiedCount });
  } catch (err) {
    console.error('[DocumentController] bulkVerify error:', err.message);
    return res.status(500).json({ success: false, message: 'Bulk verify failed.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* GET /api/documents/:id/presigned-url                        */
/* ─────────────────────────────────────────────────────────── */
const fetchPresignedUrl = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).select('fileKey fileName').lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
    const url = await getPresignedUrl(doc.fileKey);
    return res.status(200).json({ success: true, url });
  } catch (err) {
    console.error('[DocumentController] fetchPresignedUrl error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to generate file URL.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* GET /api/documents/export  — CSV download                   */
/* ─────────────────────────────────────────────────────────── */
const exportDocuments = async (req, res) => {
  try {
    /* Reuse the same filter logic as getDocuments but fetch all (up to 5000) */
    const {
      petitioner, respondent, court, state,
      dateFrom, dateTo, caseType, finalDecision, sections,
      isVerified,
    } = req.query;

    const filter = {};
    const tf = (p, v) => { if (v?.trim()) filter[p] = { $regex: v.trim(), $options: 'i' }; };

    tf('structured_data.petitioner.value', petitioner);
    tf('structured_data.respondent.value', respondent);
    tf('structured_data.court.value',      court);
    tf('structured_data.state.value',      state);
    tf('additional_fields.case_type.value',      caseType);
    tf('additional_fields.final_decision.value', finalDecision);

    if (dateFrom?.trim() || dateTo?.trim()) {
      const r = {};
      if (dateFrom?.trim()) r.$gte = dateFrom.trim();
      if (dateTo?.trim())   r.$lte = dateTo.trim();
      filter['structured_data.date.value'] = r;
    }
    if (sections?.trim()) {
      filter['additional_fields.sections_involved.value'] = {
        $elemMatch: { $regex: sections.trim(), $options: 'i' },
      };
    }
    if (isVerified === 'true')  filter.isVerified = true;
    if (isVerified === 'false') filter.isVerified = false;

    const docs = await Document.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .select('-__v -fileKey -contentHash')
      .lean();

    /* ── Build CSV ── */
    const HEADERS = [
      'File Name', 'Petitioner', 'Respondent', 'Court', 'State', 'Date',
      'Order No.', 'Citation', 'Judges', 'Case Type', 'Final Decision',
      'Sections Involved', 'Key Issue', 'Acts Involved',
      'Petitioner Counsel', 'Respondent Counsel',
      'Verified', 'Summary',
    ];

    const esc = (v) => {
      const s = String(v ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = docs.map(d => {
      const sd = d.structured_data   || {};
      const af = d.additional_fields || {};
      return [
        esc(d.fileName),
        esc(sd.petitioner?.value),
        esc(sd.respondent?.value),
        esc(sd.court?.value),
        esc(sd.state?.value),
        esc(sd.date?.value),
        esc(sd.order_no?.value),
        esc(sd.citation?.value),
        esc(sd.judges?.value),
        esc(af.case_type?.value),
        esc(af.final_decision?.value),
        esc((af.sections_involved?.value || []).join('; ')),
        esc(af.key_issue?.value),
        esc(af.acts_involved?.value),
        esc(sd.petitioner_counsel?.value),
        esc(sd.respondent_counsel?.value),
        esc(d.isVerified ? 'Yes' : 'No'),
        esc(d.summary),
      ].join(',');
    });

    const csv = [HEADERS.map(h => `"${h}"`).join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gst-case-laws-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('[DocumentController] exportDocuments error:', err.message);
    return res.status(500).json({ success: false, message: 'Export failed.' });
  }
};

/* ─────────────────────────────────────────────────────────── */
/* GET /api/documents/audit/:id  — audit log for a document    */
/* ─────────────────────────────────────────────────────────── */
const getAuditLog = async (req, res) => {
  try {
    const logs = await AuditLog.find({ documentId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'firstName lastName email')
      .lean();
    return res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error('[DocumentController] getAuditLog error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit log.' });
  }
};

module.exports = {
  upload,
  uploadAI,
  hybridSearch,
  getDocuments,
  getFilterOptions,
  updateDocument,
  toggleVerify,
  bulkVerify,
  fetchPresignedUrl,
  exportDocuments,
  getAuditLog,
};
