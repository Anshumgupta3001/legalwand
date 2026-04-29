/**
 * Multi-file disk-storage upload routes  —  /api/upload
 *
 * WHY "Payload Too Large" happened:
 *   Express's default JSON body parser caps at 100 kb. Even with a higher
 *   limit, sending large files as base64 JSON wastes ~33 % extra bandwidth
 *   and requires the full payload to be buffered in RAM before parsing.
 *   The correct approach is multipart/form-data handled by multer.
 *
 * WHY disk storage beats memory storage for large files:
 *   multer.memoryStorage() holds the entire file in the Node.js heap.
 *   A single 50 MB upload = 50 MB of heap pressure; concurrent uploads
 *   multiply this and can OOM-kill the process. diskStorage() streams
 *   incoming bytes directly to disk, keeping heap usage flat.
 *
 * WHY streaming beats buffering when serving files:
 *   fs.createReadStream() sends data in small chunks through the HTTP
 *   response pipe. No matter how large the file, RAM usage stays near zero
 *   during the download — unlike fs.readFileSync() which loads everything.
 *
 * Realistic limits for MERN without cloud storage:
 *   20–100 MB   : safe on any server with 1 GB+ RAM
 *   100–500 MB  : safe with disk storage + streaming; avoid many simultaneous
 *                 large uploads (each ties up an OS file descriptor + pipe)
 *   500 MB+     : needs chunked / resumable upload strategy
 *                 (tus protocol, presigned S3 URLs, etc.)
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');
const http    = require('http');
const mammoth  = require('mammoth');
const OpenAI   = require('openai');
const { extractPdfText } = require('../utils/pdfExtract');
const { getPineconeIndex } = require('../utils/pineconeClient');
const { protect } = require('../middleware/authMiddleware');

/* ── OpenAI client ── */
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ── Strip HTML tags to extract readable text (for webpage scraping) ── */
const extractHtmlText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* ── Text extraction (reads from disk path) ── */
const EMBEDDABLE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const extractTextFromFile = async (filePath, mimetype, originalname) => {
  const buffer = fs.readFileSync(filePath);
  if (mimetype === 'application/pdf') {
    const { text, method } = await extractPdfText(buffer, originalname || filePath);
    if (method === 'failed' || !text) return '';
    return text;
  }
  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  return '';
};

const chunkText = (text, size = 800) => {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk) chunks.push(chunk);
    i += size;
  }
  return chunks;
};

/* ── Sequential / batch delay helpers ── */
const FETCH_DELAY_MS   = parseInt(process.env.FETCH_DELAY_MS   ?? '1000', 10);
const FETCH_BATCH_SIZE = parseInt(process.env.FETCH_BATCH_SIZE ?? '5',    10);
const UPLOAD_DELAY_MS  = parseInt(process.env.UPLOAD_DELAY_MS  ?? '1000', 10);
const UPLOAD_BATCH_SIZE = parseInt(process.env.UPLOAD_BATCH_SIZE ?? '5',  10);
// Embedding batch processing — avoids OpenAI API input limits and per-request timeouts
const EMBED_BATCH_SIZE       = parseInt(process.env.EMBED_BATCH_SIZE        ?? '50',  10);
const EMBED_DELAY_MS         = parseInt(process.env.EMBED_DELAY_MS          ?? '200', 10);
const ASYNC_CHUNK_THRESHOLD  = parseInt(process.env.ASYNC_CHUNK_THRESHOLD   ?? '100', 10);
const MAX_BATCH_RETRIES      = 2; // retry each embedding batch up to 2 extra times
const JOB_TTL_MS             = 2 * 60 * 60 * 1000; // 2 h — auto-expire old jobs
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── URL cleaning & validation helpers ── */
const cleanUrl = (raw) =>
  (raw || '').trim().replace(/^["""''\u201C\u201D\u2018\u2019\s]+|["""''\u201C\u201D\u2018\u2019\s]+$/g, '').trim();

const isValidUrl = (u) => { try { new URL(u); return true; } catch { return false; } };

/* ── Suppress "TT: undefined function" noise from pdf-parse — patched ONCE at module load.
   Per-call patching causes a stack overflow when concurrent requests each save the already-
   patched warn as their `orig`, creating a fn5→fn4→…→native chain that blows the stack.
   We also set the global flag so pdfExtract.js's lazy patcher skips re-patching. ── */
if (!globalThis._pdfjsConsolePatchApplied) {
  globalThis._pdfjsConsolePatchApplied = true;
  const _origWarn = console.warn;
  console.warn = (...args) => {
    const msg = String(args[0] ?? '');
    if (msg.startsWith('TT:') || msg.includes('undefined function')) return;
    _origWarn.apply(console, args);
  };
}

/* ── In-memory preview store (TTL = 1 hour) ── */
const previewStore = new Map();
const PREVIEW_TTL_MS = 60 * 60 * 1000;

const setPreview = (id, data) => {
  previewStore.set(id, { ...data, expiresAt: Date.now() + PREVIEW_TTL_MS });
};

const consumePreview = (id) => {
  const entry = previewStore.get(id);
  if (!entry) return null;
  previewStore.delete(id); // one-time use
  return Date.now() <= entry.expiresAt ? entry : null;
};

/* ── In-memory async job store (TTL = 2 h) ──
   Tracks background embedding/upsert jobs for large files.
   Shape: { jobId, status, totalChunks, processedChunks, failedChunks,
            filename, createdAt, completedAt, error }           ── */
const jobStore = new Map();

const createJob = (jobId, totalChunks, filename) => {
  jobStore.set(jobId, {
    jobId, status: 'processing', totalChunks,
    processedChunks: 0, failedChunks: 0,
    filename, createdAt: Date.now(), completedAt: null, error: null,
  });
};

const updateJob = (jobId, updates) => {
  const job = jobStore.get(jobId);
  if (job) jobStore.set(jobId, { ...job, ...updates });
};

const getJob = (jobId) => {
  const job = jobStore.get(jobId);
  if (!job) return null;
  if (Date.now() - job.createdAt > JOB_TTL_MS) { jobStore.delete(jobId); return null; }
  return job;
};

/* ── Shared: chunk + embed (batched) + upsert into Pinecone ──
   Processes EMBED_BATCH_SIZE chunks per OpenAI call to stay within API
   limits and avoid per-request timeouts on large documents.
   Each failed batch is retried up to MAX_BATCH_RETRIES times.
   Accepts optional jobId to report progress to the in-memory job store.
   Returns { processedChunks, failedChunks, totalChunks }.            ── */
const storeTextToPinecone = async (text, originalname, pdf_url, userId, jobId = null) => {
  const chunks = chunkText(text);
  if (!chunks.length) {
    const msg = 'No content chunks could be generated.';
    if (jobId) updateJob(jobId, { status: 'failed', error: msg, completedAt: Date.now() });
    throw new Error(msg);
  }

  const totalChunks  = chunks.length;
  const totalBatches = Math.ceil(totalChunks / EMBED_BATCH_SIZE);
  if (jobId) updateJob(jobId, { totalChunks });

  console.log(`[Upload] "${originalname}" — ${totalChunks} chunks, ${totalBatches} embed batch(es) of ${EMBED_BATCH_SIZE}`);

  const pineconeIndex = getPineconeIndex();
  const timestamp     = Date.now();
  let processedChunks = 0;
  let failedChunks    = 0;

  for (let batchStart = 0; batchStart < chunks.length; batchStart += EMBED_BATCH_SIZE) {
    const batchChunks = chunks.slice(batchStart, batchStart + EMBED_BATCH_SIZE);
    const batchNum    = Math.floor(batchStart / EMBED_BATCH_SIZE) + 1;

    // ── Embed with retry ──
    let embeddingData = null;
    for (let attempt = 0; attempt <= MAX_BATCH_RETRIES; attempt++) {
      try {
        const resp = await openaiClient.embeddings.create({
          model: 'text-embedding-3-large',
          input: batchChunks,
          dimensions: 1024,
          encoding_format: 'float',
        });
        embeddingData = resp.data;
        break;
      } catch (err) {
        console.warn(`[Upload] Batch ${batchNum}/${totalBatches} embed attempt ${attempt + 1} failed:`, err.message);
        if (attempt < MAX_BATCH_RETRIES) await sleep(1000 * Math.pow(2, attempt)); // 1s, 2s
      }
    }

    if (!embeddingData) {
      failedChunks += batchChunks.length;
      if (jobId) updateJob(jobId, { processedChunks, failedChunks });
      console.error(`[Upload] Batch ${batchNum}/${totalBatches} failed after all retries — skipping`);
      if (batchStart + EMBED_BATCH_SIZE < chunks.length) await sleep(EMBED_DELAY_MS);
      continue;
    }

    // ── Upsert to Pinecone ──
    try {
      const vectors = embeddingData.map((e, i) => ({
        id: `user-${timestamp}-${batchStart + i}`,
        values: Array.from(e.embedding),
        metadata: {
          text: batchChunks[i] || '',
          filename: originalname,
          tag: 'user',
          role: 'user',
          userId: userId ? userId.toString() : '',
          pdf_url,
          chunkIndex: batchStart + i,
          uploadedAt: new Date().toISOString(),
        },
      }));

      const PINE_BATCH = 100;
      for (let p = 0; p < vectors.length; p += PINE_BATCH) {
        await pineconeIndex.upsert({ records: vectors.slice(p, p + PINE_BATCH) });
      }
      processedChunks += batchChunks.length;
    } catch (upsertErr) {
      failedChunks += batchChunks.length;
      console.error(`[Upload] Batch ${batchNum}/${totalBatches} upsert failed:`, upsertErr.message);
    }

    if (jobId) updateJob(jobId, { processedChunks, failedChunks });
    console.log(`[Upload] Batch ${batchNum}/${totalBatches} done — ${processedChunks} stored, ${failedChunks} failed`);
    if (batchStart + EMBED_BATCH_SIZE < chunks.length) await sleep(EMBED_DELAY_MS);
  }

  const finalStatus = failedChunks === 0 ? 'completed'
    : failedChunks === totalChunks ? 'failed' : 'partial';

  if (jobId) {
    updateJob(jobId, {
      status: finalStatus, processedChunks, failedChunks, completedAt: Date.now(),
      error: failedChunks > 0 ? `${failedChunks} of ${totalChunks} chunks failed to index` : null,
    });
  }

  console.log(`[Upload] ✅ "${originalname}" — ${processedChunks}/${totalChunks} stored, ${failedChunks} failed`);
  return { processedChunks, failedChunks, totalChunks };
};

/* ── Store file chunks in Pinecone (fire-and-forget, errors logged not thrown) ── */
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

/* urlOverride: when provided, used as pdf_url instead of the local file URL */
const storeToPinecone = async (filePath, mimetype, originalname, diskFilename, userId, urlOverride) => {
  try {
    if (!EMBEDDABLE_MIMES.has(mimetype)) {
      console.log(`[Upload] Skipping Pinecone for unsupported type: ${mimetype}`);
      return;
    }

    const rawText = await extractTextFromFile(filePath, mimetype, originalname);
    const text = rawText.trim();
    if (!text) {
      console.warn(`[Upload] No extractable text in "${originalname}" — skipping Pinecone`);
      return;
    }

    const pdf_url = urlOverride || `${BASE_URL}/api/upload/files/${encodeURIComponent(diskFilename)}`;
    const { processedChunks, totalChunks } = await storeTextToPinecone(text, originalname, pdf_url, userId);
    console.log(`[Upload] ✅ Pinecone: ${processedChunks}/${totalChunks} vectors for "${originalname}"`);
  } catch (err) {
    console.error(`[Upload] ❌ Pinecone storage failed for "${originalname}":`, err.message);
  }
};

/* ── Fetch a URL and return its body as a Buffer + content-type ──
   FETCH_TIMEOUT_MS controls the socket-level timeout (default 30 s).
   Without it, a slow government server can stall the TCP connection
   indefinitely, causing the client-side axios timeout to fire first. ── */
const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS ?? '30000', 10);

const fetchUrlAsBuffer = (url) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode === 404) return reject(new Error('File not found (HTTP 404)'));
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} when fetching URL`));

      const contentType = res.headers['content-type'] || '';
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
      res.on('error', reject);
    }).on('error', reject);

    // Kill stalled connections — without this, slow servers hang until the
    // client-side axios timeout fires (15 s base), giving a confusing error.
    req.setTimeout(FETCH_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`));
    });
  });

/* ── Store scraped/URL chunks in Pinecone — handles PDF and HTML content ── */
const storeToPineconeFromBuffer = async (buffer, originalname, pdf_url, userId, contentType = '') => {
  try {
    let text = '';

    const looksLikePdf =
      contentType.includes('pdf') ||
      originalname.toLowerCase().endsWith('.pdf');

    if (looksLikePdf) {
      // Known PDF — use full extraction with OCR fallback
      const { text: extracted } = await extractPdfText(buffer, originalname);
      text = extracted;
    } else {
      // Try PDF extraction first (URL might serve a PDF without proper Content-Type)
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        if (data.text && data.text.trim()) text = data.text.trim();
      } catch (_) { /* not a PDF — fall through to HTML extraction */ }

      // Fallback: extract readable text from HTML (webpage scraping)
      if (!text) {
        text = extractHtmlText(buffer.toString('utf-8'));
      }
    }

    if (!text) {
      console.warn(`[Upload URL] No extractable text from "${originalname}" — skipping Pinecone`);
      return;
    }

    const { processedChunks, totalChunks } = await storeTextToPinecone(text, originalname, pdf_url, userId);
    console.log(`[Upload URL] ✅ Pinecone: ${processedChunks}/${totalChunks} vectors for "${originalname}" (user: ${userId}, url: ${pdf_url})`);
  } catch (err) {
    console.error(`[Upload URL] ❌ Pinecone storage failed for "${originalname}":`, err.message);
    throw err; // re-throw so the route can return a proper error response
  }
};

const router = express.Router();

/* ── Ensure uploads directory exists ── */
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* ── Allowed MIME types ── */
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
]);

/* ── Disk storage: stream straight to disk, never buffered in RAM ── */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    // Sanitize: keep only safe characters to prevent path-traversal
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB per file
    files: 10,                    // max 10 files per request
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(
        `Unsupported file type: ${file.mimetype}. ` +
        'Allowed: PDF, Excel, CSV, Word documents, and images.'
      ));
    }
  },
});

/* ──────────────────────────────────────────────
   POST /api/upload  —  upload up to 10 files
────────────────────────────────────────────── */
router.post('/', protect, (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'File too large. Maximum size is 200 MB per file.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: 'Too many files. Maximum is 10 files per request.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Unexpected field name. Use "files" as the form field.' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Upload failed.' });
    }

    if (!req.files || req.files.length === 0) {
      console.warn('[Upload] POST /api/upload — no files in request');
      return res.status(400).json({ success: false, message: 'No files received.' });
    }

    // Require a source URL — it is stored as pdf_url in Pinecone for every chunk
    const sourceUrl = (req.body.url || '').trim();
    if (!sourceUrl) {
      return res.status(400).json({ success: false, message: 'A source URL is required for file uploads.' });
    }

    const uploaded = req.files.map((f) => ({
      originalname: f.originalname,
      filename:     f.filename,
      size:         parseFloat((f.size / (1024 * 1024)).toFixed(2)), // MB
      mimetype:     f.mimetype,
    }));

    console.log(`[Upload] ✅ ${uploaded.length} file(s) saved to disk (source URL: ${sourceUrl}):`);
    uploaded.forEach((f) => console.log(`   • ${f.filename} (${f.size} MB, ${f.mimetype})`));

    // Fire-and-forget: store embeddable files in Pinecone using the user-provided URL
    req.files.forEach((f) => {
      storeToPinecone(f.path, f.mimetype, f.originalname, f.filename, req.user._id, sourceUrl);
    });

    return res.status(200).json({
      success: true,
      message: `${uploaded.length} file(s) uploaded successfully.`,
      data:    uploaded,
    });
  });
});

/* ──────────────────────────────────────────────
   GET /api/upload/files  —  list stored files
────────────────────────────────────────────── */
router.get('/files', protect, (_req, res) => {
  try {
    const allEntries = fs.readdirSync(UPLOADS_DIR);
    const visible    = allEntries.filter((name) => !name.startsWith('.'));

    console.log(`[Upload] GET /api/upload/files — uploads dir: ${UPLOADS_DIR}`);
    console.log(`[Upload] Total entries: ${allEntries.length}, visible: ${visible.length}`);

    const files = visible
      .map((name) => {
        const stat = fs.statSync(path.join(UPLOADS_DIR, name));
        return {
          name,
          size:       parseFloat((stat.size / (1024 * 1024)).toFixed(2)),
          // mtime (last-modified) is reliable across all OS/filesystems;
          // birthtime can be 0 on Linux ext4 if noatime is set
          uploadedAt: stat.mtime,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    console.log(`[Upload] Returning ${files.length} file(s):`, files.map((f) => `${f.name} (${f.size} MB)`));

    return res.status(200).json({ success: true, data: files });
  } catch (err) {
    console.error('[Upload] ❌ Error reading uploads dir:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ──────────────────────────────────────────────
   GET /api/upload/files/:filename  —  stream a file
   Uses createReadStream — never loads file into RAM
────────────────────────────────────────────── */
router.get('/files/:filename', protect, (req, res) => {
  // path.basename prevents path-traversal attacks (e.g. ../../etc/passwd)
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.pdf':  'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls':  'application/vnd.ms-excel',
    '.csv':  'text/csv',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc':  'application/msword',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.txt':  'text/plain',
  };

  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const stream = fs.createReadStream(filePath);
  stream.on('error', () =>
    res.status(500).json({ success: false, message: 'Error reading file.' })
  );
  stream.pipe(res);
});

/* ──────────────────────────────────────────────
   POST /api/upload/url  —  ingest a PDF from URL
   Body: { url: "https://..." }
────────────────────────────────────────────── */
router.post('/url', protect, async (req, res) => {
  const { url } = req.body;
  if (!url || !url.trim()) {
    return res.status(400).json({ success: false, message: 'url is required.' });
  }

  const trimmedUrl = url.trim();
  console.log(`[Upload URL] Fetching: ${trimmedUrl}`);

  let buffer, contentType;
  try {
    ({ buffer, contentType } = await fetchUrlAsBuffer(trimmedUrl));
  } catch (fetchErr) {
    console.error('[Upload URL] Fetch error:', fetchErr.message);
    return res.status(422).json({ success: false, message: `Could not fetch URL: ${fetchErr.message}` });
  }

  const originalname = trimmedUrl.split('/').pop().split('?')[0] || 'page';

  try {
    await storeToPineconeFromBuffer(buffer, originalname, trimmedUrl, req.user._id, contentType);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to process content.' });
  }

  console.log(`[Upload URL] ✅ URL processed for user ${req.user._id}: ${trimmedUrl}`);
  return res.status(200).json({
    success: true,
    message: 'PDF URL processed and stored successfully.',
    data: { url: trimmedUrl, filename: originalname },
  });
});

/* ──────────────────────────────────────────────
   POST /api/upload/preview
   Upload a file + URL → extract text → return preview
   Does NOT store anything in Pinecone
────────────────────────────────────────────── */
router.post('/preview', protect, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file received.' });
    }

    const sourceUrl = (req.body.url || '').trim();
    if (!sourceUrl) {
      return res.status(400).json({ success: false, message: 'A source URL is required.' });
    }

    const { path: filePath, mimetype, originalname } = req.file;

    if (!EMBEDDABLE_MIMES.has(mimetype)) {
      return res.status(422).json({
        success: false,
        message: `Cannot extract text from this file type. Please use PDF, TXT, or DOCX.`,
      });
    }

    let rawText;
    try {
      rawText = await extractTextFromFile(filePath, mimetype, originalname);
    } catch (e) {
      return res.status(422).json({ success: false, message: `Text extraction failed: ${e.message}` });
    }

    const text = rawText.trim();
    if (!text) {
      return res.status(422).json({ success: false, message: 'No readable text found in this file.' });
    }

    const previewId = `prev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setPreview(previewId, { text, url: sourceUrl, originalname, userId: req.user._id });

    const words = text.split(/\s+/);
    const previewText = words.slice(0, 800).join(' ');
    const fullText    = words.slice(0, 20000).join(' '); // client uses this for Show More

    console.log(`[Preview] "${originalname}" — ${words.length} words, id: ${previewId}`);
    return res.status(200).json({
      success: true,
      data: { previewId, previewText, fullText, wordCount: words.length, filename: originalname, url: sourceUrl },
    });
  });
});

/* ──────────────────────────────────────────────
   POST /api/upload/preview-url
   Fetch a URL → scrape/parse text → return preview
   Does NOT store anything in Pinecone
────────────────────────────────────────────── */
router.post('/preview-url', protect, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, message: 'url is required.' });

  const trimmedUrl = cleanUrl(url);
  if (!trimmedUrl || !isValidUrl(trimmedUrl)) {
    return res.status(400).json({ success: false, message: 'Invalid URL format.' });
  }

  let buffer, contentType;
  try {
    ({ buffer, contentType } = await fetchUrlAsBuffer(trimmedUrl));
  } catch (fetchErr) {
    return res.status(422).json({ success: false, message: `Could not fetch URL: ${fetchErr.message}` });
  }

  const originalname = trimmedUrl.split('/').pop().split('?')[0] || 'page';
  const looksLikePdf = contentType.includes('pdf') || originalname.toLowerCase().endsWith('.pdf');

  let text = '';

  if (looksLikePdf) {
    const { text: extracted, method } = await extractPdfText(buffer, originalname);
    text = extracted;
    if (!text) {
      return res.status(422).json({ success: false, message: method === 'failed'
        ? 'Unable to extract text from this PDF. It may be a complex image scan or corrupted.'
        : 'No readable content could be extracted from this PDF.' });
    }
  } else {
    try { const pdfParse = require('pdf-parse'); const d = await pdfParse(buffer); if (d.text?.trim()) text = d.text.trim(); } catch (_) {}
    if (!text) text = extractHtmlText(buffer.toString('utf-8'));
  }

  if (!text) {
    return res.status(422).json({ success: false, message: 'No readable content could be extracted from this URL.' });
  }

  const previewId = `prev-url-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  setPreview(previewId, { text, url: trimmedUrl, originalname, userId: req.user._id });

  const words = text.split(/\s+/);
  const previewText = words.slice(0, 800).join(' ');
  const fullText    = words.slice(0, 20000).join(' '); // client uses this for Show More

  console.log(`[Preview URL] "${trimmedUrl}" — ${words.length} words, id: ${previewId}`);
  return res.status(200).json({
    success: true,
    data: { previewId, previewText, fullText, wordCount: words.length, filename: originalname, url: trimmedUrl },
  });
});

/* ──────────────────────────────────────────────
   POST /api/upload/confirm
   Confirm a previewed item → chunk + embed + upsert
   Consumes the previewId (one-time use).
   Large files (> ASYNC_CHUNK_THRESHOLD chunks) are processed in the
   background — the route returns immediately with a jobId for polling.
────────────────────────────────────────────── */
router.post('/confirm', protect, async (req, res) => {
  const { previewId } = req.body;
  if (!previewId) {
    return res.status(400).json({ success: false, message: 'previewId is required.' });
  }

  const preview = consumePreview(previewId);
  if (!preview) {
    return res.status(404).json({ success: false, message: 'Preview expired or not found. Please preview again.' });
  }

  if (preview.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Unauthorized.' });
  }

  const chunks = chunkText(preview.text);

  // Large file: process in background, return jobId immediately
  if (chunks.length > ASYNC_CHUNK_THRESHOLD) {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    createJob(jobId, chunks.length, preview.originalname);

    storeTextToPinecone(preview.text, preview.originalname, preview.url, req.user._id, jobId)
      .catch((err) => {
        console.error(`[Confirm] Background job ${jobId} failed:`, err.message);
        updateJob(jobId, { status: 'failed', error: err.message, completedAt: Date.now() });
      });

    console.log(`[Confirm] Large file "${preview.originalname}" (${chunks.length} chunks) → async job ${jobId}`);
    return res.status(202).json({
      success: true,
      message: 'Large file is being processed in the background.',
      data: { status: 'processing_started', jobId, totalChunks: chunks.length, filename: preview.originalname, url: preview.url },
    });
  }

  // Small file: process synchronously
  try {
    const { processedChunks, totalChunks } = await storeTextToPinecone(
      preview.text,
      preview.originalname,
      preview.url,
      req.user._id,
    );
    return res.status(200).json({
      success: true,
      message: 'Content stored in knowledge base.',
      data: { chunks: processedChunks, totalChunks, url: preview.url, filename: preview.originalname },
    });
  } catch (err) {
    console.error('[Upload Confirm] ❌', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Failed to store content.' });
  }
});

/* ──────────────────────────────────────────────
   POST /api/upload/preview-urls
   Body: { urls: ["url1", "url2", ...] }
   Fetches each URL sequentially (FETCH_DELAY_MS between each).
   Stores extracted text in previewStore — does NOT write to Pinecone.
   Returns array: [{ url, status:'ready'|'failed', previewId?, previewText?,
                     wordCount?, filename?, error? }]
────────────────────────────────────────────── */
router.post('/preview-urls', protect, async (req, res) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || !urls.length) {
    return res.status(400).json({ success: false, message: 'urls array is required.' });
  }

  const trimmed = urls.map((u) => (u || '').trim()).filter(Boolean);
  if (!trimmed.length) {
    return res.status(400).json({ success: false, message: 'No valid URLs provided.' });
  }

  const results = [];

  for (let i = 0; i < trimmed.length; i++) {
    const url = trimmed[i];

    // Delay between fetches (skip before the first one)
    if (i > 0) await sleep(FETCH_DELAY_MS);

    try {
      let buffer, contentType;
      ({ buffer, contentType } = await fetchUrlAsBuffer(url));

      const originalname = url.split('/').pop().split('?')[0] || 'page';
      const looksLikePdf  = contentType.includes('pdf') || originalname.toLowerCase().endsWith('.pdf');

      let text = '';
      if (looksLikePdf) {
        const { text: extracted } = await extractPdfText(buffer, originalname);
        text = extracted;
      } else {
        try { const pdfParse = require('pdf-parse'); const d = await pdfParse(buffer); if (d.text?.trim()) text = d.text.trim(); } catch (_) {}
        if (!text) text = extractHtmlText(buffer.toString('utf-8'));
      }

      if (!text) {
        results.push({ url, status: 'failed', error: 'No readable content could be extracted.' });
        console.warn(`[Preview URLs] [${i + 1}/${trimmed.length}] No text from "${url}"`);
        continue;
      }

      const previewId = `prev-urls-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      // Store full text so confirm-batch can retrieve it
      setPreview(previewId, { text, url, originalname, userId: req.user._id });

      const words       = text.split(/\s+/);
      const previewText = words.slice(0, 800).join(' ');
      const fullText    = words.slice(0, 5000).join(' '); // client uses this for Show More

      console.log(`[Preview URLs] [${i + 1}/${trimmed.length}] ✅ "${url}" — ${words.length} words, id: ${previewId}`);
      results.push({ url, status: 'ready', previewId, previewText, fullText, wordCount: words.length, filename: originalname });

    } catch (err) {
      console.error(`[Preview URLs] [${i + 1}/${trimmed.length}] ❌ "${url}":`, err.message);
      results.push({ url, status: 'failed', error: err.message || 'Fetch failed.' });
    }
  }

  const ready  = results.filter((r) => r.status === 'ready').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log(`[Preview URLs] Done — ✅ ${ready} ready, ❌ ${failed} failed`);

  return res.status(200).json({ success: true, data: results });
});

/* ──────────────────────────────────────────────
   POST /api/upload/confirm-batch
   Body: { items: [{ previewId, url }] }
   Stores each item sequentially (UPLOAD_DELAY_MS between each).
   Each chunk carries pdf_url = the URL the content came from.
   Returns { results: [...], successCount, failCount }
────────────────────────────────────────────── */
router.post('/confirm-batch', protect, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, message: 'items array is required.' });
  }

  const results = [];

  for (let i = 0; i < items.length; i++) {
    const { previewId, url } = items[i];

    // Delay between uploads (skip before the first one)
    if (i > 0) await sleep(UPLOAD_DELAY_MS);

    if (!previewId) {
      results.push({ url: url || '', status: 'failed', error: 'Missing previewId.' });
      continue;
    }

    const preview = consumePreview(previewId);
    if (!preview) {
      results.push({ url: url || '', status: 'failed', error: 'Preview expired or not found. Please preview again.' });
      continue;
    }

    // ── Data integrity: content must belong to the expected URL ──
    if (url && preview.url !== url) {
      console.warn(`[Confirm Batch] URL mismatch — expected "${url}", stored "${preview.url}" — skipping`);
      results.push({ url, status: 'failed', error: 'URL mismatch — content integrity check failed.' });
      continue;
    }

    if (preview.userId.toString() !== req.user._id.toString()) {
      results.push({ url: preview.url, status: 'failed', error: 'Unauthorized.' });
      continue;
    }

    try {
      // pdf_url = preview.url ensures each chunk carries its own source URL
      const { processedChunks } = await storeTextToPinecone(
        preview.text,
        preview.originalname,
        preview.url,
        req.user._id,
      );
      console.log(`[Confirm Batch] [${i + 1}/${items.length}] ✅ "${preview.url}" — ${processedChunks} vectors`);
      results.push({ url: preview.url, status: 'success', chunks: processedChunks });
    } catch (err) {
      console.error(`[Confirm Batch] [${i + 1}/${items.length}] ❌ "${preview.url}":`, err.message);
      results.push({ url: preview.url, status: 'failed', error: err.message || 'Storage failed.' });
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const failCount    = results.filter((r) => r.status === 'failed').length;
  console.log(`[Confirm Batch] Done — ✅ ${successCount} stored, ❌ ${failCount} failed`);

  return res.status(200).json({ success: true, data: { results, successCount, failCount } });
});

/* ──────────────────────────────────────────────
   GET /api/upload/jobs/:jobId  —  poll background job status
   Returns the job record while it exists (up to JOB_TTL_MS = 2 h).
────────────────────────────────────────────── */
router.get('/jobs/:jobId', protect, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found or expired.' });
  }
  return res.status(200).json({ success: true, data: job });
});

module.exports = router;
