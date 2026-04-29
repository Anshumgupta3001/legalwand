/**
 * Universal PDF text extraction with OpenAI Vision OCR fallback.
 *
 * Flow:
 *   1. pdf-parse  → fast text extraction for normal (text-layer) PDFs
 *   2. If extracted text is sparse (< OCR_MIN_CHARS):
 *      a. Load PDF with pdfjs-dist (pure-JS renderer, no system deps)
 *      b. Render each page to a PNG via Node.js canvas
 *      c. Send each page image to OpenAI Vision (gpt-4o-mini)
 *      d. Aggregate page texts → return combined result
 *   3. Every layer has a graceful fallback — never throws, never crashes.
 */

'use strict';

const pdfParse = require('pdf-parse');
const OpenAI   = require('openai');

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ── Tuning constants ── */
const OCR_MIN_CHARS  = 100;   // sparse threshold: below this → try OCR
const OCR_MAX_PAGES  = 15;    // safety cap on pages processed per document
const OCR_PAGE_SCALE = 2.0;   // render scale — higher = sharper text, more memory
const OCR_PAGE_DELAY = 300;   // ms between page requests (avoid OpenAI rate limits)

/* ── Vision prompt ── */
const VISION_PROMPT = `Extract all readable text from this document page.
Preserve structure including:
- Headings and subheadings
- Tables: format rows and columns clearly, preserve alignment
- Numbers, dates, and currency values (₹, Rs., INR, percentages)
- Section numbers, serial numbers, and reference codes
- Lists and bullet points
Return only the extracted text. No commentary, no preamble.`;

/* ── Clean extracted text: normalise whitespace and line breaks ── */
const normalizeText = (text) =>
  (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/* ── Suppress pdfjs-dist internal console noise ── */
const _silencedWarnPatterns = [/TT:/, /undefined function/, /Warning: PDF/i, /Error: Assertion/i];
const _patchPdfjsConsole = () => {
  if (globalThis._pdfjsConsolePatchApplied) return;
  globalThis._pdfjsConsolePatchApplied = true;
  const _origWarn  = console.warn.bind(console);
  const _origError = console.error.bind(console);
  console.warn  = (...a) => { if (!_silencedWarnPatterns.some(p => p.test(String(a[0] ?? '')))) _origWarn(...a); };
  console.error = (...a) => { if (!_silencedWarnPatterns.some(p => p.test(String(a[0] ?? '')))) _origError(...a); };
};

/* ── Render PDF pages as PNG images using pdfjs-dist + canvas,
      then extract text via OpenAI Vision ──
   Returns '' on any failure (never throws). ── */
const extractViaVision = async (buffer, filename) => {
  /* Lazy-require so the server starts even if canvas isn't compiled */
  let pdfjsLib, createCanvas;
  try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    ({ createCanvas } = require('canvas'));
  } catch (importErr) {
    console.warn('[OCR] pdfjs-dist or canvas not available — skipping Vision OCR:', importErr.message);
    return '';
  }

  _patchPdfjsConsole();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const numPages   = Math.min(totalPages, OCR_MAX_PAGES);

    console.log(`[OCR] "${filename}" — rendering ${numPages}/${totalPages} page(s) via Vision`);

    const pageTexts = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page     = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: OCR_PAGE_SCALE });
        const canvas   = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        const ctx      = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();

        // PNG preserves text sharpness better than JPEG
        const base64 = canvas.toDataURL('image/png').split(',')[1];

        const response = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${VISION_PROMPT}\n\n(Page ${pageNum} of ${numPages})`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' },
              },
            ],
          }],
          max_tokens: 2000,
        }, { timeout: 45000 });

        const pageText = response.choices[0]?.message?.content?.trim() || '';
        if (pageText) pageTexts.push(pageText);

        console.log(`[OCR]   Page ${pageNum}/${numPages}: ${pageText.length} chars extracted`);

      } catch (pageErr) {
        console.warn(`[OCR] Page ${pageNum} failed — skipping:`, pageErr.message);
        // Continue with remaining pages
      }

      if (pageNum < numPages) await new Promise(r => setTimeout(r, OCR_PAGE_DELAY));
    }

    return pageTexts.join('\n\n');

  } catch (err) {
    console.error('[OCR] Vision extraction failed:', err.message);
    return '';
  }
};

/**
 * Extract text from a PDF buffer.
 *
 * @param {Buffer} buffer       - Raw PDF file bytes
 * @param {string} [filename]   - Used only for logging
 * @returns {{ text: string, method: 'parse'|'ocr'|'failed' }}
 *
 * Never throws — callers can check `method === 'failed'` to surface an error.
 */
const extractPdfText = async (buffer, filename = 'document.pdf') => {
  /* Step 1: Standard text-layer extraction */
  let parseText = '';
  try {
    const data = await pdfParse(buffer);
    parseText = normalizeText(data.text);
  } catch (parseErr) {
    console.warn(`[PDF Extract] pdf-parse failed for "${filename}":`, parseErr.message);
  }

  /* If pdf-parse yielded sufficient text, we're done */
  if (parseText.length >= OCR_MIN_CHARS) {
    console.log(`[PDF Extract] "${filename}" — text-layer: ${parseText.length} chars`);
    return { text: parseText, method: 'parse' };
  }

  /* Step 2: Sparse text — assume scanned/image PDF, fall back to Vision OCR */
  console.log(`[PDF Extract] "${filename}" — sparse (${parseText.length} chars), trying Vision OCR…`);
  const ocrRaw = await extractViaVision(buffer, filename);
  const ocrText = normalizeText(ocrRaw);

  if (ocrText.length > 0) {
    console.log(`[PDF Extract] "${filename}" — OCR: ${ocrText.length} chars`);
    return { text: ocrText, method: 'ocr' };
  }

  /* Step 3: OCR also empty — return whatever pdf-parse had (even if sparse) */
  if (parseText.length > 0) {
    console.log(`[PDF Extract] "${filename}" — returning sparse parse text (${parseText.length} chars)`);
    return { text: parseText, method: 'parse' };
  }

  console.warn(`[PDF Extract] "${filename}" — unable to extract any text`);
  return { text: '', method: 'failed' };
};

module.exports = { extractPdfText };
