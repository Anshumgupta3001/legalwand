import React, { useState } from 'react';

const ACC  = '#BC6C5F';
const NAVY = '#0f172a';

/* ── Feature card data ── */
const FEATURES = [
  {
    icon: '📡',
    label: 'News Feed',
    color: '#5a9a7a',
    colorBg: 'rgba(90,154,122,0.08)',
    colorBorder: 'rgba(90,154,122,0.2)',
    tagColor: '#2d6e48',
    tag: 'Live Updates',
    headline: 'Auto-aggregated legal updates, explained by AI',
    bullets: [
      'Pulls real-time updates from CBIC, MCA, Income Tax & SEBI',
      'AI rewrites dense circulars into plain-English summaries',
      'Filter updates by category or client relevance',
      'Share to WhatsApp in one tap — no copy-paste needed',
    ],
  },
  {
    icon: '💬',
    label: 'AI Chat',
    color: ACC,
    colorBg: 'rgba(188,108,95,0.07)',
    colorBorder: 'rgba(188,108,95,0.2)',
    tagColor: ACC,
    tag: 'AI-Powered',
    headline: 'Ask any question about Indian law — get cited answers',
    bullets: [
      'Covers GST, Income Tax, FEMA, Companies Act and more',
      'Every answer includes relevant Act, Section & Circular references',
      'Client mode: answers scoped to that client\'s own data',
      'Regenerate or export full conversations as PDF reports',
    ],
  },
  {
    icon: '📚',
    label: 'Law Library',
    color: '#6366f1',
    colorBg: 'rgba(99,102,241,0.07)',
    colorBorder: 'rgba(99,102,241,0.2)',
    tagColor: '#4338ca',
    tag: 'Structured Repository',
    headline: 'Every Act, Rule, Notification and Circular — searchable',
    bullets: [
      'Complete repository: Acts, Rules, Notifications, Circulars, Forms',
      'Full-text search across the entire legal corpus',
      'Version history — compare old vs. amended provisions',
      'Personal annotations and bookmarks per document',
    ],
  },
  {
    icon: '👥',
    label: 'Client Management',
    color: '#0891b2',
    colorBg: 'rgba(8,145,178,0.07)',
    colorBorder: 'rgba(8,145,178,0.2)',
    tagColor: '#0e7490',
    tag: 'Built for CAs',
    headline: 'A dedicated workspace for every client you handle',
    bullets: [
      'Entity profile: registrations, directors, authorized signatories',
      'Secure document vault with upload, tag, and star',
      'Activity timeline and compliance health score',
      'Task list and deadline tracker — designed for 50+ clients',
    ],
  },
  {
    icon: '⏰',
    label: 'Compliance Alerts',
    color: '#d97706',
    colorBg: 'rgba(217,119,6,0.07)',
    colorBorder: 'rgba(217,119,6,0.2)',
    tagColor: '#b45309',
    tag: 'Never Miss a Deadline',
    headline: 'Auto-generated alerts based on each client\'s registrations',
    bullets: [
      'Deadline reminders at 7 days, 3 days, and same-day intervals',
      'WhatsApp alerts — delivered directly to client or CA',
      'Bulk-send to all clients in one click',
      'Missed filing escalation with automatic follow-up',
    ],
  },
  {
    icon: '📄',
    label: 'Document Management',
    color: '#7c3aed',
    colorBg: 'rgba(124,58,237,0.07)',
    colorBorder: 'rgba(124,58,237,0.2)',
    tagColor: '#6d28d9',
    tag: 'Secure & Smart',
    headline: 'Upload, organize, and chat with your documents',
    bullets: [
      'Upload by CA or client — role-based access control',
      'Filter, tag, star, and organize files per matter',
      'Secure sharing with expiry-controlled links',
      'AI Chat scoped to selected files — no hallucinations',
    ],
  },
];

const WHY = [
  { icon: '⚡', title: 'Saves hours every week',       body: 'Automated summaries, deadline tracking, and AI answers replace hours of manual research.' },
  { icon: '🛡️', title: 'Reduces compliance risk',      body: 'Real-time alerts and structured law library ensure nothing slips through the cracks.' },
  { icon: '🗂️', title: 'Centralized workspace',         body: 'Client data, documents, deadlines, and chats — one place, zero switching.' },
  { icon: '🧠', title: 'AI-powered insights',           body: 'From plain-English legal summaries to document-level Q&A, AI does the heavy lifting.' },
];

/* ── Pill tag ── */
const Tag = ({ label, color }) => (
  <span style={{
    display: 'inline-block',
    fontSize: '10.5px', fontWeight: 700,
    padding: '2px 9px', borderRadius: '999px',
    background: `${color}18`, color,
    letterSpacing: '.04em',
  }}>{label}</span>
);

/* ── Feature card ── */
const FeatureCard = ({ f }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hov ? f.color : '#e8e0d4'}`,
        borderRadius: '16px',
        padding: '22px 22px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: hov
          ? `0 8px 28px ${f.color}20`
          : '0 2px 10px rgba(26,18,8,0.05)',
        transition: 'border-color .2s, box-shadow .2s, transform .2s',
        transform: hov ? 'translateY(-3px)' : 'none',
        cursor: 'default',
      }}
    >
      {/* Icon + tag row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '12px', flexShrink: 0,
          background: f.colorBg, border: `1px solid ${f.colorBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px',
        }}>
          {f.icon}
        </div>
        <Tag label={f.tag} color={f.tagColor} />
      </div>

      {/* Label + headline */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: f.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px' }}>
          {f.label}
        </div>
        <h3 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '16px', fontWeight: 700,
          color: '#1f1510', lineHeight: 1.35, margin: 0,
        }}>
          {f.headline}
        </h3>
      </div>

      {/* Bullets */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {f.bullets.map((b, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
            <span style={{
              marginTop: '6px', width: '5px', height: '5px', borderRadius: '50%',
              background: f.color, flexShrink: 0, display: 'block',
            }} />
            <span style={{ fontSize: '13px', lineHeight: 1.6, color: '#5a4c3c' }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ── Why card ── */
const WhyCard = ({ item }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? ACC : '#fff',
        border: `1px solid ${hov ? ACC : '#e8e0d4'}`,
        borderRadius: '14px',
        padding: '20px',
        transition: 'background .2s, border-color .2s, transform .2s, box-shadow .2s',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 8px 24px rgba(188,108,95,0.25)' : '0 1px 6px rgba(26,18,8,0.04)',
        cursor: 'default',
      }}
    >
      <div style={{ fontSize: '24px', marginBottom: '10px' }}>{item.icon}</div>
      <div style={{
        fontSize: '14px', fontWeight: 700, color: hov ? '#fff' : '#1f1510',
        marginBottom: '5px', transition: 'color .2s',
      }}>{item.title}</div>
      <p style={{
        fontSize: '13px', lineHeight: 1.6, margin: 0,
        color: hov ? 'rgba(255,255,255,0.8)' : '#9a8c7c',
        transition: 'color .2s',
      }}>{item.body}</p>
    </div>
  );
};

/* ════════════════════════════════════════ */
const FeaturesPage = () => (
  <div style={{ padding: '36px 40px 80px', maxWidth: '1100px' }}>

    {/* ── Page header ── */}
    <div style={{ marginBottom: '40px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '11px', fontWeight: 700, letterSpacing: '.12em',
        textTransform: 'uppercase', color: ACC, marginBottom: '12px',
      }}>
        <span style={{ width: '18px', height: '1.5px', background: ACC, display: 'block' }} />
        Product Capabilities
      </div>

      <h1 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '34px', fontWeight: 700,
        color: '#1f1510', margin: '0 0 10px', lineHeight: 1.2,
      }}>
        Everything a CA practice needs,<br />
        <span style={{ color: ACC }}>powered by AI</span>
      </h1>

      <p style={{ fontSize: '15px', color: '#9a8c7c', margin: 0, lineHeight: 1.65, maxWidth: '560px' }}>
        GSTWand is a full-stack compliance platform for Chartered Accountants —
        from AI-assisted research and client management to automated alerts and
        document intelligence.
      </p>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: '28px', marginTop: '28px', flexWrap: 'wrap',
      }}>
        {[
          { value: '6+',    label: 'Core modules' },
          { value: 'AI',    label: 'Powered research' },
          { value: '100%',  label: 'India-specific laws' },
          { value: '24 / 7', label: 'Compliance monitoring' },
        ].map((s) => (
          <div key={s.label}>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '26px', fontWeight: 700, color: ACC, lineHeight: 1,
            }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#9a8c7c', marginTop: '3px' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>

    {/* ── Feature grid ── */}
    <div style={{ marginBottom: '48px' }}>
      <h2 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '20px', fontWeight: 700, color: '#1f1510',
        margin: '0 0 20px',
      }}>
        Core Features
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '18px',
      }}>
        {FEATURES.map((f) => <FeatureCard key={f.label} f={f} />)}
      </div>
    </div>

    {/* ── Why this tool ── */}
    <div style={{
      background: NAVY,
      borderRadius: '20px',
      padding: '32px 32px 28px',
      marginBottom: '48px',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.12em', color: `rgba(188,108,95,0.8)`, marginBottom: '8px',
      }}>
        Why GSTWand
      </div>
      <h2 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '22px', fontWeight: 700, color: '#fff',
        margin: '0 0 24px', lineHeight: 1.3,
      }}>
        Built specifically for Indian compliance professionals
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
      }}>
        {WHY.map((w) => <WhyCard key={w.title} item={w} />)}
      </div>
    </div>

    {/* ── Roadmap teaser ── */}
    <div style={{
      background: 'rgba(188,108,95,0.05)',
      border: '1px solid rgba(188,108,95,0.2)',
      borderRadius: '16px',
      padding: '28px 28px 24px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.1em', color: ACC, marginBottom: '6px',
          }}>Coming Soon 🚀</div>
          <h3 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '18px', fontWeight: 700, color: '#1f1510', margin: '0 0 8px',
          }}>
            More features on the roadmap
          </h3>
          <p style={{ fontSize: '13px', color: '#9a8c7c', margin: 0, lineHeight: 1.6 }}>
            GSTR auto-filing assistance · ITC reconciliation reports ·
            Dedicated CA assignment · Bulk WhatsApp alerts · Client portal (self-service)
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <div style={{
            padding: '10px 20px', borderRadius: '10px',
            background: ACC, color: '#fff',
            fontSize: '13px', fontWeight: 600,
            boxShadow: '0 4px 14px rgba(188,108,95,0.3)',
          }}>
            Notify me when ready
          </div>
          <p style={{ fontSize: '11px', color: '#c4b49a', margin: '6px 0 0', textAlign: 'center' }}>
            support@gstwand.com
          </p>
        </div>
      </div>

      {/* Progress pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px' }}>
        {[
          { label: 'GSTR Auto-filing',     pct: 60 },
          { label: 'ITC Reconciliation',   pct: 40 },
          { label: 'Client Portal',        pct: 25 },
          { label: 'WhatsApp Bulk Alerts', pct: 75 },
        ].map((item) => (
          <div key={item.label} style={{
            background: '#fff', border: '1px solid #e8e0d4',
            borderRadius: '10px', padding: '8px 14px', minWidth: '180px',
            flex: '1 1 180px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#5a4c3c' }}>{item.label}</span>
              <span style={{ fontSize: '11px', color: ACC, fontWeight: 700 }}>{item.pct}%</span>
            </div>
            <div style={{ height: '4px', background: '#f0ebe3', borderRadius: '999px' }}>
              <div style={{
                height: '4px', borderRadius: '999px',
                background: `linear-gradient(90deg, ${ACC}, #d4806e)`,
                width: `${item.pct}%`,
                transition: 'width .4s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>

  </div>
);

export default FeaturesPage;
