const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const fileContextStore = require('../utils/fileContextStore');
const { extractPdfText } = require('../utils/pdfExtract');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_TEXT_CHARS = 12000; // cap stored text to avoid huge prompts
const PARTIAL_THRESHOLD = 50; // chars below this = partial extraction

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/* ── Multer — memory storage (no disk writes) ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload a PDF, TXT, or DOCX file.'));
    }
  },
});

/* ── Text extraction — never throws, always returns { text, extracted, reason } ──
   extracted: true | 'partial' | false
   reason:    'ok' | 'sparse' | 'no_content' | 'password_protected' | 'corrupted' |
              'empty' | 'read_error'
*/
const extractText = async (buffer, mimetype) => {
  /* ── PDF ── */
  if (mimetype === 'application/pdf') {
    const { text, method } = await extractPdfText(buffer, 'uploaded-file.pdf');
    console.log(`[DataMgmt] PDF extraction: method=${method}, chars=${text?.length ?? 0}`);

    if (method === 'failed' || !text) {
      // Probe pdf-parse directly to identify WHY it failed
      let reason = 'no_content';
      try {
        await pdfParse(buffer, { max: 1 });
      } catch (probeErr) {
        const msg = (probeErr.message || '').toLowerCase();
        if (msg.includes('password') || msg.includes('encrypt')) {
          reason = 'password_protected';
        } else if (
          msg.includes('invalid pdf') ||
          msg.includes('bad xref') ||
          msg.includes('corrupt') ||
          msg.includes('unexpected end')
        ) {
          reason = 'corrupted';
        }
      }
      console.log(`[DataMgmt] PDF extraction failed — reason: ${reason}`);
      return { text: '', extracted: false, reason };
    }

    if (text.length < PARTIAL_THRESHOLD) {
      console.log(`[DataMgmt] PDF extraction partial — ${text.length} chars`);
      return { text, extracted: 'partial', reason: 'sparse' };
    }

    return { text, extracted: true, reason: 'ok' };
  }

  /* ── Plain text ── */
  if (mimetype === 'text/plain') {
    try {
      const text = buffer.toString('utf-8').trim();
      if (!text) return { text: '', extracted: false, reason: 'empty' };
      if (text.length < PARTIAL_THRESHOLD) return { text, extracted: 'partial', reason: 'sparse' };
      return { text, extracted: true, reason: 'ok' };
    } catch (err) {
      console.warn('[DataMgmt] TXT read error:', err.message);
      return { text: '', extracted: false, reason: 'read_error' };
    }
  }

  /* ── DOCX ── */
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.messages?.length) {
        console.warn('[DataMgmt] DOCX warnings:', result.messages.map((m) => m.message).join(', '));
      }
      const text = (result.value || '').trim();
      if (!text) return { text: '', extracted: false, reason: 'empty' };
      if (text.length < PARTIAL_THRESHOLD) return { text, extracted: 'partial', reason: 'sparse' };
      return { text, extracted: true, reason: 'ok' };
    } catch (err) {
      console.warn('[DataMgmt] DOCX extraction error:', err.message);
      return { text: '', extracted: false, reason: 'read_error' };
    }
  }

  return { text: '', extracted: false, reason: 'unsupported' };
};

/* ── Build the user-facing message for a failed extraction ── */
const failureMessage = (reason) => {
  if (reason === 'password_protected') {
    return 'File uploaded. This PDF is password-protected and cannot be processed.';
  }
  if (reason === 'corrupted') {
    return 'File uploaded. This file appears to be corrupted or unsupported.';
  }
  return 'File uploaded, but content could not be extracted.';
};

/* ── POST /api/file/upload ── */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { text, extracted, reason } = await extractText(req.file.buffer, req.file.mimetype);
    const trimmed = text.trim();

    // Always store — even when extraction fails (filename is still useful for the UI)
    fileContextStore.set(req.user._id.toString(), {
      text      : trimmed.slice(0, MAX_TEXT_CHARS),
      filename  : req.file.originalname,
      extracted,
    });

    /* ── Case 1: Extraction completely failed ── */
    if (extracted === false) {
      return res.status(200).json({
        success  : true,
        extracted: false,
        message  : failureMessage(reason),
        data     : { filename: req.file.originalname, charCount: 0 },
      });
    }

    /* ── Case 2: Partial extraction (very little text) ── */
    if (extracted === 'partial') {
      return res.status(200).json({
        success  : true,
        extracted: 'partial',
        message  : 'File uploaded, but only limited content was extracted.',
        data     : { filename: req.file.originalname, charCount: trimmed.length },
      });
    }

    /* ── Case 3: Full success ── */
    return res.status(200).json({
      success  : true,
      extracted: true,
      message  : 'File processed successfully.',
      data     : { filename: req.file.originalname, charCount: trimmed.length },
    });

  } catch (err) {
    console.error('[DataMgmt] Unexpected upload error:', err.message);
    // Even on unexpected errors, never return 500 — keep upload "successful"
    if (req.file) {
      fileContextStore.set(req.user._id.toString(), {
        text    : '',
        filename: req.file.originalname,
        extracted: false,
      });
    }
    return res.status(200).json({
      success  : true,
      extracted: false,
      message  : 'File uploaded, but content could not be extracted.',
      data     : { filename: req.file?.originalname || 'Unknown file', charCount: 0 },
    });
  }
};

/* ── DELETE /api/file/context — clear on logout ── */
const clearFileContext = (req, res) => {
  fileContextStore.delete(req.user._id.toString());
  return res.status(200).json({ success: true });
};

/* ── GET /api/file/context — return stored text for current user ── */
const getFileContext = (req, res) => {
  const fileCtx = fileContextStore.get(req.user._id.toString());
  if (!fileCtx) {
    return res.status(200).json({ success: true, data: null });
  }
  return res.status(200).json({
    success: true,
    data: {
      filename : fileCtx.filename,
      text     : fileCtx.text,
      charCount: fileCtx.text.length,
      extracted: fileCtx.extracted,
    },
  });
};

/* ── POST /api/file/chat — answer a question using ONLY the stored file content ── */
const chatWithFile = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const fileCtx = fileContextStore.get(req.user._id.toString());
    if (!fileCtx || !fileCtx.text) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Please upload a file first.' });
    }

    const systemPrompt = `You are a document assistant. Answer questions based ONLY on the document content provided below. Do NOT use any external knowledge or make up information. If the answer cannot be found in the document, respond exactly with: "Answer not found in uploaded document."

Document: "${fileCtx.filename}"
Content:
${fileCtx.text}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message.trim() },
      ],
    });

    const reply = completion.choices[0]?.message?.content || 'No response generated.';
    return res.status(200).json({ success: true, data: { reply } });
  } catch (err) {
    console.error('File chat error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to process your question.' });
  }
};

module.exports = { upload, uploadFile, clearFileContext, getFileContext, chatWithFile };
