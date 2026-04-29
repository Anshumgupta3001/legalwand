const puppeteer = require('puppeteer');

/* ── Escape HTML special chars ── */
const esc = (s) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── Inline markdown → HTML (bold, italic, code) ── */
const inlineFmt = (text) =>
  esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="ic">$1</code>');

/* ── Full markdown → HTML (block-level) ── */
const mdToHtml = (raw) => {
  if (!raw) return '';
  const lines  = raw.split('\n');
  const out    = [];
  let inUl     = false;
  let inOl     = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const line of lines) {
    const t = line.trim();

    if (!t) {
      closeList();
      out.push('<div class="gap"></div>');
      continue;
    }

    /* Heading */
    if (/^#{1,6}\s/.test(t)) {
      closeList();
      out.push(`<p class="hd">${inlineFmt(t.replace(/^#{1,6}\s/, ''))}</p>`);
      continue;
    }

    /* Unordered list */
    if (/^[-*+]\s/.test(t)) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineFmt(t.replace(/^[-*+]\s/, ''))}</li>`);
      continue;
    }

    /* Ordered list */
    if (/^\d+\.\s/.test(t)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inlineFmt(t.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    closeList();
    out.push(`<p class="body">${inlineFmt(t)}</p>`);
  }

  closeList();
  return out.join('');
};

/* ── Build full HTML page ── */
const buildHtml = (pairs, userName, dateStr) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 14px;
    color: #1a1a1a;
    background: #fff;
    padding: 0 24px 32px;
  }

  /* Cover */
  .cover {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 28px 32px;
    margin: 24px 0 32px;
    background: linear-gradient(135deg, #fdf8f6 0%, #faf9f8 100%);
  }
  .cover-brand  { font-size: 24px; font-weight: 800; color: #BC6C5F; letter-spacing: -0.5px; }
  .cover-sub    { font-size: 14px; color: #5a4c3c; margin: 4px 0 16px; }
  .cover-divider{ height: 1px; background: #e5e7eb; margin-bottom: 14px; }
  .cover-meta   { font-size: 12px; color: #9a8c7c; display: flex; gap: 24px; flex-wrap: wrap; }
  .cover-meta span strong { color: #5a4c3c; }

  /* Q&A card */
  .chat-block {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 20px 22px;
    margin-bottom: 20px;
    background: #fff;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Question section */
  .q-label {
    font-size: 10.5px;
    font-weight: 700;
    color: #BC6C5F;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 8px;
  }
  .q-box {
    background: #fdf8f6;
    border-left: 3px solid #BC6C5F;
    padding: 11px 15px;
    border-radius: 0 6px 6px 0;
    margin-bottom: 18px;
  }
  .q-box p {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1.5;
  }

  /* Answer section */
  .a-label {
    font-size: 10.5px;
    font-weight: 700;
    color: #4a7c59;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
  }
  .a-content { color: #2d2d2d; }

  /* Markdown block styles */
  .a-content p.body { font-size: 14px; line-height: 1.75; margin-bottom: 6px; }
  .a-content p.hd   { font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 12px 0 4px; }
  .a-content .gap   { height: 7px; }
  .a-content ul, .a-content ol { padding-left: 22px; margin: 4px 0 8px; }
  .a-content li     { font-size: 14px; line-height: 1.7; margin-bottom: 3px; }
  .a-content code.ic{
    background: #f4f4f4;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 12px;
    font-family: 'Courier New', monospace;
  }

  /* Sources */
  .sources {
    margin-top: 16px;
    padding-top: 13px;
    border-top: 1px solid #f0ece6;
  }
  .src-label {
    font-size: 10.5px;
    font-weight: 700;
    color: #9a8c7c;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 7px;
  }
  .src-link {
    display: block;
    font-size: 12px;
    color: #2563eb;
    text-decoration: underline;
    margin-bottom: 4px;
    word-break: break-all;
    line-height: 1.5;
  }
</style>
</head>
<body>

  <!-- Cover block -->
  <div class="cover">
    <div class="cover-brand">GSTWand</div>
    <div class="cover-sub">Chat Report</div>
    <div class="cover-divider"></div>
    <div class="cover-meta">
      <span><strong>Exchanges:</strong> ${pairs.length}</span>
      ${userName ? `<span><strong>User:</strong> ${esc(userName)}</span>` : ''}
      <span><strong>Date:</strong> ${esc(dateStr)}</span>
    </div>
  </div>

  <!-- Q&A Cards -->
  ${pairs.map((p, i) => `
  <div class="chat-block">
    <div class="q-label">Question ${i + 1}</div>
    <div class="q-box"><p>${esc(p.question)}</p></div>

    <div class="a-label">Answer</div>
    <div class="a-content">${mdToHtml(p.answer)}</div>

    ${p.sources.length ? `
    <div class="sources">
      <div class="src-label">References</div>
      ${p.sources.map(url => `<a class="src-link" href="${esc(url)}">${esc(url)}</a>`).join('')}
    </div>` : ''}
  </div>`).join('')}

</body>
</html>`;

/* ── POST /api/pdf/export ── */
const exportChatPdf = async (req, res) => {
  const { messages = [], userName = '' } = req.body;

  /* Build Q&A pairs */
  const pairs = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      const next = messages[i + 1];
      if (next && next.role === 'ai' && !next.isLimit) {
        pairs.push({
          question : messages[i].text || '',
          answer   : next.text   || '',
          sources  : (next.sources || []).filter(Boolean),
        });
        i++;
      }
    }
  }

  if (!pairs.length) {
    return res.status(400).json({ success: false, message: 'No chat content to export.' });
  }

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                + '  '
                + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const html = buildHtml(pairs, userName, dateStr);

  /* Header / footer templates (puppeteer — must be fully self-contained) */
  const headerHtml = `
    <div style="
      width:100%; padding:7px 24px; display:flex; justify-content:space-between;
      align-items:center; font-family:Helvetica,Arial,sans-serif; font-size:9pt;
      color:#9a8c7c; background:#faf9f8; border-bottom:1px solid #e5e7eb;
      box-sizing:border-box;
    ">
      <span style="font-weight:700;color:#BC6C5F;">GSTWand &nbsp;·&nbsp; Chat Report</span>
      <span>${esc(userName)}</span>
      <span>${esc(dateStr)}</span>
    </div>`;

  const footerHtml = `
    <div style="
      width:100%; padding:6px 24px; display:flex; justify-content:space-between;
      align-items:center; font-family:Helvetica,Arial,sans-serif; font-size:9pt;
      color:#9a8c7c; background:#faf9f8; border-top:1px solid #e5e7eb;
      box-sizing:border-box;
    ">
      <span>Generated by GSTWand</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-web-security'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const pdfData = await page.pdf({
      format              : 'A4',
      printBackground     : true,
      displayHeaderFooter : true,
      headerTemplate      : headerHtml,
      footerTemplate      : footerHtml,
      margin: { top: '55px', bottom: '45px', left: '0', right: '0' },
    });

    await browser.close();

    const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
    const filename  = `chat-report-${now.toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type'        : 'application/pdf',
      'Content-Disposition' : `attachment; filename="${filename}"`,
      'Content-Length'      : pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('[PDF] Generation error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
};

module.exports = { exportChatPdf };
