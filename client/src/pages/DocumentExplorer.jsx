import React, { useState, useEffect, useCallback, useRef } from 'react';
import { documentAPI } from '../services/api';

/* ── Palette ── */
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
  purple:     '#7c3aed',
  purpleBg:   '#f5f3ff',
};

const getVal  = (f) => (f && typeof f === 'object' ? f.value      ?? '' : f ?? '');
const getConf = (f) => (f && typeof f === 'object' ? f.confidence ?? '' : '');

const EMPTY_FILTERS = {
  petitioner: '', respondent: '', court: '', state: '',
  dateFrom: '', dateTo: '', caseType: '', finalDecision: '',
  sections: '', judges: '', counsel: '', isVerified: '', confidence: '',
};

/* ─────────── Atoms ─────────── */

const Spinner = ({ size = 20, color = C.accent }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    style={{ animation: 'ex-spin .75s linear infinite', display: 'block', flexShrink: 0 }}>
    <style>{`@keyframes ex-spin{to{transform:rotate(360deg)}}`}</style>
    <circle cx="12" cy="12" r="9" fill="none" stroke={color}
      strokeWidth="2.5" strokeDasharray="38 18" strokeLinecap="round" />
  </svg>
);

const ConfidenceBadge = ({ confidence }) => {
  const map = {
    HIGH:   { color: C.green, bg: C.greenBg, label: '● HIGH',   title: 'Verified — explicitly stated in document' },
    MEDIUM: { color: C.amber, bg: C.amberBg, label: '● MED',    title: 'AI Inferred — logically derived' },
    LOW:    { color: C.red,   bg: C.redBg,   label: '● LOW',    title: 'Low confidence — not found in document' },
  };
  const m = map[confidence];
  if (!m) return null;
  return (
    <span title={m.title} style={{
      fontSize: '9.5px', fontWeight: 700, letterSpacing: '.04em',
      padding: '1px 7px', borderRadius: '99px',
      background: m.bg, color: m.color, border: `1px solid ${m.color}33`,
      whiteSpace: 'nowrap', flexShrink: 0, cursor: 'help',
    }}>{m.label}</span>
  );
};

const TrustBadge = ({ doc }) => {
  if (doc.isVerified) {
    return (
      <span title="User-verified data" style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
        background: C.greenBg, color: C.green, border: `1px solid ${C.green}33`,
      }}>✓ Verified</span>
    );
  }
  const conf = getConf(doc.structured_data?.petitioner);
  if (conf === 'HIGH') {
    return (
      <span title="AI extracted with high confidence" style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
        background: C.blueBg, color: C.blue, border: `1px solid ${C.blue}33`,
      }}>AI High</span>
    );
  }
  if (conf === 'MEDIUM') {
    return (
      <span title="AI inferred — may need verification" style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
        background: C.amberBg, color: C.amber, border: `1px solid ${C.amber}33`,
      }}>AI Inferred</span>
    );
  }
  return (
    <span title="Low confidence — needs review" style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
      background: C.redBg, color: C.red, border: `1px solid ${C.red}33`,
    }}>Low Conf.</span>
  );
};

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

/* ─────────── Smart Search Bar ─────────── */

const SmartSearchBar = ({ onSearch, loading, placeholder }) => {
  const [q, setQ]             = useState('');
  const [showHint, setShowHint] = useState(false);
  const debounceRef           = useRef(null);
  const inputRef              = useRef(null);

  const EXAMPLES = [
    'section 73 set aside cases in Gujarat',
    'ITC reversal dismissed Bombay High Court',
    'section 16(4) allowed 2023',
    'AAAR advance ruling Karnataka',
    'fake invoices section 74 remanded',
  ];

  const submit = (val) => {
    const v = val ?? q;
    if (!v.trim()) return;
    onSearch(v.trim());
    setShowHint(false);
  };

  const handleChange = (e) => {
    setQ(e.target.value);
    clearTimeout(debounceRef.current);
    if (e.target.value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => submit(e.target.value.trim()), 600);
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: C.surface, border: `1.5px solid ${C.accent}`,
        borderRadius: '12px', padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(188,108,95,.12)',
      }}>
        <span style={{ fontSize: '16px', color: C.accent, flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          value={q}
          onChange={handleChange}
          onKeyDown={e => e.key === 'Enter' && submit()}
          onFocus={() => setShowHint(true)}
          onBlur={() => setTimeout(() => setShowHint(false), 200)}
          placeholder={placeholder || 'Search case laws… e.g. "section 73 set aside Gujarat"'}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: '14px', color: C.text, fontFamily: 'inherit',
          }}
        />
        {loading && <Spinner size={16} />}
        {q && !loading && (
          <button onClick={() => { setQ(''); onSearch(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '16px', padding: 0 }}>×</button>
        )}
        <button
          onClick={() => submit()}
          disabled={!q.trim() || loading}
          style={{
            padding: '6px 14px', borderRadius: '8px',
            background: q.trim() && !loading ? C.accent : C.muted,
            color: '#fff', border: 'none', fontSize: '12.5px', fontWeight: 600,
            cursor: q.trim() && !loading ? 'pointer' : 'default', fontFamily: 'inherit',
            flexShrink: 0, transition: 'background .15s',
          }}
        >Search</button>
      </div>

      {/* Hint dropdown */}
      {showHint && !q && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,.1)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Example Queries
          </div>
          {EXAMPLES.map((ex, i) => (
            <button key={i}
              onMouseDown={() => { setQ(ex); submit(ex); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 14px', background: 'none', border: 'none',
                fontSize: '12.5px', color: C.sub, cursor: 'pointer',
                fontFamily: 'inherit', borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.accentBg}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ color: C.accent, marginRight: '6px' }}>→</span>{ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────── Filter Panel ─────────── */

const FINAL_DECISIONS = ['Allowed', 'Dismissed', 'Set Aside', 'Remanded', 'Stayed', 'Disposed', 'Partly Allowed', 'Upheld'];
const CONFIDENCE_OPTS = [
  { value: 'HIGH',   label: 'High Confidence'   },
  { value: 'MEDIUM', label: 'Medium Confidence' },
];

const FilterPanel = ({ draft, onChange, onApply, onReset, loading, options }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const inp = (key, ph) => (
    <input type="text" value={draft[key]} placeholder={ph}
      onChange={e => onChange({ ...draft, [key]: e.target.value })}
      onKeyDown={e => e.key === 'Enter' && onApply()}
      style={{
        width: '100%', padding: '7px 10px', borderRadius: '7px',
        border: `1px solid ${C.border}`, background: C.surface,
        color: C.text, fontSize: '12.5px', fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box',
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e  => e.target.style.borderColor = C.border}
    />
  );

  const sel = (key, opts, ph) => (
    <select value={draft[key]} onChange={e => onChange({ ...draft, [key]: e.target.value })}
      style={{
        width: '100%', padding: '7px 10px', borderRadius: '7px',
        border: `1px solid ${C.border}`, background: C.surface,
        color: draft[key] ? C.text : C.muted,
        fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
      }}
    >
      <option value="">{ph}</option>
      {opts.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );

  const dateInp = (key) => (
    <input type="date" value={draft[key]} onChange={e => onChange({ ...draft, [key]: e.target.value })}
      style={{
        width: '100%', padding: '7px 10px', borderRadius: '7px',
        border: `1px solid ${C.border}`, background: C.surface,
        color: draft[key] ? C.text : C.muted, fontSize: '12.5px',
        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e  => e.target.style.borderColor = C.border}
    />
  );

  const col = (label, children) => (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: C.sub, marginBottom: '4px' }}>{label}</div>
      {children}
    </div>
  );

  const activeCount = Object.values(draft).filter(v => v !== '' && v !== false).length;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: '14px', padding: '16px 18px', marginBottom: '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: C.muted, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Filters
          </span>
          {activeCount > 0 && (
            <span style={{
              fontSize: '10.5px', fontWeight: 700, padding: '1px 7px',
              borderRadius: '99px', background: C.accentBg, color: C.accent,
              border: `1px solid ${C.accent}44`,
            }}>{activeCount} active</span>
          )}
        </div>
        <button onClick={() => setShowAdvanced(v => !v)}
          style={{ background: 'none', border: 'none', fontSize: '12px', color: C.accent, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: '2px 0' }}
        >{showAdvanced ? 'Hide advanced ▲' : 'Advanced filters ▼'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
        {col('Petitioner',  inp('petitioner',  'e.g. Rohan Traders'))}
        {col('Respondent',  inp('respondent',  'e.g. Commissioner'))}
        {col('Court',       sel('court', options.courts || [], 'All courts'))}
        {col('State',       sel('state', options.states || [], 'All states'))}
        {col('Date From',   dateInp('dateFrom'))}
        {col('Date To',     dateInp('dateTo'))}
      </div>

      {showAdvanced && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '10px', paddingTop: '10px',
          borderTop: `1px dashed ${C.border}`, marginBottom: '10px',
        }}>
          {col('Case Type',      sel('caseType',      options.caseTypes     || [], 'All types'))}
          {col('Final Decision', sel('finalDecision', FINAL_DECISIONS,             'All decisions'))}
          {col('Sections',       inp('sections',      'e.g. 74, 16(4)'))}
          {col('Judges',         inp('judges',        'Judge name'))}
          {col('Counsel',        inp('counsel',       'Counsel name'))}
          {col('Confidence',     sel('confidence',    CONFIDENCE_OPTS,             'Any confidence'))}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: C.sub, marginBottom: '4px' }}>Only Verified</div>
            <button
              onClick={() => onChange({ ...draft, isVerified: draft.isVerified === 'true' ? '' : 'true' })}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: '7px', cursor: 'pointer',
                border: `1px solid ${draft.isVerified === 'true' ? C.green : C.border}`,
                background: draft.isVerified === 'true' ? C.greenBg : C.surface,
                color: draft.isVerified === 'true' ? C.green : C.sub,
                fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s',
              }}
            >{draft.isVerified === 'true' ? '✓ Verified Only' : 'Show All'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onApply} disabled={loading}
          style={{
            padding: '8px 18px', borderRadius: '8px', background: C.accent,
            color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: '7px', opacity: loading ? .75 : 1,
          }}
        >
          {loading && <Spinner size={13} color="#fff" />}
          Apply Filters
        </button>
        <button onClick={onReset}
          style={{
            padding: '8px 18px', borderRadius: '8px', background: 'transparent',
            color: C.sub, border: `1px solid ${C.border}`, fontSize: '13px',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
        >Clear All</button>
      </div>
    </div>
  );
};

/* ─────────── Active Filter Tags ─────────── */

const FILTER_LABELS = {
  petitioner: 'Petitioner', respondent: 'Respondent', court: 'Court', state: 'State',
  dateFrom: 'From', dateTo: 'To', caseType: 'Case Type', finalDecision: 'Decision',
  sections: 'Sections', judges: 'Judges', counsel: 'Counsel', isVerified: 'Verified Only', confidence: 'Confidence',
};

const ActiveFilterTags = ({ filters, onChange }) => {
  const active = Object.entries(filters).filter(([, v]) => v !== '' && v !== false);
  if (!active.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
      {active.map(([key, val]) => (
        <span key={key} style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: '99px',
          background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}44`,
          fontSize: '11.5px', fontWeight: 600,
        }}>
          {FILTER_LABELS[key]}: {val === 'true' ? 'Yes' : val}
          <button onClick={() => onChange({ ...filters, [key]: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
        </span>
      ))}
    </div>
  );
};

/* ─────────── Table skeletons ─────────── */

const SkeletonRow = ({ cols }) => (
  <tr>
    {[...Array(cols)].map((_, i) => (
      <td key={i} style={{ padding: '12px 13px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          height: '12px', borderRadius: '5px',
          background: 'linear-gradient(90deg,#f0ece6 25%,#e8e2da 50%,#f0ece6 75%)',
          backgroundSize: '400% 100%', animation: 'ex-shim 1.4s ease infinite',
          width: `${50 + (i * 17) % 40}%`,
        }} />
        <style>{`@keyframes ex-shim{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
      </td>
    ))}
  </tr>
);

/* ─────────── Document Table ─────────── */

const DocumentTable = ({ docs, loading, selectedId, onSelect, compareIds, onToggleCompare, isSearchMode }) => {
  const th = (label, width, center = false) => ({
    padding: '10px 13px', textAlign: center ? 'center' : 'left',
    fontSize: '11px', fontWeight: 700, color: C.sub, background: C.surfaceAlt,
    borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap',
    width, position: 'sticky', top: 0, zIndex: 2,
  });

  const td = (truncate = true) => ({
    padding: '10px 13px', fontSize: '12.5px', borderBottom: `1px solid ${C.border}`,
    maxWidth: truncate ? '140px' : 'auto',
    whiteSpace: truncate ? 'nowrap' : 'normal',
    overflow: 'hidden', textOverflow: 'ellipsis',
  });

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={th('', '4%', true)}></th>
              <th style={th('Petitioner', '17%')}>Petitioner</th>
              <th style={th('Court', '15%')}>Court</th>
              <th style={th('Date', '9%')}>Date</th>
              <th style={th('Final Decision', '12%')}>Final Decision</th>
              <th style={th('Sections', '17%')}>Sections</th>
              <th style={th('Trust', '10%', true)}>Trust</th>
              {isSearchMode && <th style={th('Score', '8%', true)}>Score</th>}
              <th style={th('Action', '8%', true)}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && [...Array(8)].map((_, i) => <SkeletonRow key={i} cols={isSearchMode ? 9 : 8} />)}

            {!loading && docs.length === 0 && (
              <tr>
                <td colSpan={isSearchMode ? 9 : 8} style={{ textAlign: 'center', padding: '60px 24px', color: C.muted }}>
                  <div style={{ fontSize: '34px', marginBottom: '10px' }}>📭</div>
                  No documents match your filters.
                </td>
              </tr>
            )}

            {!loading && docs.map((doc, i) => {
              const sd       = doc.structured_data   || {};
              const af       = doc.additional_fields || {};
              const sel      = doc._id === selectedId;
              const inCmp    = compareIds.includes(doc._id);
              const rowBg    = sel ? C.accentBg : inCmp ? C.purpleBg : i % 2 === 0 ? C.surface : C.surfaceAlt;
              const isBest   = doc._explanation?.isBestMatch;
              const sections = (() => {
                const v = getVal(af.sections_involved);
                return Array.isArray(v) ? v : [v].filter(Boolean);
              })();

              return (
                <tr key={doc._id}
                  onClick={() => onSelect(doc)}
                  style={{
                    background: rowBg, cursor: 'pointer', transition: 'background .1s',
                    outline: sel ? `2px solid ${C.accent}` : inCmp ? `2px solid ${C.purple}` : 'none',
                    outlineOffset: '-2px',
                  }}
                  onMouseEnter={e => { if (!sel && !inCmp) e.currentTarget.style.background = '#f0ece8'; }}
                  onMouseLeave={e => { if (!sel && !inCmp) e.currentTarget.style.background = rowBg; }}
                >
                  {/* Compare checkbox */}
                  <td style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={inCmp}
                      onChange={e => { e.stopPropagation(); onToggleCompare(doc._id); }}
                      onClick={e => e.stopPropagation()}
                      title="Select for comparison"
                      style={{ cursor: 'pointer', accentColor: C.purple, width: '14px', height: '14px' }}
                    />
                  </td>

                  <td style={{ ...td(), color: getVal(sd.petitioner) ? C.text : C.muted, fontStyle: getVal(sd.petitioner) ? 'normal' : 'italic', position: 'relative' }}>
                    {isBest && (
                      <span style={{
                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                        width: '3px', height: '60%', background: C.green, borderRadius: '0 3px 3px 0',
                      }} />
                    )}
                    {getVal(sd.petitioner) || '—'}
                  </td>
                  <td style={{ ...td(), color: getVal(sd.court) ? C.text : C.muted, fontStyle: getVal(sd.court) ? 'normal' : 'italic' }}>
                    {getVal(sd.court) || '—'}
                  </td>
                  <td style={{ ...td(false), color: getVal(sd.date) ? C.text : C.muted, fontSize: '12px' }}>
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
                  <td style={{ padding: '10px 13px', borderBottom: `1px solid ${C.border}` }}>
                    {sections.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {sections.slice(0, 3).map((s, idx) => (
                          <span key={idx} style={{
                            padding: '1px 6px', borderRadius: '99px', fontSize: '10.5px',
                            background: C.blueBg, color: C.blue, border: `1px solid ${C.blue}22`,
                            whiteSpace: 'nowrap',
                          }}>{s}</span>
                        ))}
                        {sections.length > 3 && (
                          <span style={{ fontSize: '10.5px', color: C.muted, alignSelf: 'center' }}>+{sections.length - 3}</span>
                        )}
                      </div>
                    ) : <span style={{ color: C.muted, fontStyle: 'italic', fontSize: '12px' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 13px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                    <TrustBadge doc={doc} />
                  </td>
                  {isSearchMode && (
                    <td style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                      {doc._explanation ? (
                        <span style={{
                          fontSize: '11px', fontWeight: 700,
                          color: doc._explanation.scorePercent >= 80 ? C.green : doc._explanation.scorePercent >= 60 ? C.amber : C.muted,
                        }}>{doc._explanation.scorePercent}%</span>
                      ) : '—'}
                    </td>
                  )}
                  <td style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                    <button onClick={e => { e.stopPropagation(); onSelect(doc); }}
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
  const btn  = (active, disabled) => ({
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
    if (range[0] > 1)                    { range.unshift('…'); range.unshift(1); }
    if (range[range.length - 1] < pages) { range.push('…'); range.push(pages); }
    return range;
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
      <span style={{ fontSize: '12px', color: C.muted }}>Showing {from}–{to} of {total} document{total !== 1 ? 's' : ''}</span>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} style={btn(false, page === 1)}>‹</button>
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
  const [err, setErr] = useState('');
  const handleClick = async () => {
    setLoading(true); setErr('');
    try {
      const res = await documentAPI.getPresignedUrl(docId);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch { setErr('Could not open file.'); }
    finally  { setLoading(false); }
  };
  return (
    <div>
      <button onClick={handleClick} disabled={loading}
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

/* ─────────── Explorer Detail Panel ─────────── */

const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: '10px', fontWeight: 700, color: C.muted,
    letterSpacing: '.1em', textTransform: 'uppercase', margin: '18px 0 8px',
  }}>{children}</div>
);

const ExpandableField = ({ label, value, isArray }) => {
  const [expanded, setExpanded] = useState(false);
  const dispVal = getVal(value);
  const arrVal  = isArray ? (Array.isArray(dispVal) ? dispVal : [dispVal].filter(Boolean)) : null;
  const conf    = getConf(value);
  const isLong  = !isArray && typeof dispVal === 'string' && dispVal.length > 120;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      borderBottom: `1px solid ${C.border}`,
      background: 'transparent',
    }}>
      <div style={{
        width: '40%', flexShrink: 0, padding: '9px 13px',
        fontSize: '11.5px', fontWeight: 600, color: C.sub,
        borderRight: `1px solid ${C.border}`,
      }}>{label}</div>
      <div style={{ flex: 1, padding: '9px 13px', minWidth: 0 }}>
        {isArray ? (
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
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '12.5px', color: dispVal ? C.text : C.muted,
                fontStyle: dispVal ? 'normal' : 'italic', wordBreak: 'break-word',
                flex: 1,
                display: isLong && !expanded ? '-webkit-box' : 'block',
                WebkitLineClamp: isLong && !expanded ? 2 : undefined,
                WebkitBoxOrient: 'vertical',
                overflow: isLong && !expanded ? 'hidden' : 'visible',
              }}>{dispVal || '—'}</span>
              <ConfidenceBadge confidence={conf} />
            </div>
            {isLong && (
              <button onClick={() => setExpanded(v => !v)}
                style={{
                  marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '11px', color: C.accent, fontFamily: 'inherit', padding: 0,
                }}
              >{expanded ? 'Show less ▲' : 'Show more ▼'}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ExplorerDetailPanel = ({ doc, onClose }) => {
  const [showAllFields, setShowAllFields] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const sd = doc.structured_data   || {};
  const af = doc.additional_fields || {};
  const expl = doc._explanation;

  /* Compact fields always shown */
  const COMPACT_SD = ['petitioner', 'respondent', 'court', 'state', 'date'];
  const COMPACT_AF = ['case_type', 'final_decision', 'key_issue', 'sections_involved'];

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
        animation: 'ex-slidein .2s ease',
      }}>
        <style>{`@keyframes ex-slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
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
                <span style={{ padding: '1px 8px', borderRadius: '99px', fontSize: '10.5px', fontWeight: 600, background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}33` }}>
                  {getVal(sd.court)}
                </span>
              )}
              <TrustBadge doc={doc} />
              {expl?.isBestMatch && (
                <span style={{ padding: '1px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.green}33` }}>
                  Best Match
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} title="Close (Esc)"
            style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              color: C.sub, fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

          {/* View File */}
          <div style={{ marginBottom: '16px' }}>
            <ViewFileButton docId={doc._id} />
          </div>

          {/* Match explanation (search mode) */}
          {expl && expl.reasons?.length > 0 && (
            <div style={{
              marginBottom: '14px', padding: '10px 13px', borderRadius: '10px',
              background: C.greenBg, border: `1px solid ${C.green}33`,
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.green, marginBottom: '4px' }}>
                Match: {expl.matchType} ({expl.scorePercent}%)
              </div>
              <div style={{ fontSize: '11.5px', color: C.green }}>
                {expl.reasons.join(' · ')}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <SectionLabel>AI Summary</SectionLabel>
          {doc.summary ? (
            <div style={{
              fontSize: '13px', color: C.sub, lineHeight: 1.7,
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              borderRadius: '10px', padding: '13px 15px',
            }}>{doc.summary}</div>
          ) : (
            <div style={{ fontSize: '13px', color: C.muted, fontStyle: 'italic' }}>No summary available.</div>
          )}

          {/* Compact view — always visible */}
          <SectionLabel>Key Details</SectionLabel>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
            {SD_FIELDS.filter(f => COMPACT_SD.includes(f.key)).map(({ key, label }, i) => (
              <ExpandableField key={key} label={label} value={sd[key]} isArray={false} />
            ))}
            {AF_FIELDS.filter(f => COMPACT_AF.includes(f.key)).map(({ key, label, array }) => (
              <ExpandableField key={key} label={label} value={af[key]} isArray={array} />
            ))}
          </div>

          {/* Show More / Less */}
          <button
            onClick={() => setShowAllFields(v => !v)}
            style={{
              marginTop: '10px', width: '100%', padding: '8px', borderRadius: '8px',
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              color: C.sub, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.sub; }}
          >
            {showAllFields ? '▲ Show Less' : '▼ Show All Fields'}
          </button>

          {showAllFields && (
            <>
              <SectionLabel>All Structured Data</SectionLabel>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                {SD_FIELDS.filter(f => !COMPACT_SD.includes(f.key)).map(({ key, label }) => (
                  <ExpandableField key={key} label={label} value={sd[key]} isArray={false} />
                ))}
              </div>

              <SectionLabel>Additional Insights</SectionLabel>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                {AF_FIELDS.filter(f => !COMPACT_AF.includes(f.key)).map(({ key, label, array }) => (
                  <ExpandableField key={key} label={label} value={af[key]} isArray={array} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

/* ─────────── Comparison Panel ─────────── */

const ComparisonPanel = ({ docs, onClose }) => {
  const COMPARE_FIELDS = [
    { label: 'Petitioner',    get: (d) => getVal(d.structured_data?.petitioner) },
    { label: 'Respondent',    get: (d) => getVal(d.structured_data?.respondent) },
    { label: 'Court',         get: (d) => getVal(d.structured_data?.court) },
    { label: 'State',         get: (d) => getVal(d.structured_data?.state) },
    { label: 'Date',          get: (d) => getVal(d.structured_data?.date) },
    { label: 'Final Decision',get: (d) => getVal(d.additional_fields?.final_decision) },
    { label: 'Key Issue',     get: (d) => getVal(d.additional_fields?.key_issue) },
    { label: 'Sections',      get: (d) => { const v = getVal(d.additional_fields?.sections_involved); return Array.isArray(v) ? v.join(', ') : v; } },
    { label: 'Observations',  get: (d) => getVal(d.additional_fields?.important_observations) },
    { label: 'Decision Summary', get: (d) => getVal(d.additional_fields?.decision_summary) },
  ];

  const [docA, docB] = docs;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.3)', backdropFilter: 'blur(3px)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)',
        width: '92vw', maxWidth: '1100px', maxHeight: '90vh',
        background: C.surface, borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'ex-fadein .2s ease',
      }}>
        <style>{`@keyframes ex-fadein{from{opacity:0;transform:translateX(-50%) scale(.96)}to{opacity:1;transform:translateX(-50%) scale(1)}}`}</style>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>
            Document Comparison
          </div>
          <button onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '8px', background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.sub, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ×
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ width: '18%', padding: '12px 16px', background: C.surfaceAlt, borderBottom: `2px solid ${C.border}`, fontSize: '11px', fontWeight: 700, color: C.sub, textAlign: 'left' }}>Field</th>
                <th style={{ width: '41%', padding: '12px 16px', background: C.accentBg, borderBottom: `2px solid ${C.accent}44`, fontSize: '12px', fontWeight: 700, color: C.text, textAlign: 'left' }}>
                  <div style={{ color: C.accent, fontSize: '10px', fontWeight: 600, marginBottom: '2px' }}>DOC A</div>
                  {docA.fileName}
                </th>
                <th style={{ width: '41%', padding: '12px 16px', background: C.purpleBg, borderBottom: `2px solid ${C.purple}44`, fontSize: '12px', fontWeight: 700, color: C.text, textAlign: 'left' }}>
                  <div style={{ color: C.purple, fontSize: '10px', fontWeight: 600, marginBottom: '2px' }}>DOC B</div>
                  {docB.fileName}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_FIELDS.map(({ label, get }, i) => {
                const vA = get(docA) || '—';
                const vB = get(docB) || '—';
                const differ = vA !== vB && vA !== '—' && vB !== '—';
                return (
                  <tr key={label} style={{ background: i % 2 === 0 ? C.surface : C.surfaceAlt }}>
                    <td style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, fontSize: '11.5px', fontWeight: 600, color: C.sub }}>{label}</td>
                    <td style={{
                      padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
                      fontSize: '12.5px', color: vA === '—' ? C.muted : C.text,
                      background: differ ? '#fff8f7' : 'transparent',
                    }}>{vA}</td>
                    <td style={{
                      padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
                      fontSize: '12.5px', color: vB === '—' ? C.muted : C.text,
                      background: differ ? '#f8f7ff' : 'transparent',
                    }}>{vB}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

/* ─────────── Export button ─────────── */

const ExportButton = ({ currentFilters }) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(currentFilters).filter(([, v]) => v !== '' && v !== false)
      );
      const res  = await documentAPI.exportCSV(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `gst-case-laws-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', borderRadius: '8px',
        background: C.surface, color: C.sub,
        border: `1px solid ${C.border}`, fontSize: '12.5px', fontWeight: 600,
        cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
        transition: 'all .15s',
      }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.color = C.green; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.sub; }}
    >
      {loading ? <Spinner size={13} color={C.sub} /> : '↓'}
      {loading ? 'Exporting…' : 'Export CSV'}
    </button>
  );
};

/* ─────────── DocumentExplorer — Main ─────────── */

const DocumentExplorer = () => {
  const [draft,       setDraft]       = useState(EMPTY_FILTERS);
  const [applied,     setApplied]     = useState({});
  const [docs,        setDocs]        = useState([]);
  const [pagination,  setPagination]  = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selected,    setSelected]    = useState(null);
  const [options,     setOptions]     = useState({ courts: [], states: [], caseTypes: [], finalDecisions: [], sections: [] });
  const [compareIds,  setCompareIds]  = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [parsedQuery, setParsedQuery]   = useState(null);

  useEffect(() => {
    documentAPI.getFilterOptions()
      .then(res => setOptions(res.data.data || {}))
      .catch(() => {});
  }, []);

  const fetchDocs = useCallback(async (filters, page) => {
    setLoading(true); setError('');
    try {
      const params = Object.fromEntries(
        Object.entries({ ...filters, page, limit: 20 }).filter(([, v]) => v !== '' && v !== false)
      );
      const res = await documentAPI.getDocuments(params);
      setDocs(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, pages: 0 });
      setIsSearchMode(false);
      setParsedQuery(null);
    } catch {
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const doHybridSearch = useCallback(async (query, page = 1) => {
    if (!query.trim()) { return fetchDocs({}, 1); }
    setLoading(true); setError(''); setSelected(null);
    try {
      const res = await documentAPI.hybridSearch(query, page, 20);
      setDocs(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, pages: 0 });
      setIsSearchMode(true);
      setParsedQuery(res.data.parsed || null);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchDocs]);

  useEffect(() => { fetchDocs({}, 1); }, [fetchDocs]);

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q) { setIsSearchMode(false); fetchDocs(applied, 1); }
    else doHybridSearch(q, 1);
  };

  const handleApply = () => {
    setApplied({ ...draft });
    setSearchQuery('');
    setIsSearchMode(false);
    fetchDocs(draft, 1);
    setPagination(p => ({ ...p, page: 1 }));
    setSelected(null);
  };

  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    setApplied({});
    setSearchQuery('');
    setIsSearchMode(false);
    fetchDocs({}, 1);
    setPagination(p => ({ ...p, page: 1 }));
    setSelected(null);
  };

  const handleFilterTagRemove = (newFilters) => {
    setDraft(newFilters);
    setApplied(newFilters);
    fetchDocs(newFilters, 1);
    setPagination(p => ({ ...p, page: 1 }));
    setSelected(null);
  };

  const handlePage = (newPage) => {
    setPagination(p => ({ ...p, page: newPage }));
    if (isSearchMode) doHybridSearch(searchQuery, newPage);
    else fetchDocs(applied, newPage);
    setSelected(null);
  };

  const handleSelect = (doc) => {
    setSelected(prev => prev?._id === doc._id ? null : doc);
  };

  const handleToggleCompare = (id) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id]; /* replace oldest */
      return [...prev, id];
    });
  };

  const compareDocs = docs.filter(d => compareIds.includes(d._id));

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'inherit', padding: '28px 32px' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.text, letterSpacing: '-.5px' }}>
              GST Case Laws Explorer
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.sub }}>
              Smart search, filter, and explore GST case laws.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {compareIds.length === 2 && (
              <button
                onClick={() => setShowCompare(true)}
                style={{
                  padding: '8px 14px', borderRadius: '8px',
                  background: C.purpleBg, color: C.purple,
                  border: `1px solid ${C.purple}44`,
                  fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Compare 2 Docs ⟷</button>
            )}
            {compareIds.length > 0 && (
              <button onClick={() => setCompareIds([])}
                style={{ padding: '8px 10px', borderRadius: '8px', background: C.surface, color: C.muted, border: `1px solid ${C.border}`, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Clear ({compareIds.length})
              </button>
            )}
            <ExportButton currentFilters={applied} />
          </div>
        </div>

        {/* Smart Search Bar */}
        <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <SmartSearchBar onSearch={handleSearch} loading={loading && isSearchMode} />
        </div>

        {/* Parsed query chips */}
        {parsedQuery && isSearchMode && (
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>Parsed:</span>
            {parsedQuery.sections && <span style={{ padding: '2px 9px', borderRadius: '99px', fontSize: '11px', background: C.blueBg, color: C.blue, border: `1px solid ${C.blue}22` }}>Sections: {parsedQuery.sections}</span>}
            {parsedQuery.finalDecision && <span style={{ padding: '2px 9px', borderRadius: '99px', fontSize: '11px', background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}22` }}>Decision: {parsedQuery.finalDecision}</span>}
            {parsedQuery.state && <span style={{ padding: '2px 9px', borderRadius: '99px', fontSize: '11px', background: C.greenBg, color: C.green, border: `1px solid ${C.green}22` }}>State: {parsedQuery.state}</span>}
            {parsedQuery.court && <span style={{ padding: '2px 9px', borderRadius: '99px', fontSize: '11px', background: C.purpleBg, color: C.purple, border: `1px solid ${C.purple}22` }}>Court: {parsedQuery.court}</span>}
            {parsedQuery.dateFrom && <span style={{ padding: '2px 9px', borderRadius: '99px', fontSize: '11px', background: C.amberBg, color: C.amber, border: `1px solid ${C.amber}22` }}>From: {parsedQuery.dateFrom}</span>}
            {parsedQuery.semantic && <span style={{ padding: '2px 9px', borderRadius: '99px', fontSize: '11px', background: C.surfaceAlt, color: C.sub, border: `1px solid ${C.border}` }}>Semantic: "{parsedQuery.semantic}"</span>}
          </div>
        )}
      </div>

      <FilterPanel
        draft={draft}
        onChange={setDraft}
        onApply={handleApply}
        onReset={handleReset}
        loading={loading && !isSearchMode}
        options={options}
      />

      <ActiveFilterTags filters={applied} onChange={handleFilterTagRemove} />

      {/* Compare hint */}
      {compareIds.length < 2 && docs.length > 0 && (
        <div style={{ marginBottom: '10px', fontSize: '11.5px', color: C.muted }}>
          ✓ Select checkboxes to compare documents side-by-side.
          {compareIds.length === 1 && ' (Select 1 more to compare)'}
        </div>
      )}

      {error && !loading && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', marginBottom: '14px',
          background: C.redBg, border: `1px solid ${C.red}33`,
          color: C.red, fontSize: '13px', fontWeight: 500,
        }}>{error}</div>
      )}

      <DocumentTable
        docs={docs}
        loading={loading}
        selectedId={selected?._id}
        onSelect={handleSelect}
        compareIds={compareIds}
        onToggleCompare={handleToggleCompare}
        isSearchMode={isSearchMode}
      />

      <Pagination pagination={pagination} onPage={handlePage} />

      {selected && (
        <ExplorerDetailPanel doc={selected} onClose={() => setSelected(null)} />
      )}

      {showCompare && compareDocs.length === 2 && (
        <ComparisonPanel docs={compareDocs} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
};

export default DocumentExplorer;
