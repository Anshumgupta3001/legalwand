import React, { useState, useRef, useEffect } from 'react';
import { fileAPI } from '../services/api';
import { useToast } from '../components/Toast';

const ACC    = '#BC6C5F';
const WORD_PREVIEW = 800;

/* ── Helpers (unchanged) ── */
const wordSlice = (text, count) => {
  const words = text.trim().split(/\s+/);
  return { preview: words.slice(0, count).join(' '), total: words.length };
};

const renderText = (text) =>
  text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: '6px' }} />;
    const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', lineHeight: 1.65, color: '#4a3c2c', marginBottom: '3px' }}>
          <span style={{ marginTop: '9px', width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, background: ACC, display: 'inline-block' }} />
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        </div>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)[1];
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', lineHeight: 1.65, color: '#4a3c2c', marginBottom: '3px' }}>
          <span style={{ fontWeight: 700, color: ACC, flexShrink: 0, minWidth: '18px' }}>{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        </div>
      );
    }
    return <p key={i} style={{ fontSize: '14px', lineHeight: 1.7, color: '#4a3c2c', margin: '0 0 4px' }} dangerouslySetInnerHTML={{ __html: html }} />;
  });

/* ── Spinner ── */
const Spinner = ({ size = 18, color = ACC }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ animation: 'dm-spin 0.8s linear infinite', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/* ── Status badge ── */
const StatusBadge = ({ status }) => {
  const MAP = {
    extracting: { label: 'Extracting…', bg: 'rgba(184,134,11,0.12)', color: '#92680a', dot: '#d4a017' },
    ready      : { label: 'Ready',       bg: 'rgba(74,154,100,0.12)', color: '#2d6e48', dot: '#3da866' },
    partial    : { label: 'Limited',     bg: 'rgba(184,134,11,0.12)', color: '#92680a', dot: '#d4a017' },
    failed     : { label: 'Failed',      bg: 'rgba(192,57,43,0.10)', color: '#8a2c1e', dot: '#c0392b' },
  };
  const s = MAP[status] || MAP.ready;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      fontSize: '11.5px', fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
};

/* ── Card wrapper ── */
const Card = ({ children, style }) => (
  <div style={{
    background: '#ffffff',
    border: '1px solid #e8e0d4',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(26,18,8,0.06), 0 1px 3px rgba(26,18,8,0.04)',
    overflow: 'hidden',
    ...style,
  }}>
    {children}
  </div>
);

/* ── Card header ── */
const CardHeader = ({ icon, title, right, border = true }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: border ? '1px solid #ede8e0' : 'none',
    background: '#faf8f5',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '15px', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1f1510', letterSpacing: '-.01em' }}>{title}</span>
    </div>
    {right}
  </div>
);

/* ── Step label ── */
const StepLabel = ({ n, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
    <div style={{
      width: '24px', height: '24px', borderRadius: '50%',
      background: ACC, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontWeight: 800, flexShrink: 0,
    }}>{n}</div>
    <span style={{ fontSize: '13px', fontWeight: 700, color: '#5a4c3c', letterSpacing: '.02em', textTransform: 'uppercase' }}>{label}</span>
  </div>
);

/* ── File type icon ── */
const fileIcon = (name = '') => {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf')  return '📕';
  if (ext === 'docx') return '📘';
  if (ext === 'txt')  return '📃';
  return '📄';
};

const fmtSize = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

/* ════════════════════════════════════════ */
const DataManagementPage = () => {
  const toast        = useToast();
  const fileInputRef = useRef(null);
  const chatEndRef   = useRef(null);

  /* ── State (logic unchanged) ── */
  const [uploading,     setUploading]     = useState(false);
  const [fileInfo,      setFileInfo]      = useState(null);   // { filename, charCount, extracted, size }
  const [extractedText, setExtractedText] = useState('');
  const [showFull,      setShowFull]      = useState(false);
  const [dragging,      setDragging]      = useState(false);
  const [dropHover,     setDropHover]     = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [input,        setInput]        = useState('');
  const [isTyping,     setIsTyping]     = useState(false);

  const MAX_CHAT_FILE_SIZE = 25 * 1024 * 1024;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  /* ── Handle file (logic unchanged) ── */
  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_CHAT_FILE_SIZE) {
      toast.error('File exceeds 25 MB limit.');
      return;
    }

    setUploading(true);
    const tid = toast.loading('Uploading and extracting content…');

    try {
      const uploadRes = await fileAPI.upload(file);
      toast.dismiss(tid);

      const { extracted, message, data } = uploadRes.data;

      setShowFull(false);
      setChatMessages([]);

      if (extracted === false) {
        toast.error(message || 'File uploaded, but content could not be extracted.');
        setFileInfo({ filename: data.filename, charCount: 0, extracted: false, size: file.size });
        setExtractedText('');
        return;
      }

      if (extracted === 'partial') {
        toast.info(message || 'File uploaded, but only limited content was extracted.');
        const ctxRes = await fileAPI.getContext();
        const ctx = ctxRes.data?.data;
        setFileInfo({ filename: data.filename, charCount: data.charCount, extracted: 'partial', size: file.size });
        setExtractedText(ctx?.text || '');
        return;
      }

      toast.success('File uploaded successfully.');
      const ctxRes = await fileAPI.getContext();
      const ctx = ctxRes.data?.data;
      setFileInfo({ filename: data.filename, charCount: data.charCount, extracted: true, size: file.size });
      setExtractedText(ctx?.text || '');

    } catch (err) {
      toast.dismiss(tid);
      const msg = err.response?.data?.message || '';
      if (!err.response) {
        toast.error('Upload failed: Network issue.');
      } else if (msg.toLowerCase().includes('too large') || msg.toLowerCase().includes('25')) {
        toast.error('Upload failed: File exceeds 25 MB limit.');
      } else if (msg.toLowerCase().includes('unsupported')) {
        toast.error('Upload failed: Unsupported file type. Use PDF, TXT, or DOCX.');
      } else {
        toast.error('Upload failed: Something went wrong.');
      }
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e) => handleFile(e.target.files?.[0]);
  const onDragOver    = (e) => { e.preventDefault(); setDragging(true);  setDropHover(true);  };
  const onDragLeave   = ()  => { setDragging(false); setDropHover(false); };
  const onDrop        = (e) => { e.preventDefault(); setDragging(false); setDropHover(false); handleFile(e.dataTransfer.files?.[0]); };

  /* ── Send chat (logic unchanged) ── */
  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isTyping || !extractedText) return;

    setInput('');
    setChatMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: trimmed }]);
    setIsTyping(true);

    try {
      const res = await fileAPI.chatWithFile(trimmed);
      const reply = res.data.data.reply;
      setChatMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ai', text: reply }]);
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      setChatMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ai', text: msg, isError: true }]);
    } finally {
      setIsTyping(false);
    }
  };

  /* ── Derived state ── */
  const { preview, total } = extractedText
    ? wordSlice(extractedText, WORD_PREVIEW)
    : { preview: '', total: 0 };
  const hasMore     = total > WORD_PREVIEW;
  const displayText = showFull ? extractedText : preview;

  const extractionFailed  = fileInfo?.extracted === false;
  const extractionPartial = fileInfo?.extracted === 'partial';
  const chatEnabled       = !!extractedText;

  const badgeStatus = uploading
    ? 'extracting'
    : extractionFailed
    ? 'failed'
    : extractionPartial
    ? 'partial'
    : fileInfo
    ? 'ready'
    : null;

  /* ════ RENDER ════ */
  return (
    <>
      {/* Spin keyframe */}
      <style>{`
        @keyframes dm-spin { to { transform: rotate(360deg); } }
        @keyframes dm-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .dm-drop-active { border-color: ${ACC} !important; background: rgba(188,108,95,0.05) !important; }
        .dm-replace-btn:hover { background: rgba(188,108,95,0.15) !important; border-color: rgba(188,108,95,0.45) !important; }
        .dm-send-btn:not(:disabled):hover { filter: brightness(1.1); transform: scale(1.05); }
        .dm-show-more:hover { text-decoration: underline; }
      `}</style>

      <div style={{ padding: '32px 36px 72px' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', fontWeight: 700, letterSpacing: '.12em',
            textTransform: 'uppercase', color: ACC, marginBottom: '10px',
          }}>
            <span style={{ width: '18px', height: '1.5px', background: ACC, display: 'block' }} />
            Data Management
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '30px',
            color: '#1f1510', margin: '0 0 6px', lineHeight: 1.2,
          }}>
            Document Intelligence
          </h1>
          <p style={{ fontSize: '14px', color: '#9a8c7c', margin: 0, lineHeight: 1.6 }}>
            Upload any document — extract its content and chat with it using AI.
          </p>
        </div>

        {/* ═══════════════════════════════════════
            STEP 1 — UPLOAD
        ═══════════════════════════════════════ */}
        <div style={{ marginBottom: '20px', animation: 'dm-fade-in .35s ease both' }}>
          <StepLabel n="1" label="Upload Document" />

          <Card>
            {/* Card top row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #ede8e0',
              background: '#faf8f5',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>📁</span>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1f1510' }}>Upload Document</span>
              </div>
              {badgeStatus && <StatusBadge status={badgeStatus} />}
            </div>

            <div style={{ padding: '20px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx"
                style={{ display: 'none' }}
                onChange={onInputChange}
              />

              {/* ── Drop zone ── */}
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={dropHover && !uploading ? 'dm-drop-active' : ''}
                style={{
                  border: `2px dashed ${extractionFailed ? 'rgba(192,57,43,0.4)' : '#d4c8b8'}`,
                  borderRadius: '12px',
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: extractionFailed
                    ? 'rgba(192,57,43,0.03)'
                    : dropHover
                    ? `rgba(188,108,95,0.05)`
                    : '#faf8f5',
                  transition: 'border-color .2s, background .2s',
                  position: 'relative',
                }}
              >
                {uploading ? (
                  /* ── Processing state ── */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '48px', height: '48px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: `rgba(188,108,95,0.1)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px',
                      }}>📄</div>
                      <div style={{ position: 'absolute', inset: '-4px' }}>
                        <Spinner size={56} color={ACC} />
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: ACC, margin: '0 0 3px' }}>
                        Extracting content…
                      </p>
                      <p style={{ fontSize: '12px', color: '#9a8c7c', margin: 0 }}>
                        This may take a moment for large files
                      </p>
                    </div>
                  </div>

                ) : fileInfo ? (
                  /* ── File uploaded state ── */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    {/* File icon + name */}
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '14px',
                      background: extractionFailed
                        ? 'rgba(192,57,43,0.08)'
                        : 'rgba(188,108,95,0.09)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '24px',
                    }}>
                      {extractionFailed ? '⚠️' : fileIcon(fileInfo.filename)}
                    </div>

                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#1f1510', margin: '0 0 3px' }}>
                        {fileInfo.filename}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {fileInfo.size && (
                          <span style={{ fontSize: '12px', color: '#9a8c7c' }}>
                            {fmtSize(fileInfo.size)}
                          </span>
                        )}
                        {!extractionFailed && fileInfo.charCount > 0 && (
                          <>
                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#c4b49a', display: 'inline-block' }} />
                            <span style={{ fontSize: '12px', color: '#9a8c7c' }}>
                              {fileInfo.charCount.toLocaleString()} chars extracted
                            </span>
                          </>
                        )}
                        {extractionFailed && (
                          <>
                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#c4b49a', display: 'inline-block' }} />
                            <span style={{ fontSize: '12px', color: '#c0392b' }}>
                              Content could not be extracted
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Replace button */}
                    <button
                      className="dm-replace-btn"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      style={{
                        marginTop: '4px',
                        fontSize: '12px', fontWeight: 600, color: ACC,
                        background: 'rgba(188,108,95,0.08)',
                        border: '1px solid rgba(188,108,95,0.25)',
                        borderRadius: '8px', padding: '6px 16px',
                        cursor: 'pointer', transition: 'background .15s, border-color .15s',
                      }}
                    >
                      ↩ Replace file
                    </button>
                  </div>

                ) : (
                  /* ── Empty / idle state ── */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '16px',
                      background: 'rgba(188,108,95,0.09)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '26px',
                    }}>📁</div>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: '#1f1510', margin: '0 0 4px' }}>
                        Drop your file here
                      </p>
                      <p style={{ fontSize: '13px', color: '#9a8c7c', margin: 0 }}>
                        or <span style={{ color: ACC, fontWeight: 600 }}>click to browse</span>
                      </p>
                    </div>
                    {/* Accepted formats */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {['PDF', 'DOCX', 'TXT'].map((f) => (
                        <span key={f} style={{
                          fontSize: '11px', fontWeight: 600,
                          color: '#9a8c7c',
                          background: '#f0ebe3',
                          border: '1px solid #e8e0d4',
                          borderRadius: '6px',
                          padding: '2px 8px',
                        }}>{f}</span>
                      ))}
                      <span style={{ fontSize: '11px', color: '#c4b49a', alignSelf: 'center' }}>· Max 25 MB</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Extraction-failed inline notice ── */}
              {extractionFailed && !uploading && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(192,57,43,0.06)',
                  border: '1px solid rgba(192,57,43,0.18)',
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#8a2c1e', margin: '0 0 2px' }}>
                      Content could not be extracted
                    </p>
                    <p style={{ fontSize: '12px', color: '#a04030', margin: 0, lineHeight: 1.5 }}>
                      The file was saved but no readable text was found. This may be a scanned image PDF, password-protected, or corrupted file. Try uploading a different version.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Partial extraction notice ── */}
              {extractionPartial && !uploading && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(184,134,11,0.06)',
                  border: '1px solid rgba(184,134,11,0.22)',
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>⚡</span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#92680a', margin: '0 0 2px' }}>
                      Limited content extracted
                    </p>
                    <p style={{ fontSize: '12px', color: '#a07a20', margin: 0, lineHeight: 1.5 }}>
                      Only a small amount of text was found. Chat is available but answers may be incomplete.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Success notice ── */}
              {fileInfo?.extracted === true && !uploading && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(74,154,100,0.07)',
                  border: '1px solid rgba(74,154,100,0.2)',
                }}>
                  <span style={{ fontSize: '15px', flexShrink: 0 }}>✅</span>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#2d6e48', margin: 0 }}>
                    Content extracted — file is ready for chat
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ═══════════════════════════════════════
            STEP 2 — EXTRACTED CONTENT PREVIEW
        ═══════════════════════════════════════ */}
        {extractedText && (
          <div style={{ marginBottom: '20px', animation: 'dm-fade-in .35s ease both' }}>
            <StepLabel n="2" label="Extracted Content" />

            <Card>
              <CardHeader
                icon="📄"
                title={fileInfo?.filename || 'Document'}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {extractionPartial && <StatusBadge status="partial" />}
                    <span style={{ fontSize: '12px', color: '#9a8c7c', fontWeight: 500 }}>
                      {total.toLocaleString()} words
                    </span>
                  </div>
                }
              />

              <div style={{
                padding: '18px 20px',
                maxHeight: showFull ? '480px' : '260px',
                overflowY: 'auto',
                transition: 'max-height .35s ease',
                position: 'relative',
              }}>
                <div style={{ lineHeight: 1.7 }}>
                  {renderText(displayText)}
                </div>

                {/* Fade-out gradient when collapsed */}
                {!showFull && hasMore && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '60px',
                    background: 'linear-gradient(to bottom, transparent, #ffffff)',
                    pointerEvents: 'none',
                  }} />
                )}
              </div>

              {hasMore && (
                <div style={{
                  padding: '10px 20px',
                  borderTop: '1px solid #ede8e0',
                  background: '#faf8f5',
                  textAlign: 'center',
                }}>
                  <button
                    className="dm-show-more"
                    onClick={() => setShowFull((v) => !v)}
                    style={{
                      fontSize: '13px', fontWeight: 600, color: ACC,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 0', transition: 'opacity .15s',
                    }}
                  >
                    {showFull
                      ? '▲ Show Less'
                      : `▼ Show More  (+${(total - WORD_PREVIEW).toLocaleString()} words)`}
                  </button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════
            STEP 3 — CHAT
        ═══════════════════════════════════════ */}
        <div style={{ animation: 'dm-fade-in .4s ease both' }}>
          <StepLabel n="3" label="Chat with Document" />

          {/* Chat — enabled */}
          {chatEnabled && (
            <Card>
              <CardHeader
                icon="💬"
                title="File-Only Chat"
                right={
                  <span style={{
                    fontSize: '10.5px', fontWeight: 600, padding: '3px 10px',
                    borderRadius: '999px',
                    background: 'rgba(188,108,95,0.1)', color: ACC,
                  }}>
                    No external data
                  </span>
                }
              />

              {/* Messages */}
              <div style={{
                padding: '16px 20px',
                minHeight: '160px',
                maxHeight: '360px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                {chatMessages.length === 0 && (
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '24px 0', textAlign: 'center',
                  }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: 'rgba(188,108,95,0.09)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px', marginBottom: '12px',
                    }}>💬</div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#5a4c3c', margin: '0 0 4px' }}>
                      Ask anything about this document
                    </p>
                    <p style={{ fontSize: '12px', color: '#9a8c7c', margin: 0 }}>
                      AI answers come exclusively from <strong style={{ color: '#5a4c3c' }}>{fileInfo?.filename}</strong>
                    </p>
                  </div>
                )}

                {chatMessages.map((msg) => (
                  <div key={msg.id} style={{
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    gap: '10px',
                    alignItems: 'flex-start',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: '30px', height: '30px', flexShrink: 0,
                      borderRadius: msg.role === 'user' ? '50%' : '8px',
                      background: msg.role === 'user' ? ACC : '#f0ebe3',
                      border: msg.role === 'ai' ? '1px solid #e8e0d4' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 700,
                      color: msg.role === 'user' ? '#fff' : '#5a4c3c',
                    }}>
                      {msg.role === 'user' ? 'U' : '📄'}
                    </div>

                    {/* Bubble */}
                    <div style={{
                      maxWidth: '76%',
                      padding: '10px 14px',
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      fontSize: '14px', lineHeight: 1.65,
                      ...(msg.role === 'user'
                        ? { background: ACC, color: '#fff' }
                        : msg.isError
                        ? { background: '#fff5f5', border: '1px solid rgba(192,57,43,0.2)', color: '#8a2c1e' }
                        : { background: '#f7f4ef', border: '1px solid #e8e0d4', color: '#4a3c2c' }
                      ),
                    }}>
                      {msg.role === 'user'
                        ? <span>{msg.text}</span>
                        : <div>{renderText(msg.text)}</div>
                      }
                    </div>
                  </div>
                ))}

                {/* Typing dots */}
                {isTyping && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      background: '#f0ebe3', border: '1px solid #e8e0d4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0,
                    }}>📄</div>
                    <div style={{
                      padding: '12px 16px', borderRadius: '14px 14px 14px 4px',
                      background: '#f7f4ef', border: '1px solid #e8e0d4',
                      display: 'flex', gap: '5px', alignItems: 'center',
                    }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: ACC, opacity: 0.7,
                          animation: 'dm-spin 1.2s linear infinite',
                          animationDelay: `${i * 0.2}s`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input area */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid #ede8e0', background: '#faf8f5' }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-end', gap: '10px',
                  padding: '10px 14px',
                  background: '#ffffff',
                  border: '1.5px solid #e8e0d4',
                  borderRadius: '12px',
                  boxShadow: '0 1px 4px rgba(26,18,8,0.05)',
                  transition: 'border-color .15s',
                }}>
                  <textarea
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    onFocus={(e) => { e.currentTarget.parentElement.style.borderColor = `rgba(188,108,95,0.5)`; }}
                    onBlur={(e)  => { e.currentTarget.parentElement.style.borderColor = '#e8e0d4'; }}
                    placeholder={`Ask about "${fileInfo?.filename}"…`}
                    rows={1}
                    disabled={isTyping}
                    style={{
                      flex: 1, resize: 'none', border: 'none', outline: 'none',
                      fontSize: '14px', lineHeight: 1.5, background: 'transparent',
                      color: '#1f1510', maxHeight: '120px', minHeight: '22px',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    className="dm-send-btn"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isTyping}
                    style={{
                      width: '34px', height: '34px', flexShrink: 0,
                      borderRadius: '10px',
                      background: input.trim() && !isTyping ? ACC : '#d4c8b8',
                      border: 'none',
                      cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '16px',
                      transition: 'background .15s, transform .1s, filter .1s',
                    }}
                  >↑</button>
                </div>
                <p style={{ fontSize: '11px', color: '#c4b49a', margin: '6px 0 0', textAlign: 'center' }}>
                  Enter to send · Shift + Enter for new line · Answers only from the uploaded document
                </p>
              </div>
            </Card>
          )}

          {/* Chat — disabled (file uploaded, extraction failed) */}
          {fileInfo && !chatEnabled && (
            <Card>
              <div style={{
                padding: '32px 24px',
                textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px',
                  background: 'rgba(192,57,43,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
                }}>🚫</div>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#8a2c1e', margin: '0 0 6px' }}>
                    Chat Unavailable
                  </p>
                  <p style={{ fontSize: '13px', color: '#9a8c7c', margin: '0 0 4px', lineHeight: 1.6 }}>
                    This file cannot be used for chat because no readable content was found.
                  </p>
                  <p style={{ fontSize: '12px', color: '#c4b49a', margin: 0 }}>
                    Replace the file above with a readable PDF, DOCX, or TXT.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Chat — no file yet */}
          {!fileInfo && (
            <Card>
              <div style={{
                padding: '28px 24px',
                textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: '#f0ebe3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                }}>💬</div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#9a8c7c', margin: 0 }}>
                  Chat becomes available after a document is uploaded
                </p>
                <p style={{ fontSize: '12px', color: '#c4b49a', margin: 0 }}>
                  Upload a file in Step 1 to get started
                </p>
              </div>
            </Card>
          )}
        </div>

      </div>
    </>
  );
};

export default DataManagementPage;
