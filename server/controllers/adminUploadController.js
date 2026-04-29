const multer = require('multer');
const https = require('https');
const http = require('http');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');
const { getPineconeIndex } = require('../utils/pineconeClient');

/* ── Config ── */
const MAX_FILE_SIZE = parseInt(process.env.MAX_ADMIN_FILE_SIZE, 10) || 10 * 1024 * 1024; // 10 MB
const CHUNK_SIZE = 800; // characters per chunk

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/* ── Multer — memory storage ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only PDF, TXT, and DOCX are allowed.'));
    }
  },
});

/* ── OpenAI embedding client ── */
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ── Text extraction ── */
const extractText = async (buffer, mimetype) => {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text || '';
  }
  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  throw new Error('Unsupported file type.');
};

/* ── Split text into fixed-size chunks ── */
const chunkText = (text, size = CHUNK_SIZE) => {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk) chunks.push(chunk);
    i += size;
  }
  return chunks;
};

/* ── Get embeddings for all chunks in one batched API call ── */
const getEmbeddings = async (chunks) => {
  console.log(`[Admin Upload] Calling OpenAI embeddings for ${chunks.length} chunks...`);
  const response = await openaiClient.embeddings.create({
    model: 'text-embedding-3-large',
    input: chunks,
    dimensions: 1024, // must match Pinecone index dimension
    encoding_format: 'float',
  });

  if (!response.data || response.data.length === 0) {
    throw new Error('OpenAI returned no embeddings.');
  }

  console.log(`[Admin Upload] Received ${response.data.length} embeddings, dim=${response.data[0]?.embedding?.length}`);
  console.log(`[Admin Upload] Sample embedding item keys:`, Object.keys(response.data[0] || {}));

  // Return full response so caller can use .data.map() with .embedding field
  return response;
};

/* ── Admin key middleware ── */
const requireAdminKey = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_SECRET_KEY || '0000';
  if (key !== expected) {
    return res.status(403).json({ success: false, message: 'Invalid admin key.' });
  }
  next();
};

/* ── POST /api/admin/upload ── */
const adminUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { originalname, buffer, mimetype } = req.file;
    console.log(`[Admin Upload] Processing: ${originalname}`);

    // 1. Extract text
    let rawText;
    try {
      rawText = await extractText(buffer, mimetype);
    } catch (err) {
      return res.status(422).json({ success: false, message: err.message });
    }

    const text = rawText.trim();
    if (!text) {
      return res.status(400).json({ success: false, message: 'File appears to be empty or unreadable.' });
    }

    // 2. Chunk text
    const chunks = chunkText(text);
    if (!chunks.length) {
      return res.status(400).json({ success: false, message: 'No content could be extracted from the file.' });
    }

    console.log(`[Admin Upload] ${chunks.length} chunks from "${originalname}"`);

    // 3. Embed all chunks in a single batched OpenAI call
    const embeddingResponse = await getEmbeddings(chunks);

    console.log(`[Admin Upload] Embeddings data length: ${embeddingResponse.data.length}`);
    console.log(`[Admin Upload] Chunks length: ${chunks.length}`);

    if (embeddingResponse.data.length !== chunks.length) {
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddingResponse.data.length}`);
    }

    const timestamp = Date.now();
    const safeFilename = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

    const vectors = embeddingResponse.data.map((e, i) => ({
      id: `admin-${timestamp}-${i}`,
      values: Array.from(e.embedding), // force plain JS array — SDK may return Proxy/Float32Array
      metadata: {
        text: chunks[i] || '',
        filename: originalname,
        tag: 'admin',
        role: 'admin',
        pdf_url: '',
        chunkIndex: i,
        uploadedAt: new Date().toISOString(),
      },
    }));

    console.log(`[Admin Upload] Vectors length: ${vectors.length}`);
    console.log(`[Admin Upload] First vector values length: ${vectors[0]?.values?.length}`);
    console.log(`[Admin Upload] First vector values type: ${typeof vectors[0]?.values}`);
    console.log(`[Admin Upload] First vector isArray: ${Array.isArray(vectors[0]?.values)}`);
    console.log(`[Admin Upload] First vector sample values: ${vectors[0]?.values?.slice(0, 3)}`);

    if (!vectors.length) {
      throw new Error('No vectors generated from embeddings.');
    }

    const invalidVectors = vectors.filter((v) => !v.values || !Array.isArray(v.values) || v.values.length === 0);
    if (invalidVectors.length > 0) {
      throw new Error(`${invalidVectors.length} vector(s) have missing or empty values array.`);
    }

    // 4. Upsert into Pinecone in batches of 100
    console.log(`[Admin Upload] Storing ${vectors.length} vectors in Pinecone...`);
    console.log(`[Admin Upload] Sample vector:`, JSON.stringify({ id: vectors[0]?.id, valuesLen: vectors[0]?.values?.length, metadata: vectors[0]?.metadata }));
    const pineconeIndex = getPineconeIndex();
    const BATCH_SIZE = 100;
    for (let b = 0; b < vectors.length; b += BATCH_SIZE) {
      const batch = vectors.slice(b, b + BATCH_SIZE);
      console.log(`[Admin Upload] Sending batch of ${batch.length} to Pinecone...`);
      try {
        const response = await pineconeIndex.upsert({ records: batch });
        console.log(`[Admin Upload] Pinecone response:`, response);
      } catch (pineconeErr) {
        console.error(`[Admin Upload] Pinecone Error FULL:`, pineconeErr);
        console.error(`[Admin Upload] Pinecone Error message:`, pineconeErr.message);
        console.error(`[Admin Upload] Pinecone Error stack:`, pineconeErr.stack);
        throw pineconeErr;
      }
    }

    console.log(`[Admin Upload] ✅ Stored ${vectors.length} vectors for "${originalname}"`);

    return res.status(200).json({
      success: true,
      message: 'File processed and stored successfully.',
      data: {
        filename: originalname,
        chunks: vectors.length,
        charCount: text.length,
      },
    });
  } catch (err) {
    console.error('[Admin Upload] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to process and store file.',
    });
  }
};

/* ── Fetch a URL and return its content as a Buffer ── */
const fetchUrlAsBuffer = (url) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching URL`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });

/* ── POST /api/admin/upload-url  —  ingest a PDF from a URL ── */
const adminUploadUrl = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, message: 'url is required.' });
    }

    const trimmedUrl = url.trim();
    console.log(`[Admin Upload URL] Fetching: ${trimmedUrl}`);

    let buffer;
    try {
      buffer = await fetchUrlAsBuffer(trimmedUrl);
    } catch (fetchErr) {
      return res.status(422).json({ success: false, message: `Could not fetch URL: ${fetchErr.message}` });
    }

    // Treat all URL-fetched content as PDF (only PDFs make sense as links)
    const mimetype = 'application/pdf';
    const originalname = trimmedUrl.split('/').pop().split('?')[0] || 'document.pdf';

    let rawText;
    try {
      rawText = await extractText(buffer, mimetype);
    } catch (err) {
      return res.status(422).json({ success: false, message: err.message });
    }

    const text = rawText.trim();
    if (!text) {
      return res.status(400).json({ success: false, message: 'PDF appears to be empty or unreadable.' });
    }

    const chunks = chunkText(text);
    if (!chunks.length) {
      return res.status(400).json({ success: false, message: 'No content could be extracted.' });
    }

    console.log(`[Admin Upload URL] ${chunks.length} chunks from "${originalname}"`);

    const embeddingResponse = await getEmbeddings(chunks);

    if (embeddingResponse.data.length !== chunks.length) {
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddingResponse.data.length}`);
    }

    const timestamp = Date.now();
    const vectors = embeddingResponse.data.map((e, i) => ({
      id: `admin-url-${timestamp}-${i}`,
      values: Array.from(e.embedding),
      metadata: {
        text: chunks[i] || '',
        filename: originalname,
        tag: 'admin',
        role: 'admin',
        pdf_url: trimmedUrl,
        chunkIndex: i,
        uploadedAt: new Date().toISOString(),
      },
    }));

    const pineconeIndex = getPineconeIndex();
    const BATCH_SIZE = 100;
    for (let b = 0; b < vectors.length; b += BATCH_SIZE) {
      await pineconeIndex.upsert({ records: vectors.slice(b, b + BATCH_SIZE) });
    }

    console.log(`[Admin Upload URL] ✅ Stored ${vectors.length} vectors for "${originalname}" (url: ${trimmedUrl})`);

    return res.status(200).json({
      success: true,
      message: 'URL processed and stored successfully.',
      data: { filename: originalname, url: trimmedUrl, chunks: vectors.length, charCount: text.length },
    });
  } catch (err) {
    console.error('[Admin Upload URL] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Failed to process URL.' });
  }
};

module.exports = { upload, requireAdminKey, adminUpload, adminUploadUrl };
