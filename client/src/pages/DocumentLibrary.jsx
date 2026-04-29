import React, { useState, useRef, useEffect, useCallback } from 'react';
import { documentAPI } from '../services/api';

const C = {
  bg:         '#f5f4f0',
  surface:    '#ffffff',
  surfaceAlt: '#faf9f7',
  border:     '#e5e2db',
  accent:     '#BC6C5F',
  accentBg:   '#fdf2f0',
  text:       '#1a1714',
  sub:        '#6b6560',
  muted:      '#a09890',
  red:        '#dc2626',
  redBg:      '#fef2f2',
  green:      '#16a34a',
  greenBg:    '#f0fdf4',
  amber:      '#d97706',
  amberBg:    '#fffbeb',
  blue:       '#2563eb',
  blueBg:     '#eff6ff',
};

const getVal  = (f) => (f && typeof f === 'object' ? f.value       ?? '' : f ?? '');
const getConf = (f) => (f && typeof f === 'object' ? f.confidence  ?? '' : '');

/* ─────────── Atoms ─────────── */

const Spinner = ({ size = 20, color = C.accent }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    style={{ animation: 'lib-spin .75s linear infinite', display: 'block', flexShrink: 0 }}>
    <style>{`@keyframes lib-spin{to{transform:rotate(360deg)}}`}</style>
    <circle cx="12" cy="12" r="9" fill="none" stroke={color}
      strokeWidth="2.5" strokeDasharray="38 18" strokeLinecap="round" />
  </svg>
);

const ConfidenceBadge = ({ confidence }) => {
  const map = {
    HIGH:   { color: C.green, bg: C.greenBg, label: '● HIGH' },
    MEDIUM: { color: C.amber, bg: C.amberBg, label: '● MED'  },
    LOW:    { color: C.red,   bg: C.redBg,   label: '● LOW'  },
  };
  const m = map[confidence];
  if (!m) return null;
  return (
    <span style={{
      fontSize: '9.5px', fontWeight: 700, letterSpacing: '.04em',
      padding: '1px 7px', borderRadius: '99px',
      background: m.bg, color: m.color, border: `1px solid ${m.color}33`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>{m.label}</span>
  );
};

const VerifiedBadge = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    fontSize: '10.5px', fontWeight: 700,
    padding: '2px 9px', borderRadius: '99px',
    background: C.greenBg, color: C.green,
    border: `1px solid ${C.green}33`, whiteSpace: 'nowrap',
  }}>✓ Verified</span>
);

/* ─────────── Field definitions ─────────── */

const SD_FIELDS = [
  { key: 'petitioner',         label: 'Petitioner'           },
  { key: 'respondent',         label: 'Respondent'           },
  { key: 'court',              label: 'Court'                },
  { key: 'state',              label: 'State'                },
  { key: 'date',               label: 'Date'                 },
  { key: 'order_no',           label: 'Order No.'            },
  { key: 'citation',           label: 'Citation'             },
  { key: 'judges',             label: 'Judge(s)'             },
  { key: 'petitioner_counsel', label: 'Counsel (Petitioner)' },
  { key: 'respondent_counsel', label: 'Counsel (Respondent)' },
];

const AF_FIELDS = [
  { key: 'case_type',              label: 'Case Type',               array: false },
  { key: 'acts_involved',          label: 'Acts Involved',           array: false },
  { key: 'sections_involved',      label: 'Sections Involved',       array: true  },
  { key: 'relevant_notifications', label: 'Relevant Notifications',  array: true  },
  { key: 'relevant_circulars',     label: 'Relevant Circulars',      array: true  },
  { key: 'precedents_cited',       label: 'Case Law Citations',      array: true  },
  { key: 'key_issue',              label: 'Key Issue',               array: false },
  { key: 'final_decision',         label: 'Final Decision',          array: false },
  { key: 'decision_summary',       label: 'Decision Summary',        array: false },
  { key: 'important_observations', label: 'Important Observations',  array: false },
];

const buildDraft = (doc) => {
  const sd = doc.structured_data   || {};
  const af = doc.additional_fields || {};
  const sdDraft = {};
  SD_FIELDS.forEach(({ key }) => { sdDraft[key] = getVal(sd[key]); });
  const afDraft = {};
  AF_FIELDS.forEach(({ key, array }) => {
    const v = getVal(af[key]);
    afDraft[key] = array ? (Array.isArray(v) ? v.join(', ') : v) : v;
  });
  return { structured_data: sdDraft, additional_fields: afDraft, summary: doc.summary || '' };
};

/* ─────────── Upload Zone ─────────── */

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const UploadZone = ({ onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const [status,   setStatus]   = useState('idle');
  const [errMsg,   setErrMsg]   = useState('');
  const inputRef = useRef(null);

  const handle = async (file) => {
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setErrMsg('Only PDF, TXT, and DOCX files are supported.');
      setStatus('error');
      return;
    }
    setStatus('uploading');
    setErrMsg('');
    try {
      const res = await documentAPI.uploadAI(file);
      onUpload(res.data.data);
      setStatus('idle');
    } catch (err) {
      setErrMsg(err.response?.data?.message || 'Upload failed. Please try again.');
      setStatus('error');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handle(e.dataTransfer.files[0]);
  };

  return (
    <div
      onClick={() => status !== 'uploading' && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${dragging ? C.accent : '#d6cfc7'}`,
        borderRadius: '14px',
        padding: '32px 24px',
        textAlign: 'center',
        cursor: status === 'uploading' ? 'default' : 'pointer',
        background: dragging ? C.accentBg : C.surface,
        transition: 'all 0.18s',
        marginBottom: '20px',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.docx"
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])}
      />
      {status === 'uploading' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <Spinner size={34} />
          <div style={{ fontSize: '13.5px', color: C.sub, fontWeight: 500 }}>
            Extracting text, running AI analysis, storing to S3…
          </div>
          <div style={{ fontSize: '12px', color: C.muted }}>This may take 15–30 seconds</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '30px', marginBottom: '8px', lineHeight: 1 }}>📂</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
            Drop a file or click to browse
          </div>
          <div style={{ fontSize: '12px', color: C.muted }}>PDF, DOCX, TXT — max 50 MB</div>
          {status === 'error' && (
            <div style={{
              marginTop: '12px', padding: '8px 14px', borderRadius: '8px',
              background: C.redBg, border: `1px solid ${C.red}33`,
              color: C.red, fontSize: '12px', fontWeight: 500,
            }}>{errMsg}</div>
          )}
        </>
      )}
    </div>
  );
};

/* ─────────── Table skeleton ─────────── */

const SkeletonRow = ({ cols }) => (
  <tr>
    {[...Array(cols)].map((_, i) => (
      <td key={i} style={{ padding: '12px 13px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          height: '12px', borderRadius: '5px',
          background: 'linear-gradient(90deg,#f0ece6 25%,#e8e2da 50%,#f0ece6 75%)',
          backgroundSize: '400% 100%', animation: 'lib-shim 1.4s ease infinite',
          width: `${50 + (i * 13) % 40}%`,
        }} />
        <style>{`@keyframes lib-shim{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
      </td>
    ))}
  </tr>
);

/* ─────────── Library Table ─────────── */

const LibraryTable = ({ docs, loading, selectedId, onSelect }) => {
  const th = (label, width, center = false) => ({
    padding: '10px 13px', textAlign: center ? 'center' : 'left',
    fontSize: '11px', fontWeight: 700, color: C.sub, background: C.surfaceAlt,
    borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap',
    width, position: 'sticky', top: 0, zIndex: 2,
  });

  const td = (truncate = true) => ({
    padding: '10px 13px', fontSize: '12.5px', borderBottom: `1px solid ${C.border}`,
    maxWidth: truncate ? '160px' : 'auto',
    whiteSpace: truncate ? 'nowrap' : 'normal',
    overflow: 'hidden', textOverflow: 'ellipsis',
  });

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={th('Petitioner',     '20%')}>Petitioner</th>
              <th style={th('Respondent',     '18%')}>Respondent</th>
              <th style={th('Court',          '16%')}>Court</th>
              <th style={th('Date',           '9%' )}>Date</th>
              <th style={th('Final Decision', '13%')}>Final Decision</th>
              <th style={th('Verified',       '11%', true)}>Verified</th>
              <th style={th('Action',         '9%',  true)}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && [...Array(8)].map((_, i) => <SkeletonRow key={i} cols={7} />)}

            {!loading && docs.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '60px 24px', color: C.muted }}>
                  <div style={{ fontSize: '34px', marginBottom: '10px' }}>📭</div>
                  No documents found.
                </td>
              </tr>
            )}

            {!loading && docs.map((doc, i) => {
              const sd  = doc.structured_data   || {};
              const af  = doc.additional_fields || {};
              const sel = doc._id === selectedId;
              const rowBg = sel ? C.accentBg : i % 2 === 0 ? C.surface : C.surfaceAlt;

              return (
                <tr
                  key={doc._id}
                  onClick={() => onSelect(doc)}
                  style={{
                    background: rowBg, cursor: 'pointer', transition: 'background .1s',
                    outline: sel ? `2px solid ${C.accent}` : 'none', outlineOffset: '-2px',
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#f0ece8'; }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = rowBg; }}
                >
                  <td style={{ ...td(), color: getVal(sd.petitioner) ? C.text : C.muted, fontStyle: getVal(sd.petitioner) ? 'normal' : 'italic' }}>
                    {getVal(sd.petitioner) || '—'}
                  </td>
                  <td style={{ ...td(), color: getVal(sd.respondent) ? C.text : C.muted, fontStyle: getVal(sd.respondent) ? 'normal' : 'italic' }}>
                    {getVal(sd.respondent) || '—'}
                  </td>
                  <td style={{ ...td(), color: getVal(sd.court) ? C.text : C.muted, fontStyle: getVal(sd.court) ? 'normal' : 'italic' }}>
                    {getVal(sd.court) || '—'}
                  </td>
                  <td style={{ ...td(false), color: getVal(sd.date) ? C.text : C.muted, fontStyle: getVal(sd.date) ? 'normal' : 'italic', fontSize: '12px' }}>
                    {getVal(sd.date) || '—'}
                  </td>
                  <td style={{ ...td(false) }}>
                    {getVal(af.final_decision) ? (
                      <span style={{
                        padding: '2px 9px', borderRadius: '99px', fontSize: '11.5px', fontWeight: 600,
                        background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}33`,
                      }}>{getVal(af.final_decision)}</span>
                    ) : <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 13px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                    {doc.isVerified
                      ? <VerifiedBadge />
                      : <span style={{ color: C.muted, fontSize: '11px' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 13px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onSelect(doc); }}
                      style={{
                        padding: '4px 12px', borderRadius: '7px',
                        background: sel ? C.accent : C.accentBg,
                        color: sel ? '#fff' : C.accent,
                        border: `1px solid ${C.accent}44`,
                        fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{sel ? 'Viewing' : 'View →'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────── Pagination ─────────── */

const Pagination = ({ pagination, onPage }) => {
  const { total, page, limit, pages } = pagination;
  if (pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const btn = (active, disabled) => ({
    padding: '5px 10px', borderRadius: '7px', minWidth: '34px',
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent : C.surface,
    color: active ? '#fff' : disabled ? C.muted : C.sub,
    fontSize: '12.5px', fontWeight: active ? 700 : 500,
    cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
  });

  const visiblePages = () => {
    const delta = 2, range = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) range.push(i);
    if (range[0] > 1)                      { range.unshift('…'); range.unshift(1); }
    if (range[range.length - 1] < pages)   { range.push('…'); range.push(pages); }
    return range;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
      <span style={{ fontSize: '12px', color: C.muted }}>
        Showing {from}–{to} of {total} document{total !== 1 ? 's' : ''}
      </span>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button onClick={() => onPage(page - 1)} disabled={page === 1}     style={btn(false, page === 1)}>‹</button>
        {visiblePages().map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ padding: '5px 3px', color: C.muted, fontSize: '13px' }}>…</span>
            : <button key={p} onClick={() => onPage(p)} style={btn(p === page, false)}>{p}</button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page === pages} style={btn(false, page === pages)}>›</button>
      </div>
    </div>
  );
};

/* ─────────── View File Button ─────────── */

const ViewFileButton = ({ docId }) => {
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  const handleClick = async () => {
    setLoading(true); setErr('');
    try {
      const res = await documentAPI.getPresignedUrl(docId);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch { setErr('Could not open file.'); }
    finally   { setLoading(false); }
  };

  return (
    <div>
      <button
        onClick={handleClick} disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '7px 14px', borderRadius: '8px',
          background: loading ? C.muted : C.accent, color: '#fff',
          border: 'none', fontSize: '12.5px', fontWeight: 600,
          cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
          boxShadow: loading ? 'none' : '0 2px 6px rgba(188,108,95,.28)',
        }}
      >
        {loading && <Spinner size={13} color="#fff" />}
        {loading ? 'Opening…' : 'View File ↗'}
      </button>
      {err && <div style={{ marginTop: '4px', fontSize: '11px', color: C.red }}>{err}</div>}
    </div>
  );
};

/* ─────────── Section Label ─────────── */

const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: '10px', fontWeight: 700, color: C.muted,
    letterSpacing: '.1em', textTransform: 'uppercase', margin: '18px 0 8px',
  }}>{children}</div>
);

/* ─────────── Field Table Row (shared between view and edit mode) ─────────── */

const FieldRow = ({ label, isLast, editMode, viewContent, editContent }) => (
  <div style={{
    display: 'flex', alignItems: editMode ? 'center' : 'flex-start',
    borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
  }}>
    <div style={{
      width: '40%', flexShrink: 0, padding: '9px 13px',
      fontSize: '11.5px', fontWeight: 600, color: C.sub,
      borderRight: `1px solid ${C.border}`,
    }}>{label}</div>
    <div style={{ flex: 1, padding: editMode ? '6px 10px' : '9px 13px', minWidth: 0 }}>
      {editMode ? editContent : viewContent}
    </div>
  </div>
);

/* ─────────── Library Detail Panel — Edit + Verify ─────────── */

const LibraryDetailPanel = ({ doc: initialDoc, onClose, onDocUpdated }) => {
  const [doc,       setDoc]       = useState(initialDoc);
  const [editMode,  setEditMode]  = useState(false);
  const [draft,     setDraft]     = useState(() => buildDraft(initialDoc));
  const [saving,    setSaving]    = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saveErr,   setSaveErr]   = useState('');

  useEffect(() => {
    setDoc(initialDoc);
    setDraft(buildDraft(initialDoc));
    setEditMode(false);
    setSaveErr('');
  }, [initialDoc._id]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const sd = doc.structured_data   || {};
  const af = doc.additional_fields || {};

  const handleSave = async () => {
    setSaving(true); setSaveErr('');
    try {
      const payload = {
        summary: draft.summary,
        structured_data: draft.structured_data,
        additional_fields: Object.fromEntries(
          AF_FIELDS.map(({ key, array }) => [
            key,
            array
              ? draft.additional_fields[key].split(',').map(s => s.trim()).filter(Boolean)
              : draft.additional_fields[key],
          ])
        ),
      };
      const res     = await documentAPI.updateDocument(doc._id, payload);
      const updated = res.data.data;
      setDoc(updated);
      setDraft(buildDraft(updated));
      setEditMode(false);
      onDocUpdated(updated);
    } catch (err) {
      setSaveErr(err.response?.data?.message || 'Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res     = await documentAPI.toggleVerify(doc._id);
      const updated = res.data.data;
      setDoc(updated);
      onDocUpdated(updated);
    } catch { /* silent */ }
    finally   { setVerifying(false); }
  };

  const inputStyle = (multiline = false) => ({
    width: '100%', padding: '7px 10px', borderRadius: '7px',
    border: `1px solid ${C.border}`, background: C.surface,
    color: C.text, fontSize: '12.5px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
    resize: multiline ? 'vertical' : 'none',
    ...(multiline ? { minHeight: '80px' } : {}),
  });

  const onFocus = (e) => { e.target.style.borderColor = C.accent; };
  const onBlur  = (e) => { e.target.style.borderColor = C.border; };

  const sdInput = (key) => (
    <input
      value={draft.structured_data[key] || ''}
      onChange={e => setDraft(d => ({ ...d, structured_data: { ...d.structured_data, [key]: e.target.value } }))}
      style={inputStyle()}
      onFocus={onFocus} onBlur={onBlur}
    />
  );

  const afInput = (key, array) => (
    <input
      value={draft.additional_fields[key] || ''}
      onChange={e => setDraft(d => ({ ...d, additional_fields: { ...d.additional_fields, [key]: e.target.value } }))}
      placeholder={array ? 'Comma-separated values' : ''}
      style={inputStyle()}
      onFocus={onFocus} onBlur={onBlur}
    />
  );

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.25)',
        backdropFilter: 'blur(2px)', zIndex: 200,
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0,
        width: '520px', maxWidth: '92vw', height: '100vh',
        background: C.surface, borderLeft: `1px solid ${C.border}`,
        boxShadow: '-8px 0 40px rgba(0,0,0,.12)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'lib-slidein .2s ease',
      }}>
        <style>{`@keyframes lib-slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* ── Sticky header ── */}
        <div style={{
          padding: '16px 18px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          background: C.surface, flexShrink: 0,
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
            background: C.accentBg, border: `1px solid ${C.accent}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
          }}>📄</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '13px', fontWeight: 700, color: C.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px',
            }}>{doc.fileName}</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
              {getVal(sd.court) && (
                <span style={{
                  padding: '1px 8px', borderRadius: '99px', fontSize: '10.5px', fontWeight: 600,
                  background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}33`,
                }}>{getVal(sd.court)}</span>
              )}
              {doc.isVerified && <VerifiedBadge />}
              {doc.isEdited && (
                <span style={{
                  padding: '1px 8px', borderRadius: '99px', fontSize: '10.5px', fontWeight: 600,
                  background: C.blueBg, color: C.blue, border: `1px solid ${C.blue}33`,
                }}>Edited</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              color: C.sub, fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

          {/* Action row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <ViewFileButton docId={doc._id} />

            {!editMode && (
              <button
                onClick={() => { setEditMode(true); setSaveErr(''); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '7px 14px', borderRadius: '8px',
                  background: C.surface, border: `1px solid ${C.border}`,
                  color: C.sub, fontSize: '12.5px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.sub;    }}
              >✏ Edit</button>
            )}

            <button
              onClick={handleVerify}
              disabled={verifying}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '7px 14px', borderRadius: '8px',
                background: doc.isVerified ? C.greenBg : C.surface,
                border: `1px solid ${doc.isVerified ? C.green : C.border}`,
                color: doc.isVerified ? C.green : C.sub,
                fontSize: '12.5px', fontWeight: 600,
                cursor: verifying ? 'default' : 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              {verifying ? <Spinner size={13} color={doc.isVerified ? C.green : C.sub} /> : null}
              {doc.isVerified ? '✓ Verified' : 'Mark as Verified'}
            </button>
          </div>

          {/* ── Summary ── */}
          <SectionLabel>AI Summary</SectionLabel>
          {editMode ? (
            <textarea
              value={draft.summary}
              onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))}
              style={{ ...inputStyle(true), minHeight: '100px' }}
              onFocus={onFocus} onBlur={onBlur}
            />
          ) : doc.summary ? (
            <div style={{
              fontSize: '13px', color: C.sub, lineHeight: 1.7,
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              borderRadius: '10px', padding: '13px 15px',
            }}>{doc.summary}</div>
          ) : (
            <div style={{ fontSize: '13px', color: C.muted, fontStyle: 'italic' }}>No summary available.</div>
          )}

          {/* ── Structured Data ── */}
          <SectionLabel>Structured Data</SectionLabel>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
            {SD_FIELDS.map(({ key, label }, i) => (
              <div key={key} style={{ background: i % 2 === 0 ? C.surface : C.surfaceAlt }}>
                <FieldRow
                  label={label}
                  isLast={i === SD_FIELDS.length - 1}
                  editMode={editMode}
                  editContent={sdInput(key)}
                  viewContent={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '12.5px',
                        color: getVal(sd[key]) ? C.text : C.muted,
                        fontStyle: getVal(sd[key]) ? 'normal' : 'italic',
                        wordBreak: 'break-word',
                      }}>{getVal(sd[key]) || '—'}</span>
                      <ConfidenceBadge confidence={getConf(sd[key])} />
                    </div>
                  }
                />
              </div>
            ))}
          </div>

          {/* ── Additional Fields ── */}
          <SectionLabel>Additional Insights</SectionLabel>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '8px' }}>
            {AF_FIELDS.map(({ key, label, array }, i) => {
              const rawVal  = af[key];
              const dispVal = getVal(rawVal);
              const arrVal  = array
                ? (Array.isArray(dispVal) ? dispVal : [dispVal].filter(Boolean))
                : null;

              return (
                <div key={key} style={{ background: i % 2 === 0 ? C.surface : C.surfaceAlt }}>
                  <FieldRow
                    label={label}
                    isLast={i === AF_FIELDS.length - 1}
                    editMode={editMode}
                    editContent={afInput(key, array)}
                    viewContent={
                      array ? (
                        arrVal && arrVal.length ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {arrVal.map((v, idx) => (
                              <span key={idx} style={{
                                padding: '1px 8px', borderRadius: '99px', fontSize: '11px',
                                background: C.blueBg, color: C.blue, border: `1px solid ${C.blue}22`,
                              }}>{v}</span>
                            ))}
                          </div>
                        ) : <span style={{ fontSize: '12.5px', color: C.muted, fontStyle: 'italic' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '12.5px',
                            color: dispVal ? C.text : C.muted,
                            fontStyle: dispVal ? 'normal' : 'italic',
                            wordBreak: 'break-word',
                          }}>{dispVal || '—'}</span>
                          <ConfidenceBadge confidence={getConf(rawVal)} />
                        </div>
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sticky edit action bar ── */}
        {editMode && (
          <div style={{
            padding: '12px 18px', borderTop: `1px solid ${C.border}`,
            background: C.surface, display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
          }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, padding: '9px', borderRadius: '8px',
                background: saving ? C.muted : C.accent, color: '#fff',
                border: 'none', fontSize: '13px', fontWeight: 700,
                cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              }}
            >
              {saving && <Spinner size={14} color="#fff" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => { setEditMode(false); setDraft(buildDraft(doc)); setSaveErr(''); }}
              disabled={saving}
              style={{
                padding: '9px 18px', borderRadius: '8px',
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.sub, fontSize: '13px', fontWeight: 600,
                cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >Cancel</button>
            {saveErr && (
              <div style={{ fontSize: '11.5px', color: C.red, flexShrink: 0 }}>{saveErr}</div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

/* ─────────── DocumentLibrary — Main ─────────── */

const DocumentLibrary = () => {
  const [docs,       setDocs]       = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [selected,   setSelected]   = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [search,     setSearch]     = useState('');

  const fetchDocs = useCallback(async (page = 1, petitioner = '') => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 20 };
      if (petitioner.trim()) params.petitioner = petitioner.trim();
      const res = await documentAPI.getDocuments(params);
      setDocs(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, pages: 0 });
    } catch {
      setError('Failed to load documents. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(1); }, [fetchDocs]);

  const handleUpload = (newDoc) => {
    setShowUpload(false);
    fetchDocs(1, search);
    setSelected(newDoc);
  };

  const handleDocUpdated = (updated) => {
    setDocs(prev => prev.map(d => d._id === updated._id ? updated : d));
    setSelected(updated);
  };

  const handleSelect = (doc) => {
    setSelected(prev => prev?._id === doc._id ? null : doc);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(p => ({ ...p, page: 1 }));
    fetchDocs(1, search);
    setSelected(null);
  };

  const handleClearSearch = () => {
    setSearch('');
    setPagination(p => ({ ...p, page: 1 }));
    fetchDocs(1, '');
    setSelected(null);
  };

  const handlePage = (newPage) => {
    setPagination(p => ({ ...p, page: newPage }));
    fetchDocs(newPage, search);
    setSelected(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'inherit', padding: '32px 36px' }}>

      {/* ── Page header ── */}
      <div style={{
        marginBottom: '20px', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.text, letterSpacing: '-.5px' }}>
            GST Case Laws Library
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: '13.5px', color: C.sub }}>
            Upload, manage, edit, and verify GST case law documents. Click any row to view and edit details.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '9px 18px', borderRadius: '10px',
            background: showUpload ? C.surfaceAlt : C.accent,
            color: showUpload ? C.sub : '#fff',
            border: showUpload ? `1px solid ${C.border}` : 'none',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: showUpload ? 'none' : '0 2px 8px rgba(188,108,95,.3)',
            whiteSpace: 'nowrap',
          }}
        >{showUpload ? '✕ Close Upload' : '+ Upload Document'}</button>
      </div>

      {/* ── Upload zone ── */}
      {showUpload && <UploadZone onUpload={handleUpload} />}

      {/* ── Search ── */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '14px', color: C.muted, pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by petitioner name…"
            style={{
              width: '100%', padding: '9px 14px 9px 36px', borderRadius: '10px',
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.text, fontSize: '13.5px', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e  => e.target.style.borderColor = C.border}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '9px 18px', borderRadius: '10px', background: C.accent,
            color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Search</button>
        {search && (
          <button
            type="button"
            onClick={handleClearSearch}
            style={{
              padding: '9px 14px', borderRadius: '10px',
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.sub, fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Clear</button>
        )}
      </form>

      {/* ── Error ── */}
      {error && !loading && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', marginBottom: '14px',
          background: C.redBg, border: `1px solid ${C.red}33`,
          color: C.red, fontSize: '13px', fontWeight: 500,
        }}>{error}</div>
      )}

      {/* ── Table ── */}
      <LibraryTable
        docs={docs}
        loading={loading}
        selectedId={selected?._id}
        onSelect={handleSelect}
      />

      {/* ── Pagination ── */}
      <Pagination pagination={pagination} onPage={handlePage} />

      {/* ── Detail panel ── */}
      {selected && (
        <LibraryDetailPanel
          doc={selected}
          onClose={() => setSelected(null)}
          onDocUpdated={handleDocUpdated}
        />
      )}
    </div>
  );
};

export default DocumentLibrary;
