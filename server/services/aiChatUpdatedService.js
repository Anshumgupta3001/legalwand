const OpenAI   = require('openai');
const { getPineconeIndex } = require('../utils/pineconeClient');
const Document = require('../models/Document');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.10');
const TOP_K                = 10;
const MAX_CONTEXT_CHARS    = 12000;

/* ── 1. Embed the user query ── */
const embedQuery = async (query) => {
  const res = await openai.embeddings.create({
    model:           'text-embedding-3-large',
    input:           query,
    dimensions:      1024,
    encoding_format: 'float',
  });
  return Array.from(res.data[0].embedding);
};

/* ── 2. Query Pinecone ── */
const queryPinecone = async (embedding) => {
  const index = getPineconeIndex();
  const response = await index.query({
    vector:          embedding,
    topK:            TOP_K,
    includeMetadata: true,
    filter:          { tag: { $eq: 'ai-upload' } },
  });
  return (response.matches || []).filter(m => m.score >= SIMILARITY_THRESHOLD);
};

/* ── 3. Fetch matching documents from MongoDB ── */
const fetchDocuments = async (uniqueIds) => {
  if (!uniqueIds.length) return [];
  return Document
    .find({ uniqueId: { $in: uniqueIds } })
    .select('uniqueId fileName summary structured_data additional_fields isVerified fileKey _id')
    .lean();
};

/* ── 4. Build match explanation for each result ── */
const buildMatchExplanation = (doc, query, rank, score) => {
  const sd = doc.structured_data   || {};
  const af = doc.additional_fields || {};
  const q  = query.toLowerCase();

  const matchedFields  = [];
  const matchReasons   = [];

  /* Check which fields contain query terms */
  const checkField = (label, val) => {
    if (!val) return;
    const v = Array.isArray(val) ? val.join(' ') : String(val);
    if (v.toLowerCase().split(/\s+/).some(w => w.length > 3 && q.includes(w))) {
      matchedFields.push(label);
    }
  };

  checkField('Petitioner',    sd.petitioner?.value);
  checkField('Respondent',    sd.respondent?.value);
  checkField('Court',         sd.court?.value);
  checkField('State',         sd.state?.value);
  checkField('Key Issue',     af.key_issue?.value);
  checkField('Final Decision',af.final_decision?.value);
  checkField('Sections',      af.sections_involved?.value);
  checkField('Summary',       doc.summary);

  /* Section matches */
  const sectionMatches = (af.sections_involved?.value || [])
    .filter(s => q.includes(s.toLowerCase().replace('section ', '')));
  if (sectionMatches.length) {
    matchReasons.push(`Section match: ${sectionMatches.join(', ')}`);
  }

  /* Decision match */
  const decisionKeywords = ['set aside', 'allowed', 'dismissed', 'remanded', 'stayed'];
  const decisionMatch = decisionKeywords.find(kw => q.includes(kw) && af.final_decision?.value?.toLowerCase().includes(kw));
  if (decisionMatch) matchReasons.push(`Decision: ${af.final_decision.value}`);

  /* Semantic match reason */
  if (!matchReasons.length && score >= 0.6) {
    matchReasons.push('Semantically similar legal context');
  } else if (!matchReasons.length) {
    matchReasons.push('Conceptually related case law');
  }

  return {
    matchedFields,
    matchReason:  matchReasons.join(' + '),
    scorePercent: Math.round(score * 100),
    isBestMatch:  rank < 2,
  };
};

/* ── 5. Generate answer ── */
const generateAnswer = async (query, contextText) => {
  if (!contextText.trim()) {
    return 'No relevant GST case laws were found in the knowledge base for your query. Please try rephrasing with more specific terms.';
  }

  const system = `You are a senior GST (Goods and Services Tax) legal expert in India.

Answer the user's question based ONLY on the retrieved case law summaries provided.

Rules:
- Cite specific cases, courts, or dates from the summaries when relevant
- Do not hallucinate or invent facts beyond what the summaries state
- If the summaries do not fully answer the question, clearly say so
- Write in clear, professional legal language
- Keep the answer concise: 150–250 words maximum
- Format as flowing paragraphs, no bullet points`;

  const userMsg = `User question: ${query}

Retrieved case law summaries:
${contextText}

Provide a precise, evidence-based answer using only the above summaries.`;

  const res = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    temperature: 0.1,
    max_tokens:  450,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: userMsg },
    ],
  });

  return (res.choices[0]?.message?.content || '').trim();
};

/* ── Main pipeline ── */
const processAIChatQuery = async (query) => {
  const embedding = await embedQuery(query);
  const matches   = await queryPinecone(embedding);

  if (!matches.length) {
    return {
      answer:  'No relevant GST case laws were found for your query. The knowledge base may not contain documents covering this specific topic. Please try a more specific question or upload relevant documents first.',
      results: [],
    };
  }

  const uniqueIds = matches.map(m => m.id);
  const docs      = await fetchDocuments(uniqueIds);
  const docMap    = new Map(docs.map(d => [d.uniqueId, d]));

  const results = matches
    .map((match, rank) => {
      const doc = docMap.get(match.id);
      if (!doc) return null;
      return {
        uniqueId:          doc.uniqueId,
        _id:               doc._id.toString(),
        score:             match.score,
        fileName:          doc.fileName,
        summary:           doc.summary,
        isVerified:        doc.isVerified,
        structured_data:   doc.structured_data,
        additional_fields: doc.additional_fields,
        explanation:       buildMatchExplanation(doc, query, rank, match.score),
      };
    })
    .filter(Boolean);

  /* Context budget */
  let usedChars = 0;
  const contextParts = [];
  for (const r of results) {
    const chunk = `Case: ${r.fileName}\nSummary: ${r.summary}`;
    if (usedChars + chunk.length > MAX_CONTEXT_CHARS) break;
    contextParts.push(chunk);
    usedChars += chunk.length;
  }

  const answer = await generateAnswer(query, contextParts.join('\n\n---\n\n'));

  return { answer, results };
};

module.exports = { processAIChatQuery };
