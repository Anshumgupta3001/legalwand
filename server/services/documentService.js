const crypto   = require('crypto');
const OpenAI   = require('openai');
const mammoth  = require('mammoth');
const { extractPdfText }   = require('../utils/pdfExtract');
const { uploadToS3 }       = require('../utils/s3Client');
const { getPineconeIndex } = require('../utils/pineconeClient');
const { normalizeDocumentFields } = require('../utils/normalizer');
const Document = require('../models/Document');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ── Text extraction ── */
const extractText = async (buffer, mimetype) => {
  if (mimetype === 'application/pdf') {
    const result = await extractPdfText(buffer);
    return result.text || '';
  }
  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  throw new Error(`Unsupported file type: ${mimetype}`);
};

/* ── SHA-256 hash for duplicate detection ── */
const hashText = (text) =>
  crypto.createHash('sha256').update(text.trim().slice(0, 5000)).digest('hex');

/* ── Build text window: head + tail for long documents ── */
const buildTextWindow = (text) => {
  const HEAD = 9000;
  const TAIL = 3000;
  if (text.length <= HEAD + TAIL) return text;
  return (
    text.slice(0, HEAD) +
    '\n\n[... middle section omitted ...]\n\n' +
    text.slice(-TAIL)
  );
};

/* ── Unified prompt ── */
const UNIFIED_PROMPT = `You are a senior AI system specialized in legal document analysis for GST (Goods and Services Tax) case laws in India.

From the extracted document text, generate strictly structured, consistent, and intelligent JSON output.

### OUTPUT FORMAT — return ONLY valid JSON, no explanation, no markdown:

{
  "summary": "...",

  "structured_data": {
    "petitioner":         { "value": "", "confidence": "", "source": "" },
    "respondent":         { "value": "", "confidence": "", "source": "" },
    "court":              { "value": "", "confidence": "", "source": "" },
    "state":              { "value": "", "confidence": "", "source": "" },
    "date":               { "value": "", "confidence": "", "source": "" },
    "order_no":           { "value": "", "confidence": "", "source": "" },
    "citation":           { "value": "", "confidence": "", "source": "" },
    "judges":             { "value": "", "confidence": "", "source": "" },
    "petitioner_counsel": { "value": "", "confidence": "", "source": "" },
    "respondent_counsel": { "value": "", "confidence": "", "source": "" }
  },

  "additional_fields": {
    "case_type":              { "value": "", "confidence": "", "source": "" },
    "acts_involved":          { "value": "", "confidence": "", "source": "" },
    "sections_involved":      { "value": [], "confidence": "", "source": "" },
    "key_issue":              { "value": "", "confidence": "", "source": "" },
    "final_decision":         { "value": "", "confidence": "", "source": "" },
    "decision_summary":       { "value": "", "confidence": "", "source": "" },
    "important_observations": { "value": "", "confidence": "", "source": "" },
    "precedents_cited":       { "value": [], "confidence": "", "source": "" },
    "relevant_notifications": { "value": [], "confidence": "", "source": "" },
    "relevant_circulars":     { "value": [], "confidence": "", "source": "" }
  },

  "table": [
    { "field": "Petitioner",             "value": "" },
    { "field": "Respondent",             "value": "" },
    { "field": "Court",                  "value": "" },
    { "field": "State",                  "value": "" },
    { "field": "Date",                   "value": "" },
    { "field": "Order No.",              "value": "" },
    { "field": "Citation",               "value": "" },
    { "field": "Judges",                 "value": "" },
    { "field": "Counsel for Petitioner", "value": "" },
    { "field": "Counsel for Respondent", "value": "" }
  ]
}

### CONFIDENCE RULES — apply to EVERY field:

HIGH   — field clearly and explicitly present in the document.     Set source = "document"
MEDIUM — field not explicit but logically inferred from context.   Set source = "inferred"
LOW    — field not found and cannot be inferred.                   Set source = "not_found"

### EXTRACTION RULES:

1. CONSISTENCY — always return all keys; never skip or rename.

2. NO HALLUCINATION — do NOT invent notifications, circulars, citations, or case references.
   If not present in the text → empty value + LOW confidence + source = "not_found".

3. SMART INFERENCE — ALLOWED ONLY for: key_issue, final_decision, decision_summary, case_type.
   Examples: "order is set aside" → final_decision = "Set Aside" (MEDIUM, inferred)
             petition challenged show-cause notice → case_type = "Writ Petition" (MEDIUM, inferred)

4. FIELD FORMATS:
   - date: YYYY-MM-DD preferred, DD-MM-YYYY acceptable.
   - judges, petitioner_counsel, respondent_counsel: comma-separated string.
   - acts_involved: comma-separated string (e.g. "CGST Act 2017, IGST Act 2017").
   - sections_involved, precedents_cited, relevant_notifications, relevant_circulars: arrays of strings.
   - final_decision: normalised phrase — "Allowed", "Dismissed", "Remanded", "Set Aside", "Stayed", etc.
   - decision_summary: 1–3 concise sentences on the operative order.
   - important_observations: key legal principles or notable remarks by the court.
   - table.value must mirror structured_data[field].value exactly.

5. SUMMARY — 150 to 250 words, professional legal prose, no bullet points, no headings.
   Cover: case background, key legal issue, arguments from both sides,
   court's reasoning, and final outcome or current status.

### CRITICAL ARRAY FIELDS — these MUST be extracted precisely.

6. sections_involved — MANDATORY array.
   Extract EVERY GST/CGST/IGST/SGST/UTGST Act section number cited anywhere.
   Normalise format: "Section 16(4)" not just "16(4)". Include sub-sections.
   Examples: ["Section 16(4)", "Section 74", "Section 107", "Section 129(3)", "Rule 86A"]
   If NONE found → []

7. relevant_notifications — MANDATORY array.
   Extract EVERY notification cited.
   Examples: ["Notification No. 12/2017-Central Tax dated 28.06.2017"]
   If NONE found → []

8. relevant_circulars — MANDATORY array.
   Extract EVERY circular cited.
   Examples: ["Circular No. 56/30/2018-GST dated 24.08.2018"]
   If NONE found → []

9. precedents_cited — MANDATORY array.
   Extract EVERY case law citation verbatim as it appears in the document.
   If NONE found → []

CRITICAL RULE: Never return null for these four fields. Always return [] if nothing found.`;

/* ── Single unified OpenAI call ── */
const analyzeDocument = async (text) => {
  const window = buildTextWindow(text);
  const response = await openai.chat.completions.create({
    model:           'gpt-4.1',
    temperature:     0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: UNIFIED_PROMPT },
      { role: 'user',   content: `Document text:\n\n${window}` },
    ],
  });
  const raw = response.choices[0]?.message?.content || '{}';
  return JSON.parse(raw);
};

/* ── Extract flat string values ── */
const flatValues = (structured_data) =>
  Object.fromEntries(
    Object.entries(structured_data).map(([k, v]) => [k, v?.value || ''])
  );

/* ── Pinecone upsert ── */
const storeInPinecone = async (uniqueId, summary, structured_data, additional_fields, fileName, fileKey, createdAt) => {
  const embeddingResponse = await openai.embeddings.create({
    model:           'text-embedding-3-large',
    input:           summary || fileName,
    dimensions:      1024,
    encoding_format: 'float',
  });

  const vector = {
    id:     uniqueId,
    values: Array.from(embeddingResponse.data[0].embedding),
    metadata: {
      ...flatValues(structured_data),
      case_type:      additional_fields?.case_type?.value      || '',
      acts_involved:  additional_fields?.acts_involved?.value  || '',
      key_issue:      additional_fields?.key_issue?.value      || '',
      final_decision: additional_fields?.final_decision?.value || '',
      fileName,
      fileKey,
      createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
      tag:  'ai-upload',
      type: 'legal-document',
    },
  };

  const index = getPineconeIndex();
  await index.upsert({ records: [vector] });
};

/* ── Main pipeline ── */
const processDocument = async ({ buffer, mimetype, originalname }) => {
  const uniqueId = crypto.randomUUID();
  const safeKey  = `ai-docs/${uniqueId}-${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  /* 1. Extract text */
  const rawText = await extractText(buffer, mimetype);
  if (!rawText.trim()) {
    throw new Error('No readable text could be extracted from this file.');
  }

  /* 2. Duplicate detection via content hash */
  const contentHash = hashText(rawText);
  const duplicate   = await Document.findOne({ contentHash }).select('_id fileName').lean();
  if (duplicate) {
    throw new Error(`Duplicate document detected. A similar file "${duplicate.fileName}" already exists.`);
  }

  /* 3. S3 upload + AI analysis — in parallel */
  const [fileKey, analysisResult] = await Promise.all([
    uploadToS3(buffer, safeKey, mimetype),
    analyzeDocument(rawText),
  ]);

  let {
    summary           = '',
    structured_data   = {},
    additional_fields = {},
    table             = [],
  } = analysisResult;

  /* 4. Normalize fields */
  const normalized = normalizeDocumentFields(structured_data, additional_fields);
  structured_data   = normalized.structured_data;
  additional_fields = normalized.additional_fields;

  /* 5. Save to MongoDB */
  const doc = await Document.create({
    uniqueId,
    fileName: originalname,
    fileKey,
    contentHash,
    summary,
    structured_data,
    additional_fields,
    table,
  });

  /* 6. Store embedding in Pinecone */
  await storeInPinecone(uniqueId, summary, structured_data, additional_fields, originalname, fileKey, doc.createdAt);

  return {
    uniqueId,
    _id:              doc._id,
    fileName:         originalname,
    fileKey,
    summary,
    structured_data,
    additional_fields,
    table,
    createdAt:        doc.createdAt,
  };
};

module.exports = { processDocument };
