import React from 'react';

const ACC = '#BC6C5F';

const NewClientPage = () => (
  <div style={{
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    background: '#faf8f5',
  }}>

    {/* Icon */}
    <div style={{
      width: '56px', height: '56px',
      borderRadius: '16px',
      background: ACC,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 16px rgba(188,108,95,0.25)',
    }}>➕</div>

    {/* Eyebrow */}
    <div style={{
      fontSize: '10px', fontWeight: 700,
      letterSpacing: '.12em', textTransform: 'uppercase',
      color: ACC, marginBottom: '10px',
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <span style={{ display: 'block', width: '20px', height: '1px', background: ACC }} />
      Clients
      <span style={{ display: 'block', width: '20px', height: '1px', background: ACC }} />
    </div>

    {/* Title */}
    <h1 style={{
      fontFamily: 'var(--font-serif)',
      fontSize: '32px',
      fontWeight: 600,
      color: '#1f1510',
      margin: '0 0 12px',
      textAlign: 'center',
    }}>
      New Client
    </h1>

    {/* Coming soon badge */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 20px',
      borderRadius: '24px',
      background: 'rgba(188,108,95,0.08)',
      border: '1px solid rgba(188,108,95,0.2)',
      fontSize: '15px', fontWeight: 600,
      color: ACC, marginBottom: '14px',
    }}>
      Coming Soon 🚀
    </div>

    {/* Subtext */}
    <p style={{
      fontSize: '14px',
      color: '#9a8c7c',
      textAlign: 'center',
      maxWidth: '340px',
      lineHeight: 1.7,
      margin: 0,
    }}>
      We are building something powerful for you.
    </p>

  </div>
);

export default NewClientPage;
