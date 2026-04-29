import { useEffect, useRef, useState } from 'react';
import { uploadAPI } from '../services/api';

const fmt = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const getDomain = (url) => { try { return new URL(url).hostname; } catch { return url; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FETCH_BATCH_SIZE       = 5;
const UPLOAD_BATCH_SIZE      = 5;
const FETCH_DELAY_MS         = 1000;
const UPLOAD_DELAY_MS        = 1000;
const MAX_URLS               = 200;
const JOB_POLL_INTERVAL_MS   = 2000; // poll background jobs every 2 s
const PREVIEW_WORDS_CHUNK    = 800;  // words revealed per Show More click

/* ── Clean + validate URLs from raw textarea input ── */
const parseUrls = (raw) => {
  const seen = new Set();
  const result = [];
  raw.split('\n').forEach((line) => {
    const cleaned = line.trim().replace(/^["""''\u201C\u201D\u2018\u2019]+|["""''\u201C\u201D\u2018\u2019]+$/g, '').trim();
    if (!cleaned) return;
    if (seen.has(cleaned)) return; // deduplicate
    seen.add(cleaned);
    let valid = true;
    try { new URL(cleaned); } catch { valid = false; }
    result.push({ url: cleaned, status: valid ? 'pending' : 'invalid', error: valid ? undefined : 'Invalid URL format' });
  });
  return result.slice(0, MAX_URLS);
};

const card = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-base)',
  borderRadius: 'var(--r-md)',
  boxShadow: 'var(--shadow-card)',
};

const freshState = () => ({
  step: 'input',
  // Mode 1
  file: null,
  sourceUrl: '',
  previewId: '',
  previewText: '',
  previewFullText: '',     // all words up to server cap — used for Show More
  previewVisibleWords: 800,
  previewWordCount: 0,
  previewFilename: '',
  // Mode 2
  urlsInput: '',
  previews: [],       // { url, status, previewId?, previewText?, wordCount?, filename?, error?, uploadStatus?, uploadError? }
  fetchTotal: 0,
  fetchDone: 0,
  uploadTotal: 0,
  uploadDone: 0,
  doneSuccess: 0,
  doneFail: 0,
  doneSkipped: 0,
  // Background job (large file async processing)
  processingJobId: null,
  processingTotal: 0,
  processingDone: 0,
  processingFailed: 0,
  processingStatus: '',   // 'processing' | 'completed' | 'partial' | 'failed'
  processingError: '',
  // Shared
  urlError: '',
  confirmError: '',
  dragOver: false,
});

const UploadPage = () => {
  const fileInputRef = useRef(null);
  const pollingRef   = useRef(null);
  const [mode, setMode] = useState('upload');
  const [s, setS] = useState(freshState());

  const patch = (updates) => setS((prev) => ({ ...prev, ...updates }));

  // Poll background job until terminal status
  useEffect(() => {
    if (s.step !== 'processing' || !s.processingJobId) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await uploadAPI.getJobStatus(s.processingJobId);
        const job = res.data.data;
        const terminal = job.status === 'completed' || job.status === 'partial' || job.status === 'failed';
        patch({
          processingDone: job.processedChunks,
          processingFailed: job.failedChunks,
          processingTotal: job.totalChunks,
          processingStatus: job.status,
          ...(terminal ? { step: 'done', processingError: job.error || '' } : {}),
        });
        if (terminal) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (_) { /* ignore transient poll errors */ }
    }, JOB_POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [s.step, s.processingJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setS(freshState());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const reset = () => {
    setS(freshState());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (incoming) => {
    const f = Array.from(incoming)[0];
    if (!f) return;
    patch({ file: f });
  };

  /* ════════════════════════════════════════
     MODE 1 — Preview (single file + URL)
  ════════════════════════════════════════ */
  const handlePreviewMode1 = async () => {
    const url = s.sourceUrl.trim();
    if (!s.file) { patch({ urlError: 'Please select a file.' }); return; }
    if (!url)    { patch({ urlError: 'Source URL is required.' }); return; }
    patch({ step: 'previewing', urlError: '' });
    try {
      const res = await uploadAPI.previewFile(s.file, url);
      const { previewId, previewText, fullText, wordCount, filename } = res.data.data;
      patch({ step: 'preview', previewId, previewText, previewFullText: fullText || previewText, previewVisibleWords: PREVIEW_WORDS_CHUNK, previewWordCount: wordCount, previewFilename: filename });
    } catch (err) {
      patch({ step: 'input', urlError: err.response?.data?.message || err.message || 'Preview failed' });
    }
  };

  /* ════════════════════════════════════════
     MODE 2 — Batch preview (multiple URLs)
  ════════════════════════════════════════ */
  const handlePreviewMode2 = async () => {
    const parsed = parseUrls(s.urlsInput);
    if (!parsed.length) { patch({ urlError: 'Please enter at least one URL.' }); return; }

    const validCount = parsed.filter((p) => p.status === 'pending').length;

    setS((prev) => ({
      ...prev,
      step: 'previewing',
      urlError: '',
      previews: parsed,
      fetchTotal: validCount,
      fetchDone: 0,
    }));

    const validItems = parsed.filter((p) => p.status === 'pending');

    for (let i = 0; i < validItems.length; i += FETCH_BATCH_SIZE) {
      const batch = validItems.slice(i, i + FETCH_BATCH_SIZE);

      // Mark batch as fetching
      setS((prev) => ({
        ...prev,
        previews: prev.previews.map((p) =>
          batch.some((b) => b.url === p.url) ? { ...p, status: 'fetching' } : p
        ),
      }));

      // Fetch batch in parallel
      await Promise.all(
        batch.map(async ({ url }) => {
          try {
            const res = await uploadAPI.previewUrl(url);
            const { previewId, previewText, fullText, wordCount, filename } = res.data.data;
            setS((prev) => ({
              ...prev,
              fetchDone: prev.fetchDone + 1,
              previews: prev.previews.map((p) =>
                p.url === url ? { ...p, status: 'ready', previewId, previewText, fullText: fullText || previewText, wordCount, filename, visibleWords: PREVIEW_WORDS_CHUNK } : p
              ),
            }));
          } catch (err) {
            const error = err.response?.data?.message || err.message || 'Failed to fetch';
            setS((prev) => ({
              ...prev,
              fetchDone: prev.fetchDone + 1,
              previews: prev.previews.map((p) =>
                p.url === url ? { ...p, status: 'failed', error } : p
              ),
            }));
          }
        })
      );

      if (i + FETCH_BATCH_SIZE < validItems.length) await sleep(FETCH_DELAY_MS);
    }

    setS((prev) => ({ ...prev, step: 'preview' }));
  };

  const handlePreview = () => {
    if (s.step === 'previewing') return;
    if (mode === 'upload') handlePreviewMode1();
    else handlePreviewMode2();
  };

  /* ════════════════════════════════════════
     MODE 1 — Confirm (single)
  ════════════════════════════════════════ */
  const handleConfirmMode1 = async () => {
    patch({ step: 'confirming', confirmError: '' });
    try {
      const res = await uploadAPI.confirmUpload(s.previewId);
      const data = res.data?.data || {};
      if (data.status === 'processing_started' && data.jobId) {
        // Large file — enter polling mode
        patch({
          step: 'processing',
          processingJobId: data.jobId,
          processingTotal: data.totalChunks || 0,
          processingDone: 0,
          processingFailed: 0,
          processingStatus: 'processing',
          processingError: '',
        });
      } else {
        patch({
          step: 'done',
          processingDone: data.chunks || 0,
          processingTotal: data.totalChunks || data.chunks || 0,
          processingStatus: 'completed',
        });
      }
    } catch (err) {
      patch({ step: 'preview', confirmError: err.response?.data?.message || err.message || 'Upload failed' });
    }
  };

  /* ════════════════════════════════════════
     MODE 2 — Confirm batch (with progress)
  ════════════════════════════════════════ */
  const handleConfirmMode2 = async () => {
    const readyItems = s.previews.filter((p) => p.status === 'ready');
    if (!readyItems.length) return;

    setS((prev) => ({
      ...prev,
      step: 'confirming',
      confirmError: '',
      uploadTotal: readyItems.length,
      uploadDone: 0,
      previews: prev.previews.map((p) =>
        p.status === 'ready' ? { ...p, uploadStatus: 'pending' } : p
      ),
    }));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < readyItems.length; i += UPLOAD_BATCH_SIZE) {
      const batch = readyItems.slice(i, i + UPLOAD_BATCH_SIZE);

      // Mark batch as uploading
      setS((prev) => ({
        ...prev,
        previews: prev.previews.map((p) =>
          batch.some((b) => b.url === p.url) ? { ...p, uploadStatus: 'uploading' } : p
        ),
      }));

      // Upload batch sequentially to preserve URL ↔ content integrity
      for (const item of batch) {
        try {
          await uploadAPI.confirmUpload(item.previewId);
          successCount++;
          setS((prev) => ({
            ...prev,
            uploadDone: prev.uploadDone + 1,
            previews: prev.previews.map((p) =>
              p.url === item.url ? { ...p, uploadStatus: 'success' } : p
            ),
          }));
        } catch (err) {
          failCount++;
          const uploadError = err.response?.data?.message || err.message || 'Upload failed';
          setS((prev) => ({
            ...prev,
            uploadDone: prev.uploadDone + 1,
            previews: prev.previews.map((p) =>
              p.url === item.url ? { ...p, uploadStatus: 'failed', uploadError } : p
            ),
          }));
        }
      }

      if (i + UPLOAD_BATCH_SIZE < readyItems.length) await sleep(UPLOAD_DELAY_MS);
    }

    setS((prev) => {
      const skipped = prev.previews.filter((p) => p.status === 'invalid' || p.status === 'failed').length;
      return { ...prev, step: 'done', doneSuccess: successCount, doneFail: failCount, doneSkipped: skipped };
    });
  };

  const handleConfirm = () => {
    if (s.step === 'confirming') return;
    if (mode === 'upload') handleConfirmMode1();
    else handleConfirmMode2();
  };

  // Mode 2 card expand/collapse helpers
  const expandCard   = (url) => setS((prev) => ({ ...prev, previews: prev.previews.map((p) => p.url === url ? { ...p, visibleWords: (p.visibleWords || PREVIEW_WORDS_CHUNK) + PREVIEW_WORDS_CHUNK } : p) }));
  const collapseCard = (url) => setS((prev) => ({ ...prev, previews: prev.previews.map((p) => p.url === url ? { ...p, visibleWords: PREVIEW_WORDS_CHUNK } : p) }));

  // Derived counts for mode 2
  const readyCount   = s.previews.filter((p) => p.status === 'ready').length;
  const failedCount  = s.previews.filter((p) => p.status === 'failed').length;
  const invalidCount = s.previews.filter((p) => p.status === 'invalid').length;
  const totalUrlCount = s.urlsInput.split('\n').map((u) => u.trim()).filter(Boolean).length;

  /* ── Per-URL status badge config ── */
  const getStatusBadge = (p) => {
    if (s.step === 'confirming' || s.step === 'done') {
      if (p.status !== 'ready') {
        return { label: p.status === 'invalid' ? '❌ Invalid URL' : `❌ ${p.error || 'Fetch failed'}`, ok: false };
      }
      if (!p.uploadStatus || p.uploadStatus === 'pending') return { label: '⏳ Pending upload', ok: null };
      if (p.uploadStatus === 'uploading') return { label: '⏳ Uploading…', ok: null };
      if (p.uploadStatus === 'success')   return { label: '✅ Uploaded', ok: true };
      return { label: `❌ ${p.uploadError || 'Failed'}`, ok: false };
    }
    if (p.status === 'pending')  return { label: '⏳ Waiting…', ok: null };
    if (p.status === 'fetching') return { label: '⏳ Fetching…', ok: null };
    if (p.status === 'invalid')  return { label: '❌ Invalid URL', ok: false };
    if (p.status === 'failed')   return { label: `❌ ${p.error || 'Failed to fetch'}`, ok: false };
    if (p.status === 'ready')    return { label: `✅ Ready · ${p.wordCount?.toLocaleString()} words`, ok: true };
    return { label: '', ok: null };
  };

  const badgeStyle = (ok) => ({
    flexShrink: 0,
    padding: '3px 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: '11.5px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    background: ok === true ? 'var(--ok-bg)' : ok === false ? 'var(--err-bg)' : 'var(--bg-panel)',
    color: ok === true ? 'var(--ok)' : ok === false ? 'var(--err)' : 'var(--txt-muted)',
    border: `1px solid ${ok === true ? 'var(--ok)' : ok === false ? 'var(--err)' : 'var(--border-base)'}`,
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '11px', fontWeight: 600, letterSpacing: '1.8px',
            color: 'var(--acc)', textTransform: 'uppercase', marginBottom: '10px',
          }}>
            <div style={{ width: '20px', height: '1.5px', background: 'var(--acc)' }} />
            Document Management
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', margin: 0 }}>
            Upload <em style={{ color: 'var(--acc)' }}>Documents</em>
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--txt-secondary)', margin: '8px 0 0', lineHeight: 1.7 }}>
            Preview extracted content before saving to the knowledge base.
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', gap: '6px', padding: '5px',
          background: 'var(--bg-panel)', border: '1px solid var(--border-base)',
          borderRadius: 'var(--r-md)', marginBottom: '28px', width: 'fit-content',
        }}>
          {[{ key: 'upload', label: '📁 File + URL' }, { key: 'scrape', label: '🔗 Scrape URLs' }].map(({ key, label }) => (
            <button key={key} onClick={() => switchMode(key)} style={{
              padding: '9px 20px',
              background: mode === key ? 'var(--acc)' : 'transparent',
              color: mode === key ? '#fff' : 'var(--txt-secondary)',
              border: 'none', borderRadius: 'calc(var(--r-md) - 3px)',
              fontSize: '13.5px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', transition: 'var(--t)',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ INPUT ══ */}
        {s.step === 'input' && (
          <>
            {mode === 'upload' ? (
              <>
                {/* File dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={(e) => { e.preventDefault(); patch({ dragOver: false }); handleFileSelect(e.dataTransfer.files); }}
                  onDragOver={(e) => { e.preventDefault(); patch({ dragOver: true }); }}
                  onDragLeave={() => patch({ dragOver: false })}
                  style={{
                    ...card,
                    border: `2px dashed ${s.dragOver ? 'var(--acc)' : s.file ? 'var(--ok)' : 'var(--border-strong)'}`,
                    background: s.dragOver ? 'var(--acc-light)' : s.file ? 'var(--ok-bg)' : 'var(--bg-panel)',
                    padding: '36px 24px', marginBottom: '14px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '10px', cursor: 'pointer', transition: 'var(--t)',
                  }}
                >
                  <div style={{ fontSize: '36px' }}>{s.file ? '📄' : '📂'}</div>
                  {s.file ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ok)' }}>{s.file.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--txt-muted)', marginTop: '3px' }}>{fmt(s.file.size)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--txt-muted)', marginTop: '2px' }}>Click to change file</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--txt-secondary)' }}>
                        Drop a file here or <span style={{ color: 'var(--acc)', fontWeight: 600 }}>click to browse</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--txt-muted)', marginTop: '4px' }}>PDF · DOCX · TXT</div>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt"
                    style={{ display: 'none' }} onChange={(e) => handleFileSelect(e.target.files)} />
                </div>

                <div style={{ ...card, padding: '16px 18px', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--txt-secondary)', marginBottom: '8px' }}>
                    Source URL <span style={{ color: 'var(--err)', fontSize: '13px' }}>*</span>
                    <span style={{ fontWeight: 400, color: 'var(--txt-muted)' }}>— stored in every chunk</span>
                  </label>
                  <input type="url" value={s.sourceUrl}
                    onChange={(e) => patch({ sourceUrl: e.target.value, urlError: '' })}
                    onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
                    placeholder="https://example.com/document.pdf"
                    style={{
                      width: '100%', padding: '10px 13px', boxSizing: 'border-box',
                      border: `1.5px solid ${s.urlError ? 'var(--err)' : 'var(--border-base)'}`,
                      borderRadius: 'var(--r-sm)', fontSize: '13.5px', fontFamily: 'var(--font-sans)',
                      background: 'var(--bg-base)', color: 'var(--txt-primary)', outline: 'none', transition: 'var(--t)',
                    }}
                  />
                  {s.urlError && <div style={{ fontSize: '12px', color: 'var(--err)', marginTop: '6px' }}>⚠ {s.urlError}</div>}
                </div>
              </>
            ) : (
              /* Mode 2 — multi-URL textarea */
              <div style={{ ...card, padding: '22px', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--txt-primary)', marginBottom: '4px' }}>
                  🔗 Enter URLs to scrape
                </div>
                <div style={{ fontSize: '13px', color: 'var(--txt-muted)', marginBottom: '14px', lineHeight: 1.6 }}>
                  One URL per line · up to {MAX_URLS} URLs · duplicates removed automatically ·
                  fetched {FETCH_BATCH_SIZE} at a time with {FETCH_DELAY_MS / 1000}s delay between batches
                </div>
                <textarea
                  value={s.urlsInput}
                  onChange={(e) => patch({ urlsInput: e.target.value, urlError: '' })}
                  placeholder={'https://cbic-gst.gov.in/page1\nhttps://example.com/document.pdf\nhttps://...'}
                  rows={8}
                  style={{
                    width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                    border: `1.5px solid ${s.urlError ? 'var(--err)' : 'var(--border-base)'}`,
                    borderRadius: 'var(--r-sm)', fontSize: '13px', fontFamily: 'var(--font-sans)',
                    background: 'var(--bg-base)', color: 'var(--txt-primary)',
                    outline: 'none', resize: 'vertical', lineHeight: 1.7, transition: 'var(--t)',
                  }}
                />
                {s.urlError && <div style={{ fontSize: '12px', color: 'var(--err)', marginTop: '6px' }}>⚠ {s.urlError}</div>}
                {totalUrlCount > 0 && (
                  <div style={{ fontSize: '11.5px', color: 'var(--txt-muted)', marginTop: '8px' }}>
                    {totalUrlCount} line{totalUrlCount !== 1 ? 's' : ''} entered
                    {totalUrlCount > MAX_URLS && <span style={{ color: 'var(--err)', marginLeft: '6px' }}>— only first {MAX_URLS} will be used</span>}
                  </div>
                )}
              </div>
            )}

            {/* Preview button */}
            <button
              onClick={handlePreview}
              disabled={mode === 'upload' ? (!s.file || !s.sourceUrl.trim()) : !s.urlsInput.trim()}
              style={{
                width: '100%', padding: '13px 20px',
                background: 'var(--acc)', color: '#fff',
                border: 'none', borderRadius: 'var(--r-sm)',
                fontSize: '14.5px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                cursor: (mode === 'upload' ? (!s.file || !s.sourceUrl.trim()) : !s.urlsInput.trim()) ? 'not-allowed' : 'pointer',
                opacity: (mode === 'upload' ? (!s.file || !s.sourceUrl.trim()) : !s.urlsInput.trim()) ? 0.55 : 1,
                boxShadow: '0 2px 8px var(--acc-glow)', transition: 'var(--t)',
              }}
            >
              🔍 Preview Content
            </button>
          </>
        )}

        {/* ══ PREVIEWING — Mode 1 spinner ══ */}
        {s.step === 'previewing' && mode === 'upload' && (
          <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>⏳</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--txt-secondary)' }}>Extracting text from file…</div>
            <div style={{ fontSize: '12px', color: 'var(--txt-muted)', marginTop: '6px' }}>This may take a moment.</div>
          </div>
        )}

        {/* ══ PREVIEWING / PREVIEW — Mode 2 live card list ══ */}
        {(s.step === 'previewing' || s.step === 'preview') && mode === 'scrape' && (
          <>
            {/* Progress bar */}
            <div style={{ ...card, padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--txt-primary)' }}>
                  {s.step === 'previewing' ? '⏳ Processing URLs…' : '✅ Preview Complete'}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--txt-muted)' }}>
                  {s.fetchDone} / {s.fetchTotal} fetched
                </div>
              </div>
              <div style={{ height: '6px', borderRadius: '999px', background: 'var(--border-base)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '999px', background: 'var(--acc)',
                  width: s.fetchTotal > 0 ? `${(s.fetchDone / s.fetchTotal) * 100}%` : '0%',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              {s.step === 'preview' && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {readyCount > 0   && <span style={{ fontSize: '12px', color: 'var(--ok)', fontWeight: 600 }}>✅ {readyCount} ready</span>}
                  {failedCount > 0  && <span style={{ fontSize: '12px', color: 'var(--err)', fontWeight: 600 }}>❌ {failedCount} failed</span>}
                  {invalidCount > 0 && <span style={{ fontSize: '12px', color: 'var(--txt-muted)', fontWeight: 600 }}>⚠ {invalidCount} invalid</span>}
                </div>
              )}
            </div>

            {/* Back + URL card list */}
            {s.step === 'preview' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <button onClick={reset} style={{
                  padding: '6px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border-base)',
                  color: 'var(--txt-secondary)', borderRadius: 'var(--r-sm)',
                  fontSize: '12px', fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}>← Back</button>
              </div>
            )}

            <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {s.previews.map((p, idx) => {
                const badge = getStatusBadge(p);
                return (
                  <div key={idx} style={{ ...card, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--acc)', wordBreak: 'break-all', textDecoration: 'none', display: 'block', marginBottom: '2px' }}>
                          {p.url}
                        </a>
                        <span style={{
                          fontSize: '10.5px', fontWeight: 600, color: 'var(--txt-primary)',
                          background: 'var(--bg-panel)', border: '1px solid var(--border-base)',
                          borderRadius: 'var(--r-pill)', padding: '1px 7px', display: 'inline-block',
                        }}>{getDomain(p.url)}</span>
                      </div>
                      <div style={badgeStyle(badge.ok)}>{badge.label}</div>
                    </div>
                    {p.status === 'ready' && p.previewText && s.step === 'preview' && (() => {
                      const cardWords    = p.fullText ? p.fullText.split(/\s+/) : p.previewText.split(/\s+/);
                      const cardCap      = cardWords.length;
                      const cardShowing  = Math.min(p.visibleWords || PREVIEW_WORDS_CHUNK, cardCap);
                      const cardDisplay  = cardWords.slice(0, cardShowing).join(' ');
                      const cardHasMore  = (p.visibleWords || PREVIEW_WORDS_CHUNK) < p.wordCount;
                      const cardCanLess  = (p.visibleWords || PREVIEW_WORDS_CHUNK) > PREVIEW_WORDS_CHUNK;
                      return (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--txt-muted)', fontStyle: 'italic' }}>
                              Showing {cardShowing.toLocaleString()} of {p.wordCount?.toLocaleString()} words
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {cardHasMore && cardShowing < cardCap && (
                                <button onClick={() => expandCard(p.url)} style={{ padding: '2px 9px', background: 'var(--acc)', color: '#fff', border: 'none', borderRadius: 'var(--r-pill)', fontSize: '10.5px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                                  +{PREVIEW_WORDS_CHUNK}
                                </button>
                              )}
                              {cardCanLess && (
                                <button onClick={() => collapseCard(p.url)} style={{ padding: '2px 9px', background: 'var(--bg-panel)', color: 'var(--txt-secondary)', border: '1px solid var(--border-base)', borderRadius: 'var(--r-pill)', fontSize: '10.5px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                                  Less
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{
                            maxHeight: '160px', overflowY: 'auto',
                            background: 'var(--bg-base)', border: '1px solid var(--border-base)',
                            borderRadius: 'var(--r-sm)', padding: '10px 12px',
                          }}>
                            <div style={{ fontSize: '11px', color: 'var(--txt-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {cardDisplay}
                              {cardShowing >= cardCap && cardHasMore && (
                                <span style={{ color: 'var(--txt-muted)', fontStyle: 'italic' }}>
                                  {'\n'}… {(p.wordCount - cardCap).toLocaleString()} more words
                                </span>
                              )}
                              {!cardHasMore && <span style={{ color: 'var(--ok)', fontStyle: 'italic' }}>{' '}(end)</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {s.step === 'preview' && readyCount > 0 && (
              <button onClick={handleConfirm} style={{
                width: '100%', padding: '14px 20px', background: 'var(--acc)', color: '#fff',
                border: 'none', borderRadius: 'var(--r-sm)',
                fontSize: '14.5px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                cursor: 'pointer', boxShadow: '0 2px 8px var(--acc-glow)', transition: 'var(--t)',
              }}>
                🗄️ Upload All to Database ({readyCount} URL{readyCount !== 1 ? 's' : ''})
              </button>
            )}
          </>
        )}

        {/* ══ CONFIRMING — Mode 1 processing state ══ */}
        {s.step === 'confirming' && mode === 'upload' && (
          <div style={{ ...card, padding: '52px 28px', textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '4px solid var(--border-base)', borderTopColor: 'var(--acc)',
              margin: '0 auto 20px',
              animation: 'spin 0.9s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '8px' }}>
              Uploading and processing document…
            </div>
            <div style={{ fontSize: '13px', color: 'var(--txt-secondary)', marginBottom: '6px', lineHeight: 1.7 }}>
              Generating embeddings · Uploading to knowledge base
            </div>
            <div style={{ fontSize: '12px', color: 'var(--txt-muted)', lineHeight: 1.6 }}>
              Please wait — do not close this page.
            </div>
          </div>
        )}

        {/* ══ PREVIEW — Mode 1 ══ */}
        {s.step === 'preview' && mode === 'upload' && (
          <>
            <div style={{ ...card, padding: '16px 20px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txt-primary)' }}>📄 {s.previewFilename}</div>
                  <div style={{ fontSize: '12px', color: 'var(--txt-muted)', marginTop: '2px' }}>
                    {s.previewWordCount.toLocaleString()} words · <span style={{ color: 'var(--acc)' }}>{s.sourceUrl}</span>
                  </div>
                </div>
                <button onClick={reset} style={{
                  padding: '6px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border-base)',
                  color: 'var(--txt-secondary)', borderRadius: 'var(--r-sm)', fontSize: '12px',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}>← Back</button>
              </div>
            </div>
            {(() => {
              const allWords    = s.previewFullText ? s.previewFullText.split(/\s+/) : s.previewText.split(/\s+/);
              const capWords    = allWords.length; // words available on client (server-capped)
              const showing     = Math.min(s.previewVisibleWords, capWords);
              const displayText = allWords.slice(0, showing).join(' ');
              const hasMore     = s.previewVisibleWords < s.previewWordCount; // more exists (even if not all on client)
              const canLess     = s.previewVisibleWords > PREVIEW_WORDS_CHUNK;
              return (
                <div style={{ ...card, padding: '18px 20px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--txt-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                      Extracted Content Preview
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--acc)', fontWeight: 600 }}>
                      Showing {showing.toLocaleString()} of {s.previewWordCount.toLocaleString()} words
                    </div>
                  </div>
                  <div style={{ maxHeight: '320px', overflowY: 'auto', fontSize: '13px', lineHeight: 1.75, color: 'var(--txt-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '12px' }}>
                    {displayText}
                    {s.previewVisibleWords >= capWords && hasMore && (
                      <span style={{ color: 'var(--txt-muted)', fontStyle: 'italic' }}>
                        {'\n\n'}… {(s.previewWordCount - capWords).toLocaleString()} more words (beyond preview limit)
                      </span>
                    )}
                  </div>
                  {(hasMore || canLess) && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {hasMore && s.previewVisibleWords < capWords && (
                        <button
                          onClick={() => patch({ previewVisibleWords: s.previewVisibleWords + PREVIEW_WORDS_CHUNK })}
                          style={{ padding: '6px 14px', background: 'var(--acc)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                        >
                          Show More (+{PREVIEW_WORDS_CHUNK.toLocaleString()} words)
                        </button>
                      )}
                      {canLess && (
                        <button
                          onClick={() => patch({ previewVisibleWords: PREVIEW_WORDS_CHUNK })}
                          style={{ padding: '6px 14px', background: 'var(--bg-panel)', color: 'var(--txt-secondary)', border: '1px solid var(--border-base)', borderRadius: 'var(--r-sm)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
                        >
                          Show Less
                        </button>
                      )}
                      {hasMore && s.previewVisibleWords >= capWords && (
                        <span style={{ fontSize: '11.5px', color: 'var(--txt-muted)', alignSelf: 'center', fontStyle: 'italic' }}>
                          Preview limit reached — full content will be stored
                        </span>
                      )}
                    </div>
                  )}
                  {!hasMore && !canLess && (
                    <div style={{ fontSize: '11.5px', color: 'var(--ok)', fontStyle: 'italic' }}>End of document</div>
                  )}
                </div>
              );
            })()}
            {s.confirmError && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', marginBottom: '14px', background: 'var(--err-bg)', border: '1px solid var(--err)', color: 'var(--err)', fontSize: '13px' }}>
                ❌ {s.confirmError}
              </div>
            )}
            <button onClick={handleConfirm} style={{
              width: '100%', padding: '14px 20px', background: 'var(--acc)', color: '#fff',
              border: 'none', borderRadius: 'var(--r-sm)',
              fontSize: '14.5px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px var(--acc-glow)', transition: 'var(--t)',
            }}>
              🗄️ Upload to Database
            </button>
          </>
        )}

        {/* ══ CONFIRMING — Mode 2 upload progress ══ */}
        {s.step === 'confirming' && mode === 'scrape' && (
          <>
            {/* Upload progress bar */}
            <div style={{ ...card, padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--txt-primary)' }}>⏳ Uploading to database…</div>
                <div style={{ fontSize: '12.5px', color: 'var(--txt-muted)' }}>
                  {s.uploadDone} / {s.uploadTotal} completed
                </div>
              </div>
              <div style={{ height: '6px', borderRadius: '999px', background: 'var(--border-base)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '999px', background: 'var(--acc)',
                  width: s.uploadTotal > 0 ? `${(s.uploadDone / s.uploadTotal) * 100}%` : '0%',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--txt-muted)', marginTop: '8px' }}>
                Processing {UPLOAD_BATCH_SIZE} URLs at a time with {UPLOAD_DELAY_MS / 1000}s delay between batches
              </div>
            </div>

            {/* Live URL status list */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {s.previews.map((p, idx) => {
                const badge = getStatusBadge(p);
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: 'var(--r-sm)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-base)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'var(--txt-secondary)', wordBreak: 'break-all' }}>
                      {p.url}
                    </div>
                    <div style={badgeStyle(badge.ok)}>{badge.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══ PROCESSING — Mode 1 background job polling ══ */}
        {s.step === 'processing' && mode === 'upload' && (
          <div style={{ ...card, padding: '36px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>⏳</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--txt-primary)', marginBottom: '6px' }}>
              Processing large file in background…
            </div>
            <div style={{ fontSize: '13px', color: 'var(--txt-muted)', marginBottom: '22px', lineHeight: 1.6 }}>
              Embedding chunks in batches of 50. You can leave this page — it will finish automatically.
            </div>
            {s.processingTotal > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--txt-muted)', marginBottom: '6px' }}>
                  <span>{s.processingDone.toLocaleString()} / {s.processingTotal.toLocaleString()} chunks stored</span>
                  {s.processingFailed > 0 && <span style={{ color: 'var(--err)' }}>{s.processingFailed} failed</span>}
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'var(--border-base)', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{
                    height: '100%', borderRadius: '999px', background: 'var(--acc)',
                    width: `${Math.round((s.processingDone / s.processingTotal) * 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--txt-muted)' }}>
                  {Math.round((s.processingDone / s.processingTotal) * 100)}% complete
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ DONE — Mode 1 ══ */}
        {s.step === 'done' && mode === 'upload' && (
          <div style={{ ...card, padding: '36px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>
              {s.processingStatus === 'failed' ? '❌' : s.processingStatus === 'partial' ? '⚠️' : '✅'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--txt-primary)', marginBottom: '6px' }}>
              {s.processingStatus === 'failed' ? 'Processing failed' : 'File processed successfully'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--txt-muted)', marginBottom: s.processingDone > 0 ? '14px' : '24px', lineHeight: 1.6 }}>
              {s.processingStatus === 'failed'
                ? (s.processingError || 'No chunks could be stored.')
                : s.processingStatus === 'partial'
                ? `${s.processingDone.toLocaleString()} of ${s.processingTotal.toLocaleString()} chunks stored (${s.processingFailed} failed).`
                : s.processingDone > 0
                ? `${s.processingDone.toLocaleString()} chunks stored in the knowledge base.`
                : 'Content is now in the knowledge base.'}
            </div>
            <button onClick={reset} style={{
              padding: '11px 28px', background: 'var(--acc)', color: '#fff',
              border: 'none', borderRadius: 'var(--r-sm)',
              fontSize: '13.5px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', boxShadow: '0 2px 8px var(--acc-glow)',
            }}>Upload Another</button>
          </div>
        )}

        {/* ══ DONE — Mode 2 summary ══ */}
        {s.step === 'done' && mode === 'scrape' && (
          <div style={{ ...card, padding: '28px 24px' }}>
            {/* Summary counts */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>
                {s.doneFail === 0 && s.doneSkipped === 0 ? '✅' : s.doneSuccess === 0 ? '❌' : '⚠️'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '12px' }}>Upload Complete</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                {s.doneSuccess > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ok)' }}>{s.doneSuccess}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--txt-muted)' }}>✔ Uploaded</div>
                  </div>
                )}
                {s.doneFail > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--err)' }}>{s.doneFail}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--txt-muted)' }}>❌ Failed</div>
                  </div>
                )}
                {s.doneSkipped > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--txt-muted)' }}>{s.doneSkipped}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--txt-muted)' }}>⚠ Skipped</div>
                  </div>
                )}
              </div>
            </div>

            {/* Failed / skipped URL list */}
            {(s.doneFail > 0 || s.doneSkipped > 0) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                  Issues
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {s.previews
                    .filter((p) => p.status === 'invalid' || p.status === 'failed' || p.uploadStatus === 'failed')
                    .map((p, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px',
                        background: 'var(--err-bg)', border: '1px solid var(--err)', borderRadius: 'var(--r-sm)',
                      }}>
                        <span style={{ fontSize: '13px', flexShrink: 0 }}>❌</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt-primary)', wordBreak: 'break-all' }}>{p.url}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--err)', marginTop: '2px' }}>
                            {p.status === 'invalid' ? 'Invalid URL' : p.status === 'failed' ? (p.error || 'Fetch failed') : (p.uploadError || 'Upload failed')}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <button onClick={reset} style={{
              width: '100%', padding: '11px 28px', background: 'var(--acc)', color: '#fff',
              border: 'none', borderRadius: 'var(--r-sm)',
              fontSize: '13.5px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: 'pointer', boxShadow: '0 2px 8px var(--acc-glow)',
            }}>Upload Another</button>
          </div>
        )}

        {/* Security footer */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '36px' }}>
          {['🔒 Encrypted', '✅ GSTN Live', '⚖️ Legal Grade'].map((badge) => (
            <span key={badge} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-base)',
              borderRadius: 'var(--r-pill)', padding: '5px 12px',
              fontSize: '11.5px', fontFamily: 'var(--font-sans)', color: 'var(--txt-secondary)',
            }}>{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
