import React from 'react';

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

const TYPE_META = {
  library: {
    badge:    'Library',
    badgeIcon:'📂',
    hint:     'Upload and manage documents for this section.',
  },
  explorer: {
    badge:    'Explorer',
    badgeIcon:'🔍',
    hint:     'Search, filter, and explore documents with structured data.',
  },
};

const ComingSoonPage = ({ title, icon, type = 'library' }) => {
  const meta = TYPE_META[type] || TYPE_META.library;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      fontFamily: 'inherit',
    }}>

      {/* Card */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '20px',
        padding: '48px 52px',
        maxWidth: '460px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
      }}>

        {/* Type badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 11px',
          borderRadius: '99px',
          background: C.accentBg,
          border: `1px solid ${C.accent}33`,
          fontSize: '11.5px',
          fontWeight: 600,
          color: C.accent,
          marginBottom: '22px',
          letterSpacing: '.02em',
        }}>
          <span>{meta.badgeIcon}</span>
          {meta.badge}
        </div>

        {/* Icon */}
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '20px',
          background: `linear-gradient(135deg, ${C.accentBg} 0%, #fff9f8 100%)`,
          border: `1.5px solid ${C.accent}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          margin: '0 auto 22px',
          boxShadow: '0 4px 16px rgba(188,108,95,0.10)',
        }}>
          {icon}
        </div>

        {/* Title */}
        <h1 style={{
          margin: '0 0 10px',
          fontSize: '21px',
          fontWeight: 800,
          color: C.text,
          letterSpacing: '-.4px',
        }}>
          {title}
        </h1>

        {/* Primary message */}
        <p style={{
          margin: '0 0 8px',
          fontSize: '14.5px',
          fontWeight: 600,
          color: C.accent,
        }}>
          This section is coming soon.
        </p>

        {/* Hint */}
        <p style={{
          margin: '0 0 28px',
          fontSize: '13.5px',
          color: C.sub,
          lineHeight: 1.65,
        }}>
          {meta.hint} We're building this out — check back soon.
        </p>

        {/* Progress bar */}
        <div style={{
          height: '4px',
          borderRadius: '99px',
          background: C.border,
          overflow: 'hidden',
          marginBottom: '8px',
        }}>
          <div style={{
            height: '100%',
            width: '30%',
            borderRadius: '99px',
            background: `linear-gradient(90deg, ${C.accent} 0%, #e8a89f 100%)`,
          }} />
        </div>

        <p style={{
          margin: 0,
          fontSize: '11px',
          color: C.muted,
          letterSpacing: '.03em',
        }}>
          In development
        </p>

      </div>
    </div>
  );
};

export default ComingSoonPage;
