import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { aiChatUpdatedAPI, documentAPI } from '../services/api';

/* ── Palette ── */
const C = {
  bg:         '#f5f4f0',
  surface:    '#ffffff',
  surfaceAlt: '#faf9f7',
  border:     '#e5e2db',
  accent:     '#BC6C5F',
  accentBg:   '#fdf2f0',
  accentDark: '#9a5248',
  text:       '#1a1714',
  sub:        '#6b6560',
  muted:      '#a09890',
  userBubble: '#BC6C5F',
  green:      '#16a34a',
  greenBg:    '#f0fdf4',
  greenLight: '#dcfce7',
  amber:      '#d97706',
  amberBg:    '#fffbeb',
  blue:       '#2563eb',
  blueBg:     '#eff6ff',
};

const SUGGESTIONS = [
  'What are the recent GST rulings on input tax credit?',
  'Summarise cases related to GST on construction services.',
  'Show cases involving refund claims under GST.',
  'What courts have ruled on GST and e-commerce operators?',
];

/* ── Field value helpers ── */
const getVal = (f) => {
  if (!f) return '';
  if (typeof f !== 'object') return f;
  return f.value ?? '';
};

const hasValue = (field) => {
  const v = getVal(field);
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
};

/* ── Tag chip ── */
const tag = {
  display: 'inline-block', padding: '1px 7px', borderRadius: '5px',
  fontSize: '11px', background: C.blueBg, color: C.blue,
  border: `1px solid ${C.blue}22`, whiteSpace: 'nowrap',
};

/* ── Simple markdown renderer: **bold**, newlines ── */
const renderText = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part.split('\n').map((line, j, arr) => (
      <React.Fragment key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  });
};

/* ─────────── Atoms ─────────── */

const ScoreBadge = ({ score }) => {
  const pct   = Math.round((score ?? 0) * 100);
  const color = pct >= 85 ? C.green  : pct >= 65 ? C.amber  : C.muted;
  const bg    = pct >= 85 ? C.greenLight : pct >= 65 ? '#fef9c3' : '#f4f4f5';
  return (
    <span style={{
      padding: '2px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
      color, background: bg, border: `1px solid ${color}44`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {pct}% match
    </span>
  );
};

const BestMatchBadge = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '2px 8px', borderRadius: '99px', fontSize: '10.5px', fontWeight: 700,
    background: C.greenLight, color: C.green, border: `1px solid ${C.green}44`,
    whiteSpace: 'nowrap',
  }}>★ Best Match</span>
);

const VerifiedChip = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '2px 8px', borderRadius: '99px', fontSize: '10.5px', fontWeight: 700,
    background: C.greenBg, color: C.green, border: `1px solid ${C.green}33`,
    whiteSpace: 'nowrap',
  }}>✓ Verified</span>
);

const TypingDots = () => (
  <div style={{ display: 'flex', gap: '5px', padding: '6px 4px', alignItems: 'center' }}>
    <style>{`@keyframes ac-bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}`}</style>
    {[0, 160, 320].map(delay => (
      <div key={delay} style={{
        width: '7px', height: '7px', borderRadius: '50%', background: C.muted,
        animation: `ac-bounce 1.2s ${delay}ms ease-in-out infinite`,
      }} />
    ))}
  </div>
);

/* ─────────── FieldCell — compact 2-col card grid ─────────── */

const FieldCell = memo(({ label, field }) => {
  const val   = getVal(field);
  const isArr = Array.isArray(val);

  return (
    <div>
      <div style={{
        fontSize: '9.5px', fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '3px',
      }}>{label}</div>
      {isArr ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {val.slice(0, 3).map((v, i) => <span key={i} style={tag}>{v}</span>)}
          {val.length > 3 && (
            <span style={{ fontSize: '10.5px', color: C.muted, alignSelf: 'center' }}>+{val.length - 3}</span>
          )}
        </div>
      ) : (
        <span style={{
          fontSize: '12px', color: C.text, lineHeight: 1.4, wordBreak: 'break-word', display: 'block',
        }}>{val || '—'}</span>
      )}
    </div>
  );
});

/* ─────────── DetailFieldRow — single-col expanded list ─────────── */

const DetailFieldRow = memo(({ label, field, wide }) => {
  const val   = getVal(field);
  const isArr = Array.isArray(val);

  return (
    <div style={{
      display: 'flex',
      flexDirection: wide ? 'column' : 'row',
      gap: wide ? '3px' : '8px',
      alignItems: 'flex-start',
    }}>
      <span style={{
        fontSize: '10.5px', fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '.05em',
        flexShrink: 0, minWidth: wide ? 'auto' : '130px',
      }}>{label}</span>
      <div style={{ flex: 1 }}>
        {isArr ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {val.map((v, i) => <span key={i} style={tag}>{v}</span>)}
          </div>
        ) : (
          <span style={{
            fontSize: '12.5px', color: wide ? C.sub : C.text,
            lineHeight: 1.65, wordBreak: 'break-word', display: 'block',
          }}>{val}</span>
        )}
      </div>
    </div>
  );
});

/* ─────────── View File Button ─────────── */

const ViewFileButton = memo(({ docId }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await documentAPI.getPresignedUrl(docId);
      if (res.data?.url) window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '7px 14px', borderRadius: '8px',
        background: loading ? C.border : C.accentBg,
        border: `1px solid ${loading ? C.border : C.accent + '55'}`,
        color: loading ? C.muted : C.accent,
        fontSize: '12px', fontWeight: 600,
        cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (!loading) {
          e.currentTarget.style.background = C.accent;
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.borderColor = C.accent;
        }
      }}
      onMouseLeave={e => {
        if (!loading) {
          e.currentTarget.style.background = C.accentBg;
          e.currentTarget.style.color = C.accent;
          e.currentTarget.style.borderColor = C.accent + '55';
        }
      }}
    >
      {loading ? 'Loading…' : 'View Full Document ↗'}
    </button>
  );
});

/* ─────────── DocumentCard ─────────── */

const QUICK_SD_KEYS  = ['petitioner', 'respondent', 'court', 'state', 'date'];
const DETAIL_SD_KEYS = ['order_no', 'citation', 'judges', 'petitioner_counsel', 'respondent_counsel'];

const SD_LABELS = {
  petitioner:         'Petitioner',
  respondent:         'Respondent',
  court:              'Court',
  state:              'State',
  date:               'Date',
  order_no:           'Order No.',
  citation:           'Citation',
  judges:             'Judge(s)',
  petitioner_counsel: 'Petitioner Counsel',
  respondent_counsel: 'Respondent Counsel',
};

const AF_LABELS = {
  case_type:              'Case Type',
  acts_involved:          'Acts Involved',
  sections_involved:      'Sections Involved',
  key_issue:              'Key Issue',
  final_decision:         'Final Decision',
  decision_summary:       'Decision Summary',
  important_observations: 'Important Observations',
  precedents_cited:       'Case Law Citations',
  relevant_notifications: 'Relevant Notifications',
  relevant_circulars:     'Relevant Circulars',
};

const AF_WIDE = new Set(['key_issue', 'decision_summary', 'important_observations']);

/* Quick AF fields (always visible in the Key Details grid) */
const QUICK_AF_KEYS = ['final_decision'];

/* Legal reference array keys — shown in the always-visible LegalReferencesBlock */
const REF_KEYS = ['sections_involved', 'relevant_notifications', 'relevant_circulars', 'precedents_cited'];

/* Detail AF fields (behind "Show Full Details") — reference arrays handled separately */
const DETAIL_AF_KEYS = [
  'case_type', 'acts_involved',
  'key_issue', 'decision_summary',
  'important_observations',
];

/* ─────────── LegalReferencesBlock ─────────── */

const RefRow = ({ icon, label, items, chipColor = C.blue, chipBg = C.blueBg }) => {
  const arr = Array.isArray(items) ? items : [items].filter(Boolean);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minHeight: '20px' }}>
      <span style={{
        fontSize: '10px', fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '.06em',
        flexShrink: 0, minWidth: '88px', paddingTop: '1px',
      }}>{icon} {label}</span>
      {arr.length === 0 ? (
        <span style={{ fontSize: '11.5px', color: C.muted, fontStyle: 'italic' }}>None</span>
      ) : label === 'Sections' ? (
        /* Sections always shown as chips */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {arr.slice(0, 6).map((v, i) => (
            <span key={i} style={{
              padding: '1px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
              background: chipBg, color: chipColor, border: `1px solid ${chipColor}22`,
              whiteSpace: 'nowrap',
            }}>{v}</span>
          ))}
          {arr.length > 6 && (
            <span style={{ fontSize: '10.5px', color: C.muted, alignSelf: 'center' }}>
              +{arr.length - 6} more
            </span>
          )}
        </div>
      ) : (
        /* Notifications / Circulars / Citations: first item as text + overflow count */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
          <span style={{
            fontSize: '11.5px', color: C.text, lineHeight: 1.4,
            maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{arr[0]}</span>
          {arr.length > 1 && (
            <span style={{
              fontSize: '10.5px', color: C.muted, flexShrink: 0,
              padding: '1px 6px', borderRadius: '99px',
              background: '#f0f0ef', border: `1px solid ${C.border}`,
            }}>+{arr.length - 1} more</span>
          )}
        </div>
      )}
    </div>
  );
};

const LegalReferencesBlock = memo(({ af, isBestMatch }) => {
  const sections      = (() => { const v = getVal(af.sections_involved);      return Array.isArray(v) ? v : [v].filter(Boolean); })();
  const notifications = (() => { const v = getVal(af.relevant_notifications); return Array.isArray(v) ? v : [v].filter(Boolean); })();
  const circulars     = (() => { const v = getVal(af.relevant_circulars);     return Array.isArray(v) ? v : [v].filter(Boolean); })();
  const citations     = (() => { const v = getVal(af.precedents_cited);       return Array.isArray(v) ? v : [v].filter(Boolean); })();

  const hasAny = sections.length || notifications.length || circulars.length || citations.length;

  const dividerColor = isBestMatch ? `${C.green}33` : C.border;

  return (
    <div style={{
      borderTop: `1px solid ${dividerColor}`,
      borderBottom: `1px solid ${dividerColor}`,
      paddingTop: '10px',
      paddingBottom: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: C.muted,
        letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px',
      }}>Legal References</div>

      <RefRow icon="§"  label="Sections"      items={sections}      chipColor={C.blue}   chipBg={C.blueBg}  />
      <RefRow icon="📋" label="Notifications"  items={notifications} chipColor={C.accent} chipBg={C.accentBg} />
      {circulars.length > 0 && (
        <RefRow icon="🔄" label="Circulars" items={circulars} chipColor="#7c3aed" chipBg="#f5f3ff" />
      )}
      <RefRow icon="⚖"  label="Citations"     items={citations}     chipColor={C.sub}    chipBg="#f4f4f5"   />
    </div>
  );
});

const DocumentCard = memo(({ doc, rank }) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered,  setHovered]  = useState(false);

  const isBestMatch = rank < 2;
  const pct         = Math.round((doc.score ?? 0) * 100);
  const sd          = doc.structured_data   || {};
  const af          = doc.additional_fields || {};

  /* ── Quick fields: petitioner, respondent, court, state, date, final decision ── */
  const quickPairs = [
    ...QUICK_SD_KEYS.map(k => ({ label: SD_LABELS[k], field: sd[k] })),
    { label: AF_LABELS.final_decision, field: af.final_decision },
  ].filter(p => hasValue(p.field));

  /* ── Detail fields: all remaining structured + additional ── */
  const detailPairs = [
    ...DETAIL_SD_KEYS.map(k => ({ label: SD_LABELS[k], field: sd[k], wide: false })),
    ...DETAIL_AF_KEYS
      .filter(k => k !== 'final_decision')
      .map(k => ({ label: AF_LABELS[k], field: af[k], wide: AF_WIDE.has(k) })),
  ].filter(p => hasValue(p.field));

  /* ── Card appearance based on match level ── */
  const cardBg = isBestMatch
    ? (hovered ? '#e8faf0' : C.greenBg)
    : (hovered ? '#faf9f7' : C.surface);

  const cardBorder = isBestMatch
    ? `1.5px solid ${hovered ? C.green + '55' : C.green + '33'}`
    : `1px solid ${hovered ? C.accent + '55' : C.border}`;

  const cardShadow = isBestMatch
    ? '0 4px 20px rgba(34,197,94,0.10), 0 2px 8px rgba(0,0,0,0.04)'
    : hovered
    ? '0 4px 16px rgba(188,108,95,0.08)'
    : '0 1px 6px rgba(0,0,0,0.04)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        opacity: pct < 40 ? 0.85 : 1,
      }}
    >
      {/* ── Header: icon + filename + badges ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '15px', flexShrink: 0 }}>📄</span>
          <span style={{
            fontSize: '13px', fontWeight: 700, color: C.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{doc.fileName}</span>
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
          {doc.isVerified && <VerifiedChip />}
          {isBestMatch && <BestMatchBadge />}
          <ScoreBadge score={doc.score} />
        </div>
      </div>

      {/* ── Quick fields grid ── */}
      {quickPairs.length > 0 && (
        <div>
          <div style={{
            fontSize: '10px', fontWeight: 700, color: C.muted,
            letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '8px',
          }}>Key Details</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: quickPairs.length >= 4 ? '1fr 1fr' : '1fr',
            gap: '6px 16px',
          }}>
            {quickPairs.map(({ label, field }) => (
              <FieldCell key={label} label={label} field={field} />
            ))}
          </div>
        </div>
      )}

      {/* ── Legal References (sections / notifications / circulars / citations) ── */}
      <LegalReferencesBlock af={af} isBestMatch={isBestMatch} />

      {/* ── Summary ── */}
      {doc.summary && (
        <div>
          <div style={{
            fontSize: '10px', fontWeight: 700, color: C.muted,
            letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '5px',
          }}>Summary</div>
          <p style={{ margin: 0, fontSize: '12.5px', color: C.sub, lineHeight: 1.65 }}>
            {doc.summary.length > 240
              ? doc.summary.slice(0, 240).trimEnd() + '…'
              : doc.summary}
          </p>
        </div>
      )}

      {/* ── Expand toggle ── */}
      {detailPairs.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'none', border: 'none',
              color: C.accent, fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              padding: '0', display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            <span style={{
              display: 'inline-block',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
              fontSize: '9px',
            }}>▶</span>
            {expanded ? 'Hide Details' : `Show Full Details (${detailPairs.length} more fields)`}
          </button>

          {expanded && (
            <div style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: `1px dashed ${isBestMatch ? C.green + '44' : C.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {detailPairs.map(({ label, field, wide }) => (
                <DetailFieldRow key={label} label={label} field={field} wide={wide} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── View file button ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '2px' }}>
        <ViewFileButton docId={doc._id} />
      </div>
    </div>
  );
});

/* ─────────── RelatedDocuments section ─────────── */

const RelatedDocuments = ({ results }) => {
  const bestCount = Math.min(2, results.length);

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px',
      }}>
        <span style={{ fontSize: '13px' }}>📎</span>
        <span style={{
          fontSize: '11.5px', fontWeight: 700, color: C.sub,
          letterSpacing: '.06em', textTransform: 'uppercase',
        }}>Related Documents</span>
        <span style={{
          fontSize: '10.5px', fontWeight: 700, padding: '1px 8px', borderRadius: '99px',
          background: C.border, color: C.sub,
        }}>{results.length}</span>
        {bestCount > 0 && (
          <span style={{ fontSize: '11px', color: C.muted }}>
            · Top {bestCount} highlighted
          </span>
        )}
      </div>

      {/* Cards — already sorted by score descending from backend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {results.map((doc, idx) => (
          <DocumentCard key={doc.uniqueId || doc._id} doc={doc} rank={idx} />
        ))}
      </div>
    </div>
  );
};

/* ─────────── AssistantMessage ─────────── */

const AssistantMessage = ({ answer, results }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '92%' }}>
    {/* Avatar */}
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
      background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14px', boxShadow: '0 2px 8px rgba(188,108,95,0.3)',
    }}>⚖️</div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, minWidth: 0 }}>
      {/* AI Answer card */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: '4px 16px 16px 16px', padding: '16px 18px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', color: C.accent }}>✦</span>
          <span style={{
            fontSize: '11.5px', fontWeight: 700, color: C.accent,
            letterSpacing: '.06em', textTransform: 'uppercase',
          }}>AI Answer</span>
        </div>
        <p style={{ margin: 0, fontSize: '13.5px', color: C.text, lineHeight: 1.75 }}>
          {renderText(answer)}
        </p>
      </div>

      {/* Related documents */}
      {results?.length > 0 && <RelatedDocuments results={results} />}

      {/* No results */}
      {results?.length === 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px',
          background: C.bg, border: `1px dashed ${C.border}`,
          fontSize: '12.5px', color: C.muted,
        }}>
          No matching documents found in the knowledge base.
        </div>
      )}
    </div>
  </div>
);

/* ─────────── UserMessage ─────────── */

const UserMessage = ({ text }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
    <div style={{
      maxWidth: '72%', background: C.userBubble, color: '#fff',
      borderRadius: '16px 16px 4px 16px', padding: '11px 16px',
      fontSize: '13.5px', lineHeight: 1.6, boxShadow: '0 2px 10px rgba(188,108,95,0.25)',
    }}>
      {text}
    </div>
  </div>
);

/* ─────────── Loading bubble ─────────── */

const LoadingBubble = () => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
      background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14px', boxShadow: '0 2px 8px rgba(188,108,95,0.3)',
    }}>⚖️</div>
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: '4px 16px 16px 16px', padding: '12px 16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '11.5px', color: C.muted, marginBottom: '4px' }}>
        Searching case laws…
      </div>
      <TypingDots />
    </div>
  </div>
);

/* ─────────── Empty state ─────────── */

const EmptyState = ({ onSuggestion }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1, padding: '40px 24px', gap: '24px',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '18px',
        background: C.accentBg, border: `1.5px solid ${C.accent}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px', margin: '0 auto 16px',
        boxShadow: '0 4px 20px rgba(188,108,95,0.12)',
      }}>⚖️</div>
      <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: C.text, letterSpacing: '-.3px' }}>
        Ask about GST Case Laws
      </h2>
      <p style={{ margin: 0, fontSize: '13.5px', color: C.sub, maxWidth: '360px', lineHeight: 1.6 }}>
        Search through uploaded case law documents and get AI-generated answers backed by real rulings.
      </p>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '520px' }}>
      <span style={{
        fontSize: '11px', fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '2px',
      }}>Try asking</span>
      {SUGGESTIONS.map(s => (
        <button
          key={s}
          onClick={() => onSuggestion(s)}
          style={{
            padding: '10px 14px', borderRadius: '10px',
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.sub, fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            transition: 'border-color 0.15s, color 0.15s, background 0.15s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = C.accent + '66';
            e.currentTarget.style.color       = C.text;
            e.currentTarget.style.background  = C.accentBg;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.color       = C.sub;
            e.currentTarget.style.background  = C.surface;
          }}
        >{s}</button>
      ))}
    </div>
  </div>
);

/* ─────────── Main page ─────────── */

let _msgId = 0;
const uid = () => ++_msgId;

const AIChatUpdated = () => {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const submit = useCallback(async (query) => {
    const text = (query ?? input).trim();
    if (!text || isLoading) return;

    setInput('');
    setIsLoading(true);

    const userMsg = { id: uid(), role: 'user', text };
    const aiMsg   = { id: uid(), role: 'assistant', text: '', results: [], loading: true };

    setMessages(prev => [...prev, userMsg, aiMsg]);

    try {
      const res  = await aiChatUpdatedAPI.query(text);
      const data = res.data;
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsg.id
            ? { ...m, text: data.answer, results: data.results || [], loading: false }
            : m
        )
      );
    } catch (err) {
      const errText = err.response?.data?.message || 'Something went wrong. Please try again.';
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsg.id
            ? { ...m, text: errText, results: [], loading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: C.bg, fontFamily: 'inherit',
    }}>

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 28px', background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)', flexShrink: 0, zIndex: 10,
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '17px', boxShadow: '0 2px 10px rgba(188,108,95,0.35)',
        }}>⚖️</div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, letterSpacing: '-.3px' }}>
            AI Chat
          </div>
          <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '1px' }}>
            Answers grounded in your uploaded GST case law documents
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{
              marginLeft: 'auto', padding: '6px 14px', borderRadius: '8px',
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.muted;  }}
          >Clear chat</button>
        )}
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 28px',
        display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        {messages.length === 0
          ? <EmptyState onSuggestion={s => submit(s)} />
          : messages.map(msg => {
              if (msg.role === 'user')   return <UserMessage key={msg.id} text={msg.text} />;
              if (msg.loading)           return <LoadingBubble key={msg.id} />;
              return (
                <AssistantMessage key={msg.id} answer={msg.text} results={msg.results} />
              );
            })
        }
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      <div style={{
        padding: '14px 28px 18px', background: C.surface,
        borderTop: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: '10px',
            background: C.bg, border: `1.5px solid ${C.border}`,
            borderRadius: '14px', padding: '10px 10px 10px 16px',
            transition: 'border-color 0.2s',
          }}
          onFocusCapture={e => e.currentTarget.style.borderColor = C.accent + '88'}
          onBlurCapture={e  => e.currentTarget.style.borderColor = C.border}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about GST case laws…"
            rows={1}
            disabled={isLoading}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '13.5px', color: C.text, fontFamily: 'inherit',
              lineHeight: 1.55, resize: 'none', maxHeight: '120px', overflowY: 'auto', padding: 0,
            }}
          />
          <button
            onClick={() => submit()}
            disabled={!input.trim() || isLoading}
            style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: (!input.trim() || isLoading) ? C.border : C.accent,
              border: 'none',
              color: (!input.trim() || isLoading) ? C.muted : '#fff',
              fontSize: '16px', cursor: (!input.trim() || isLoading) ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {isLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24"
                style={{ animation: 'ac-spin 0.7s linear infinite' }}>
                <style>{`@keyframes ac-spin{to{transform:rotate(360deg)}}`}</style>
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeDasharray="38 18" strokeLinecap="round" />
              </svg>
            ) : '↑'}
          </button>
        </div>
        <p style={{ margin: '7px 0 0', fontSize: '11px', color: C.muted, textAlign: 'center' }}>
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default AIChatUpdated;
