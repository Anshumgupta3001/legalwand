import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ACC = '#BC6C5F';
const MAX_CREDITS_FREE = 10;
const MAX_CREDITS_PRO  = 100;

const HomeDashboard = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const firstName  = user?.firstName || user?.name?.split(' ')[0] || 'there';
  const isPro      = user?.pro_user ?? false;
  const credits    = user?.credits ?? 0;
  const maxCredits = isPro ? MAX_CREDITS_PRO : MAX_CREDITS_FREE;
  const creditPct  = Math.min(100, Math.round((credits / maxCredits) * 100));

  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';

  const actions = [
    {
      icon: '💬',
      title: 'AI Chat',
      desc: 'Ask questions about GST, ITC, filings, and more — instant answers from the knowledge base.',
      cta: 'Open Chat →',
      path: '/dashboard',
      color: ACC,
      bg: 'rgba(188,108,95,0.05)',
      border: 'rgba(188,108,95,0.22)',
    },
    {
      icon: '📤',
      title: 'Upload Documents',
      desc: 'Add PDFs, scrape URLs, or upload text files to expand the knowledge base.',
      cta: 'Upload →',
      path: '/upload',
      color: '#5a9a7a',
      bg: 'rgba(90,154,122,0.05)',
      border: 'rgba(90,154,122,0.22)',
    },
    {
      icon: '📊',
      title: 'Overview',
      desc: 'View platform usage stats, user analytics, and activity history.',
      cta: 'View Overview →',
      path: '/overview',
      color: '#0f2744',
      bg: 'rgba(15,39,68,0.05)',
      border: 'rgba(15,39,68,0.15)',
    },
  ];

  return (
    <div style={{ padding: '40px 36px 60px', maxWidth: '920px' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 600, letterSpacing: '.1em',
          textTransform: 'uppercase', color: ACC,
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ display: 'block', width: '20px', height: '1px', background: ACC }} />
          CA Workspace
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '28px',
          color: 'var(--txt-primary)',
          lineHeight: 1.2,
          margin: 0,
        }}>
          {greeting}, {firstName}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--txt-muted)', marginTop: '6px' }}>
          Your AI-powered GST assistant — ask, upload, and analyse.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '14px',
        marginBottom: '30px',
      }}>

        {/* Credits */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--border-base)',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(26,18,8,0.05)',
        }}>
          <div style={{
            fontSize: '11px', color: 'var(--txt-muted)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px',
          }}>
            Credits Remaining
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '32px',
            color: credits <= 2 ? '#c0392b' : ACC,
            lineHeight: 1,
          }}>
            {credits}
            <span style={{ fontSize: '14px', color: 'var(--txt-muted)', fontFamily: 'var(--font-sans)' }}>
              /{maxCredits}
            </span>
          </div>
          <div style={{
            marginTop: '10px', height: '4px',
            borderRadius: '2px', background: 'var(--border-base)',
          }}>
            <div style={{
              width: `${creditPct}%`, height: '100%',
              borderRadius: '2px',
              background: credits <= 2 ? '#c0392b' : ACC,
              transition: 'width .4s',
            }} />
          </div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--txt-muted)' }}>
            {isPro ? 'Pro plan' : 'Free plan'}
          </div>
        </div>

        {/* Plan */}
        <div style={{
          background: isPro ? 'rgba(188,108,95,0.04)' : '#fff',
          border: `1px solid ${isPro ? 'rgba(188,108,95,0.25)' : 'var(--border-base)'}`,
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(26,18,8,0.05)',
        }}>
          <div style={{
            fontSize: '11px', color: 'var(--txt-muted)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px',
          }}>
            Current Plan
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '24px',
            color: 'var(--txt-primary)', lineHeight: 1.2, marginBottom: '4px',
          }}>
            {isPro ? 'Pro' : 'Free'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--txt-muted)' }}>
            {isPro ? `${maxCredits} credits / month` : `${maxCredits} credits total`}
          </div>
          {!isPro && credits <= 2 && (
            <div style={{
              marginTop: '10px', fontSize: '11px', fontWeight: 600,
              color: '#c0392b',
            }}>
              ⚠ Credits running low
            </div>
          )}
        </div>

        {/* Account */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--border-base)',
          borderRadius: '12px',
          padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(26,18,8,0.05)',
        }}>
          <div style={{
            fontSize: '11px', color: 'var(--txt-muted)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px',
          }}>
            Account
          </div>
          <div style={{
            fontSize: '14px', fontWeight: 600,
            color: 'var(--txt-primary)', marginBottom: '3px',
          }}>
            {user?.firstName} {user?.lastName || ''}
          </div>
          <div style={{
            fontSize: '12px', color: 'var(--txt-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user?.email || ''}
          </div>
          <div style={{
            marginTop: '10px', fontSize: '11px',
            color: user?.isVerified ? '#5a9a7a' : '#c0392b',
            fontWeight: 600,
          }}>
            {user?.isVerified ? '✓ Verified' : '✗ Unverified'}
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div>
        <div style={{
          fontSize: '13px', fontWeight: 600,
          color: 'var(--txt-secondary)',
          marginBottom: '14px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          Quick Actions
          <span style={{ flex: 1, height: '1px', background: 'var(--border-base)' }} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px',
        }}>
          {actions.map(({ icon, title, desc, cta, path, color, bg, border }) => (
            <div
              key={title}
              onClick={() => navigate(path)}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: '12px',
                padding: '22px 20px',
                cursor: 'pointer',
                transition: 'transform .18s, box-shadow .18s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(26,18,8,0.10)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '26px', marginBottom: '12px' }}>{icon}</div>
              <div style={{
                fontSize: '14px', fontWeight: 700,
                color: 'var(--txt-primary)', marginBottom: '7px',
              }}>
                {title}
              </div>
              <div style={{
                fontSize: '12.5px', color: 'var(--txt-muted)',
                lineHeight: 1.65, marginBottom: '16px',
              }}>
                {desc}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color }}>{cta}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;
