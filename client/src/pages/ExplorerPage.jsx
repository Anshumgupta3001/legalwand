import React, { useState } from 'react';
import DocumentExplorer from './DocumentExplorer';
import ComingSoonPage from './ComingSoonPage';

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
  { id: 'case-laws',     label: 'GST Case Laws',    icon: '⚖️' },
  { id: 'notifications', label: 'GST Notifications', icon: '🔔' },
  { id: 'circulars',     label: 'GST Circulars',     icon: '📋' },
  { id: 'orders',        label: 'GST Orders',        icon: '📜' },
];

const ExplorerPage = () => {
  const [activeTab, setActiveTab] = useState('case-laws');
  const active = TABS.find(t => t.id === activeTab);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'inherit' }}>

      {/* ── Sticky header + tab bar ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>

        {/* Page identity row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 28px 10px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: C.accentBg,
            border: `1.5px solid ${C.accent}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '17px',
            flexShrink: 0,
          }}>
            🔍
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, letterSpacing: '-.3px' }}>
              Explorer
            </div>
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '1px' }}>
              Search, filter, and explore GST documents
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          overflowX: 'auto',
          padding: '0 20px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `2.5px solid ${C.accent}` : '2.5px solid transparent',
                  color: isActive ? C.accent : C.sub,
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                  flexShrink: 0,
                  marginBottom: '-1px',
                  outline: 'none',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = C.text; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = C.sub; }}
              >
                <span style={{ fontSize: '13px', lineHeight: 1 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'case-laws'
        ? <DocumentExplorer />
        : <ComingSoonPage
            title={`${active.label} Explorer`}
            icon={active.icon}
            type="explorer"
          />
      }
    </div>
  );
};

export default ExplorerPage;
