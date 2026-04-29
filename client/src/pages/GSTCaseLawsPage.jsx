import React, { useState } from 'react';
import DocumentLibrary from './DocumentLibrary';
import DocumentExplorer from './DocumentExplorer';

const C = {
  bg:       '#f5f4f0',
  surface:  '#ffffff',
  border:   '#e5e2db',
  accent:   '#BC6C5F',
  accentBg: '#fdf2f0',
  text:     '#1a1714',
  sub:      '#6b6560',
  muted:    '#a09890',
};

const TABS = [
  {
    id: 'library',
    label: 'GST Case Laws Library',
    icon: '🏛️',
    comingSoonDesc: '',
  },
  {
    id: 'explorer',
    label: 'GST Case Laws Explorer',
    icon: '🔍',
    comingSoonDesc: '',
  },
  {
    id: 'notifications',
    label: 'GST Notifications',
    icon: '🔔',
    comingSoonDesc: 'Official GST notifications issued by the government',
  },
  {
    id: 'circulars',
    label: 'GST Circulars',
    icon: '📋',
    comingSoonDesc: 'GST circulars and departmental clarifications',
  },
  {
    id: 'orders',
    label: 'GST Orders',
    icon: '📜',
    comingSoonDesc: 'GST orders and advance rulings',
  },
];

/* ── Coming Soon placeholder ── */
const ComingSoon = ({ title, icon, desc }) => (
  <div style={{
    minHeight: 'calc(100vh - 57px)',
    background: C.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
  }}>
    <div style={{ textAlign: 'center', maxWidth: '420px' }}>

      {/* Icon circle */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: C.accentBg,
        border: `1.5px solid ${C.accent}33`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '34px',
        margin: '0 auto 24px',
        boxShadow: '0 4px 24px rgba(188,108,95,0.10)',
      }}>
        {icon}
      </div>

      <h2 style={{
        margin: '0 0 10px',
        fontSize: '22px',
        fontWeight: 800,
        color: C.text,
        letterSpacing: '-.4px',
      }}>
        {title}
      </h2>

      <p style={{
        margin: '0 0 8px',
        fontSize: '14.5px',
        fontWeight: 600,
        color: C.accent,
      }}>
        This section is coming soon.
      </p>

      <p style={{
        margin: 0,
        fontSize: '13.5px',
        color: C.sub,
        lineHeight: 1.65,
      }}>
        We're working on bringing you {desc.toLowerCase()}. Check back soon for updates.
      </p>

      {/* Decorative dots */}
      <div style={{
        marginTop: '32px',
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
      }}>
        {[C.accent, C.border, C.border].map((col, i) => (
          <div key={i} style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: col,
          }} />
        ))}
      </div>
    </div>
  </div>
);

/* ── Tab button ── */
const TabButton = ({ tab, isActive, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '14px 16px',
      background: 'none',
      border: 'none',
      borderBottom: isActive ? `2.5px solid ${C.accent}` : '2.5px solid transparent',
      color: isActive ? C.accent : C.sub,
      fontSize: '13px',
      fontWeight: isActive ? 700 : 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      transition: 'color 0.15s, border-color 0.15s',
      flexShrink: 0,
      marginBottom: '-1px',
      outline: 'none',
    }}
    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = C.text; }}
    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = C.sub; }}
  >
    <span style={{ fontSize: '14px', lineHeight: 1 }}>{tab.icon}</span>
    {tab.label}
  </button>
);

/* ── Main page ── */
const GSTCaseLawsPage = () => {
  const [activeTab, setActiveTab] = useState('library');

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {/* ── Sticky tab bar ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        boxShadow: '0 1px 10px rgba(0,0,0,0.05)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          padding: '0 20px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {TABS.map(tab => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'library'       && <DocumentLibrary />}
      {activeTab === 'explorer'      && <DocumentExplorer />}
      {activeTab === 'notifications' && (
        <ComingSoon
          title="GST Notifications"
          icon="🔔"
          desc="Official GST notifications issued by the government"
        />
      )}
      {activeTab === 'circulars' && (
        <ComingSoon
          title="GST Circulars"
          icon="📋"
          desc="GST circulars and departmental clarifications"
        />
      )}
      {activeTab === 'orders' && (
        <ComingSoon
          title="GST Orders"
          icon="📜"
          desc="GST orders and advance rulings"
        />
      )}
    </div>
  );
};

export default GSTCaseLawsPage;
