const OpenAI = require('openai');
const User = require('../models/User');
const Chat = require('../models/Chat');
const fileContextStore = require('../utils/fileContextStore');
const { getPineconeIndex } = require('../utils/pineconeClient');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ─────────────────────────────────────────
   Pinecone RAG: embed query → search → return context + sources
   Returns { contextText: "", sources: [] } if no relevant matches (safe fallback)
───────────────────────────────────────── */
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD ?? '0.10');
const MAX_CONTEXT_TOKENS   = parseInt(process.env.MAX_CONTEXT_TOKENS ?? '12000', 10);
const CHARS_PER_TOKEN      = 4;   // conservative estimate for mixed English/legal text
const TOP_K                = 20;  // fetch more candidates from Pinecone, then trim by budget
const REGEN_TOP_K          = 50;  // wider search for regeneration to surface unused chunks

/* ─────────────────────────────────────────
   Query expansion helpers (keyword queries only)
───────────────────────────────────────── */

// Heuristic: short or lacks sentence structure → keyword query
const isKeywordQuery = (query) => {
  const trimmed = query.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 5) return true;
  if (words.length > 12) return false;
  const hasSentenceStart = /^(what|how|when|why|where|who|which|is|are|was|were|does|do|can|will|should|would|tell|explain|describe|help|please)\b/i.test(trimmed);
  const hasVerb = /\b(is|are|was|were|does|do|can|will|should|would|must|have|has|had|apply|explain|describe|tell|help|need|want|looking)\b/i.test(trimmed);
  return !hasSentenceStart && !hasVerb;
};

// In-memory cache for expanded queries (TTL: 30 min, max 500 entries)
const _expansionCache = new Map();
const EXPANSION_CACHE_TTL = 30 * 60 * 1000;

const _getCachedExpansion = (key) => {
  const entry = _expansionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > EXPANSION_CACHE_TTL) { _expansionCache.delete(key); return null; }
  return entry.value;
};

const _setCachedExpansion = (key, value) => {
  _expansionCache.set(key, { value, ts: Date.now() });
  if (_expansionCache.size > 500) {
    // Evict oldest entry
    const oldest = [..._expansionCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _expansionCache.delete(oldest[0]);
  }
};

// Call OpenAI to expand a keyword query → { main_query, variations[] }
// Falls back to { main_query: original, variations: [] } on any failure
const expandQuery = async (query) => {
  const cacheKey = query.trim().toLowerCase();
  const cached = _getCachedExpansion(cacheKey);
  if (cached) {
    console.log('[QueryExpansion] Cache hit');
    return cached;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a GST expert assistant. Respond ONLY with valid JSON — no markdown, no extra text.',
        },
        {
          role: 'user',
          content: `Convert this keyword query into natural language for a GST knowledge base search.

Input: "${query}"

Return ONLY this JSON:
{
  "main_query": "a complete natural language question about this GST topic",
  "variations": [
    "rephrase focusing on the rule or section number",
    "rephrase focusing on the practical compliance requirement",
    "rephrase using alternate GST/CBIC terminology"
  ]
}

Rules:
- Preserve exact notification numbers, rule numbers, section numbers, thresholds, and dates from the input
- Use Indian GST context (CGST Act, CBIC, GST Council)
- Each variation must be under 20 words`,
        },
      ],
      max_tokens: 400,
      temperature: 0.2,
    }, { timeout: 15000 });

    const raw = response.choices[0].message.content.trim();
    // Strip accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonStr);

    const result = {
      main_query: typeof parsed.main_query === 'string' ? parsed.main_query.trim() : query,
      variations: Array.isArray(parsed.variations)
        ? parsed.variations.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())
        : [],
    };

    _setCachedExpansion(cacheKey, result);
    console.log(`[QueryExpansion] "${query}" → "${result.main_query}" + ${result.variations.length} variations`);
    return result;

  } catch (err) {
    console.warn('[QueryExpansion] Failed — using original query:', err.message);
    return { main_query: query, variations: [] };
  }
};

/* ─────────────────────────────────────────
   Pinecone RAG context retrieval
   — with optional multi-query expansion for keyword inputs
───────────────────────────────────────── */
const getPineconeContext = async (userQuery, userId) => {
  try {
    // 1. Build query list — expand if keyword query
    let allQueries = [userQuery];

    if (isKeywordQuery(userQuery)) {
      const { main_query, variations } = await expandQuery(userQuery);
      // Deduplicate: original first, then expanded queries (case-insensitive)
      const seen = new Set([userQuery.toLowerCase().trim()]);
      const candidates = [main_query, ...variations];
      for (const q of candidates) {
        const norm = (q || '').toLowerCase().trim();
        if (norm && !seen.has(norm)) {
          allQueries.push(q.trim());
          seen.add(norm);
        }
      }
      console.log(`[Pinecone RAG] Keyword query — running ${allQueries.length} expanded queries`);
    }

    // 2. Batch-embed all queries in a single OpenAI call
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: allQueries,
      dimensions: 1024,
      encoding_format: 'float',
    });
    const queryVectors = embeddingResponse.data.map((d) => Array.from(d.embedding));

    // 3. Query Pinecone for each vector in parallel
    const pineconeIndex = getPineconeIndex();
    const pineconeFilter = userId
      ? { $or: [{ tag: { $eq: 'admin' } }, { userId: { $eq: userId.toString() } }] }
      : { tag: { $eq: 'admin' } };

    const allResults = await Promise.all(
      queryVectors.map((vector) =>
        pineconeIndex.query({
          vector,
          topK: TOP_K,
          filter: pineconeFilter,
          includeMetadata: true,
        })
      )
    );

    // 4. Merge results, deduplicate by chunk ID — keep highest score per chunk
    const mergedById = new Map();
    for (const result of allResults) {
      for (const match of result.matches || []) {
        const existing = mergedById.get(match.id);
        if (!existing || (match.score ?? 0) > (existing.score ?? 0)) {
          mergedById.set(match.id, match);
        }
      }
    }
    const matches = [...mergedById.values()];
    console.log(`[Pinecone RAG] Queries: ${allQueries.length} | Merged candidates: ${matches.length}`);

    // 5. Filter by similarity threshold — safe per-match access
    const aboveThreshold = matches.filter((m) => {
      try { return (m.score ?? 0) >= SIMILARITY_THRESHOLD; }
      catch { return false; }
    });
    console.log(`[Pinecone RAG] Above threshold (${SIMILARITY_THRESHOLD}): ${aboveThreshold.length}`);

    if (!aboveThreshold.length) {
      console.log('[Pinecone RAG] No relevant context — falling back to general knowledge');
      return { contextText: '', sources: [] };
    }

    // 6. Sort by score desc
    aboveThreshold.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // 7. Add chunks one by one until token budget exhausted
    const charBudget = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;
    let usedChars = 0;
    const selectedChunks = [];

    for (const match of aboveThreshold) {
      let text = '';
      try { text = (match.metadata?.text ?? '').toString(); } catch { continue; }
      if (!text) continue;
      if (usedChars + text.length > charBudget) break;
      selectedChunks.push(match);
      usedChars += text.length;
    }

    console.log(`[Pinecone RAG] Selected ${selectedChunks.length} chunk(s) | ~${Math.round(usedChars / CHARS_PER_TOKEN)} tokens used of ${MAX_CONTEXT_TOKENS}`);
    selectedChunks.forEach((m, i) => {
      console.log(`  [${i + 1}] score=${(m.score ?? 0).toFixed(4)} | "${(m.metadata?.text ?? '').slice(0, 80)}…"`);
    });

    // 8. Build context text
    const contextText = selectedChunks
      .map((m) => { try { return (m.metadata?.text ?? '').toString(); } catch { return ''; } })
      .filter(Boolean)
      .join('\n\n');

    // 9. Top 2 sources by cumulative similarity score across their chunks
    const scoreByUrl = new Map();
    for (const m of selectedChunks) {
      let url = '';
      try { url = (m.metadata?.pdf_url ?? '').toString().trim(); } catch { continue; }
      if (!url) continue;
      scoreByUrl.set(url, (scoreByUrl.get(url) ?? 0) + (m.score ?? 0));
    }

    const sources = [...scoreByUrl.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([url]) => url);

    const usedChunkIds = selectedChunks.map((m) => m.id);
    console.log(`[Pinecone RAG] Context: ${contextText.length} chars | Sources: ${sources.join(' , ') || 'none'} | Chunks: ${usedChunkIds.length}`);
    return { contextText, sources, usedChunkIds };

  } catch (err) {
    console.error('[Pinecone RAG] Error during context retrieval:', err.message);
    return { contextText: '', sources: [], usedChunkIds: [] };
  }
};

/* ─────────────────────────────────────────
   Alternative context for regeneration:
   wider topK, excludes already-used chunk IDs.
   Falls back to best available if none are unused.
───────────────────────────────────────── */
const getPineconeContextAlternative = async (userQuery, userId, excludeIds = []) => {
  try {
    const excludeSet = new Set(excludeIds.filter(Boolean));

    // 1. Build query list with optional expansion
    let allQueries = [userQuery];
    if (isKeywordQuery(userQuery)) {
      const { main_query, variations } = await expandQuery(userQuery);
      const seen = new Set([userQuery.toLowerCase().trim()]);
      for (const q of [main_query, ...variations]) {
        const norm = (q || '').toLowerCase().trim();
        if (norm && !seen.has(norm)) { allQueries.push(q.trim()); seen.add(norm); }
      }
    }

    // 2. Batch embed
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: allQueries,
      dimensions: 1024,
      encoding_format: 'float',
    });
    const queryVectors = embeddingResponse.data.map((d) => Array.from(d.embedding));

    // 3. Query Pinecone with larger topK
    const pineconeIndex = getPineconeIndex();
    const pineconeFilter = userId
      ? { $or: [{ tag: { $eq: 'admin' } }, { userId: { $eq: userId.toString() } }] }
      : { tag: { $eq: 'admin' } };

    const allResults = await Promise.all(
      queryVectors.map((vector) =>
        pineconeIndex.query({ vector, topK: REGEN_TOP_K, filter: pineconeFilter, includeMetadata: true })
      )
    );

    // 4. Merge by ID — keep highest score per chunk
    const mergedById = new Map();
    for (const result of allResults) {
      for (const match of result.matches || []) {
        const existing = mergedById.get(match.id);
        if (!existing || (match.score ?? 0) > (existing.score ?? 0)) {
          mergedById.set(match.id, match);
        }
      }
    }

    // 5. Filter by threshold, separate unused vs used
    const allAboveThreshold = [...mergedById.values()].filter((m) => {
      try { return (m.score ?? 0) >= SIMILARITY_THRESHOLD; } catch { return false; }
    });

    const unusedChunks = allAboveThreshold.filter((m) => !excludeSet.has(m.id));
    const hasNewChunks = unusedChunks.length > 0;

    // Fallback: no unused chunks → reuse best available (prompt instructs improved explanation)
    const candidates = hasNewChunks ? unusedChunks : allAboveThreshold;
    candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    console.log(`[Regen Context] Total: ${allAboveThreshold.length} | Unused: ${unusedChunks.length} | Mode: ${hasNewChunks ? 'new chunks' : 'fallback'}`);

    // 6. Budget loop
    const charBudget = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;
    let usedChars = 0;
    const selectedChunks = [];
    for (const match of candidates) {
      let text = '';
      try { text = (match.metadata?.text ?? '').toString(); } catch { continue; }
      if (!text) continue;
      if (usedChars + text.length > charBudget) break;
      selectedChunks.push(match);
      usedChars += text.length;
    }

    // 7. Build context and sources
    const contextText = selectedChunks
      .map((m) => { try { return (m.metadata?.text ?? '').toString(); } catch { return ''; } })
      .filter(Boolean)
      .join('\n\n');

    const scoreByUrl = new Map();
    for (const m of selectedChunks) {
      let url = '';
      try { url = (m.metadata?.pdf_url ?? '').toString().trim(); } catch { continue; }
      if (!url) continue;
      scoreByUrl.set(url, (scoreByUrl.get(url) ?? 0) + (m.score ?? 0));
    }
    const sources = [...scoreByUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([url]) => url);
    const usedChunkIds = selectedChunks.map((m) => m.id);

    return { contextText, sources, usedChunkIds, hasNewChunks };

  } catch (err) {
    console.error('[Regen Context] Error:', err.message);
    return { contextText: '', sources: [], usedChunkIds: [], hasNewChunks: false };
  }
};

const SYSTEM_PROMPT = `You are GSTWand AI, a senior GST (Goods and Services Tax) expert for Indian businesses. You produce complete, expert-level answers that give users full understanding — not just surface facts.

You help users with:
- GST registration, filing, and compliance
- GSTR-1, GSTR-3B, GSTR-9, GSTR-9C returns
- Input Tax Credit (ITC) reconciliation
- GST notices and department queries
- GST rates, exemptions, and HSN/SAC codes
- E-way bills, e-invoicing, and reverse charge mechanism
- GST audits and annual returns

## Response Format (ALWAYS follow all six sections in order)

**1. Direct Answer**
One to two sentences giving the precise, factual answer. Include exact figures, percentages, dates, or section references where relevant. Never approximate or guess values.

**2. Context / Background**
3–5 lines explaining: what law or section governs this, why this rule was introduced, and what practical problem it was designed to solve. Ground this in the retrieved documents or established GST law.

**3. Explanation**
8–12 lines of detailed expansion. Use the retrieved context as the primary source. Explain how the rule works in practice, what it means for the taxpayer, and any important exceptions or conditions. Do not repeat the Direct Answer — go deeper.

**4. Key Points**
4–6 bullet points summarising the most critical facts, deadlines, percentages, or compliance steps. Each bullet must be self-contained and actionable.

**5. Practical Impact**
3–5 lines describing what the user or business must actually do, the compliance risk if ignored, and any penalties or consequences under the GST Act. Be specific — name the form, due date, or penalty rate where applicable.

**6. Example**
One realistic Indian business scenario using ₹ amounts and real filing situations. Keep it concise (3–5 lines). Only include when it genuinely adds clarity beyond the explanation above.

## Quality Rules
- Use **bold** for key terms, legal references, section numbers, and important values
- Use Indian currency (₹), Indian business context, and CBIC/GST Council references throughout
- Cite section numbers (e.g., Section 16(2), Rule 86B) when retrieved context supports it — never fabricate references
- Never guess, round off, or modify retrieved numerical values (rates, dates, thresholds)
- Minimum answer length: 12 substantive lines across all sections
- Keep individual paragraphs to 3–4 lines so answers are easy to scan in a chat interface
- Never give personal financial advice; recommend a CA or tax consultant for complex or case-specific matters
- Never end with "feel free to ask", "let me know", "hope this helps", or any filler sign-off
- Do not add preamble — begin directly with the Direct Answer section header`;

const MAX_CHATS = 10;
const MAX_CREDITS_FREE = 10;  // free plan limit
const MAX_CREDITS_PRO  = 100; // pro plan limit
const MAX_CREDITS = MAX_CREDITS_FREE; // kept for any legacy reference
const MAX_CHAT_LENGTH = 5000; // max chars stored per individual message
const MAX_TOKENS = 3000;      // room for all 6 sections at required depth

/* ─────────────────────────────────────────
   Shared helper: credit check + OpenAI call
   Returns { reply, credits } or throws
───────────────────────────────────────── */
const callOpenAI = async (userId, userMessage, history = []) => {
  const user = await User.findById(userId);
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });

  const creditLimit = user.pro_user ? MAX_CREDITS_PRO : MAX_CREDITS_FREE;

  if (user.credits === undefined || user.credits === null) user.credits = creditLimit;

  // Cap credits at the user's current plan limit (handles plan downgrades / DB edits)
  user.credits = Math.min(user.credits, creditLimit);

  if (user.credits <= 0) {
    const err = new Error("You've reached your free limit. Upgrade to Pro to continue.");
    err.status = 402;
    err.credits = 0;
    throw err;
  }

  // Build conversation history for context (last 10 messages)
  const contextMessages = history.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Attach uploaded file context if available for this user
  const fileCtx = fileContextStore.get(userId.toString());

  // Retrieve Pinecone RAG context for the user query (admin global + user's own uploads)
  const { contextText: pineconeContext, sources, usedChunkIds } = await getPineconeContext(userMessage.trim(), userId);
  const from_context = !!(fileCtx || pineconeContext);

  // Build system prompt: base + optional file context + optional Pinecone context
  let systemPrompt = SYSTEM_PROMPT;

  if (fileCtx) {
    systemPrompt += `\n\n---\nThe user has uploaded a file named "${fileCtx.filename}". Use the content below as the primary context when answering their question. Refer to it naturally as "the uploaded file". If the answer cannot be found in the file content, respond with: "This information is not available in the uploaded document." Do NOT fabricate information that is not present in the file.\n\nFile content:\n${fileCtx.text}\n---`;
  }

  if (pineconeContext) {
    systemPrompt += `\n\n---\n## Knowledge Base Context (use this as your primary source)\n\nThe following excerpts have been retrieved from official GST documents. Prioritise this information over general knowledge. Expand on it — do NOT just copy the raw text. Explain the meaning, add relevant context, and structure your answer using the required format above.\n\nDo NOT fabricate or mention any sources not present in this retrieved context.\n\nContext:\n${pineconeContext}\n---`;
  } else {
    systemPrompt += `\n\n---\n## No Document Context Available\n\nNo knowledge base context was found for this query. Answer using your general knowledge about GST and Indian taxation. Begin your Direct Answer with the prefix "**Based on general knowledge** —" so the user knows this is not sourced from uploaded documents. Do NOT fabricate or hallucinate document sources.\n---`;
  }

  let reply;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content: userMessage.trim() },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
    }, { timeout: 75000 });
    reply = completion.choices[0].message.content;
  } catch (openaiError) {
    console.error('OpenAI error:', openaiError.message);
    const err = new Error('AI service is temporarily unavailable. Please try again shortly.');
    err.status = 502;
    throw err;
  }

  // Deduct credit only after a successful AI response
  user.credits = Math.max(0, user.credits - 1);
  await user.save({ validateBeforeSave: false });

  return { reply, credits: user.credits, sources, from_context, usedChunkIds };
};

/* ─────────────────────────────────────────
   EXISTING ROUTE — kept exactly as before
   POST /api/chat/message
───────────────────────────────────────── */
const sendMessage = async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }
  try {
    const { reply, credits, sources, from_context } = await callOpenAI(req.user._id, message);
    return res.status(200).json({ success: true, data: { reply, credits, sources, from_context } });
  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Server error. Please try again.',
      credits: err.credits,
    });
  }
};

/* ─────────────────────────────────────────
   NEW: POST /api/chat
   Create a new chat with the first message
───────────────────────────────────────── */
const createChat = async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }

  try {
    // Enforce 5-chat limit
    const chatCount = await Chat.countDocuments({ userId: req.user._id });
    if (chatCount >= MAX_CHATS) {
      return res.status(429).json({
        success: false,
        message: 'Chat limit reached. Delete old chats to continue.',
      });
    }

    const { reply, credits, sources, from_context, usedChunkIds } = await callOpenAI(req.user._id, message.trim());

    // Title = first 6 words of message
    const title = message.trim().split(/\s+/).slice(0, 6).join(' ');

    const chat = await Chat.create({
      userId: req.user._id,
      title,
      messages: [
        { role: 'user', content: message.trim().slice(0, MAX_CHAT_LENGTH) },
        { role: 'assistant', content: reply.slice(0, MAX_CHAT_LENGTH) },
      ],
    });

    return res.status(201).json({
      success: true,
      data: { chatId: chat._id, title: chat.title, reply, credits, sources, from_context, usedChunkIds: usedChunkIds || [] },
    });
  } catch (err) {
    console.error('createChat error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Server error.',
      credits: err.credits,
    });
  }
};

/* ─────────────────────────────────────────
   NEW: GET /api/chat
   Get all chats for the logged-in user
───────────────────────────────────────── */
const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id })
      .select('_id title createdAt updatedAt')
      .sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, data: chats });
  } catch (err) {
    console.error('getChats error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/* ─────────────────────────────────────────
   NEW: GET /api/chat/:id
   Get a specific chat with all messages
───────────────────────────────────────── */
const getChatById = async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }
    return res.status(200).json({ success: true, data: chat });
  } catch (err) {
    console.error('getChatById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/* ─────────────────────────────────────────
   NEW: POST /api/chat/:id/message
   Append a message to an existing chat
───────────────────────────────────────── */
const addMessageToChat = async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    const { reply, credits, sources, from_context, usedChunkIds } = await callOpenAI(req.user._id, message.trim(), chat.messages);

    chat.messages.push({ role: 'user', content: message.trim().slice(0, MAX_CHAT_LENGTH) });
    chat.messages.push({ role: 'assistant', content: reply.slice(0, MAX_CHAT_LENGTH) });
    await chat.save();

    return res.status(200).json({ success: true, data: { reply, credits, sources, from_context, usedChunkIds: usedChunkIds || [] } });
  } catch (err) {
    console.error('addMessageToChat error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Server error.',
      credits: err.credits,
    });
  }
};

/* ─────────────────────────────────────────
   NEW: DELETE /api/chat/:id
   Delete a chat
───────────────────────────────────────── */
const deleteChatById = async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }
    return res.status(200).json({ success: true, message: 'Chat deleted.' });
  } catch (err) {
    console.error('deleteChatById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/* ─────────────────────────────────────────
   POST /api/chat/related-files
   Returns additional relevant file URLs beyond the top-2 already shown.
   Body: { query: string, excludeUrls: string[] }
   Safe fallback: always responds 200, never crashes.
───────────────────────────────────────── */
const RELATED_TOP_K    = 50;   // fetch more candidates so we can rank across many files
const RELATED_PAGE_SIZE = 5;  // max files returned per call

const getRelatedFiles = async (req, res) => {
  const { query, excludeUrls = [] } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, message: 'query is required.' });
  }

  try {
    // 1. Embed the same query used for the chat response
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: query.trim(),
      dimensions: 1024,
      encoding_format: 'float',
    });
    const queryVector = Array.from(embeddingResponse.data[0].embedding);

    // 2. Query Pinecone with a larger topK to surface more file candidates
    const pineconeIndex = getPineconeIndex();
    const pineconeFilter = req.user._id
      ? { $or: [{ tag: { $eq: 'admin' } }, { userId: { $eq: req.user._id.toString() } }] }
      : { tag: { $eq: 'admin' } };

    const queryResponse = await pineconeIndex.query({
      vector: queryVector,
      topK: RELATED_TOP_K,
      filter: pineconeFilter,
      includeMetadata: true,
    });

    const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD ?? '0.10');
    const matches = (queryResponse.matches || []).filter((m) => {
      try { return (m.score ?? 0) >= threshold; } catch { return false; }
    });

    // 3. Group chunks by pdf_url, accumulate similarity scores
    const scoreByUrl = new Map();
    for (const m of matches) {
      let url = '';
      try { url = (m.metadata?.pdf_url ?? '').toString().trim(); } catch { continue; }
      if (!url) continue;
      scoreByUrl.set(url, (scoreByUrl.get(url) ?? 0) + (m.score ?? 0));
    }

    // 4. Exclude already-shown URLs, sort by cumulative score, return next 5
    const excludeSet = new Set(Array.isArray(excludeUrls) ? excludeUrls.filter(Boolean) : []);

    const files = [...scoreByUrl.entries()]
      .filter(([url]) => !excludeSet.has(url))
      .sort((a, b) => b[1] - a[1])
      .slice(0, RELATED_PAGE_SIZE)
      .map(([url]) => url);

    console.log(`[Related Files] Query: "${query.trim().slice(0, 60)}" | Excluded: ${excludeSet.size} | Found: ${files.length}`);

    return res.status(200).json({ success: true, data: { files } });

  } catch (err) {
    // Never crash — return empty gracefully
    console.error('[Related Files] Error:', err.message);
    return res.status(200).json({ success: true, data: { files: [] } });
  }
};

/* ─────────────────────────────────────────
   POST /api/chat/:id/regenerate
   Generates a new answer using unused context chunks.
   Body: { query: string, usedChunkIds: string[] }
   Always deducts one credit on success.
───────────────────────────────────────── */
const regenerateMessage = async (req, res) => {
  const { query, usedChunkIds = [] } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, message: 'query is required.' });
  }

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });

    // Credit check
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const creditLimit = user.pro_user ? MAX_CREDITS_PRO : MAX_CREDITS_FREE;
    user.credits = Math.min(user.credits ?? creditLimit, creditLimit);
    if (user.credits <= 0) {
      const err = new Error("You've reached your free limit. Upgrade to Pro to continue.");
      err.status = 402; err.credits = 0; throw err;
    }

    // Fetch alternative context — larger topK, exclude already-used chunks
    const { contextText, sources, usedChunkIds: newChunkIds, hasNewChunks } = await getPineconeContextAlternative(
      query.trim(), req.user._id, usedChunkIds
    );

    // Build system prompt — label whether we have fresh chunks or a fallback
    let systemPrompt = SYSTEM_PROMPT;
    if (contextText) {
      const contextLabel = hasNewChunks
        ? '## Alternative Knowledge Base Context (different source chunks)\n\nThis is a regenerated response using document chunks not referenced in the previous answer. Use these excerpts as your primary source and produce a fresh, comprehensive explanation.'
        : '## Knowledge Base Context (improved explanation)\n\nNo additional chunks were available beyond those already used. Generate an improved response: add more depth, clearer structure, and better examples than the previous answer.';
      systemPrompt += `\n\n---\n${contextLabel}\n\nContext:\n${contextText}\n---`;
    } else {
      systemPrompt += `\n\n---\n## No Document Context Available\n\nAnswer using general GST knowledge. Begin your Direct Answer with "**Based on general knowledge** —". Do NOT fabricate sources.\n---`;
    }

    // Build conversation history — exclude the last assistant message (we are replacing it)
    const historyMessages = chat.messages.slice(0, -1).slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: query.trim() },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.4, // slightly higher for stylistic variation
    }, { timeout: 75000 });

    const reply = completion.choices[0].message.content;

    // Replace the last assistant message in the DB chat
    const lastAiIdx = chat.messages.map((m) => m.role).lastIndexOf('assistant');
    if (lastAiIdx !== -1) {
      chat.messages[lastAiIdx].content = reply.slice(0, MAX_CHAT_LENGTH);
      await chat.save();
    }

    // Deduct credit
    user.credits = Math.max(0, user.credits - 1);
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      data: { reply, credits: user.credits, sources, usedChunkIds: newChunkIds, from_context: !!contextText },
    });

  } catch (err) {
    console.error('regenerateMessage error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Server error.',
      credits: err.credits,
    });
  }
};

module.exports = { sendMessage, createChat, getChats, getChatById, addMessageToChat, deleteChatById, getRelatedFiles, regenerateMessage };
