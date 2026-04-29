const stats = [
  { value: '1,000+', label: 'Trusted Clients' },
  { value: '15K+',   label: 'Returns Filed'   },
  { value: '4.85/5', label: 'Satisfaction'    },
  { value: '100%',   label: 'Support SLA'     },
];

const trust = [
  'GSTN Certified Suvidha Provider',
  'ISO 27001 — Data Security Assured',
  'Registered with ICAI & Bar Council',
  'GST · Tax Litigation · Corporate Law',
];

const AuthLeftPanel = () => (
  <div
    className="auth-left-panel"
    style={{
      width: '380px',
      flexShrink: 0,
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border-base)',
      padding: '52px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      overflowY: 'auto',
    }}
  >
    {/* Logo */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px',
        background: 'var(--acc)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '18px',
        boxShadow: '0 2px 8px rgba(188,108,95,0.25)',
      }}>⚖️</div>
      <span style={{
        fontFamily: 'var(--font-serif)', fontSize: '18px',
        fontWeight: 600, color: 'var(--txt-primary)',
      }}>
        GST<span style={{ color: 'var(--acc)' }}>Wand</span>
      </span>
    </div>

    {/* Headline */}
    <h2 style={{
      fontFamily: 'var(--font-serif)', fontSize: '38px', fontWeight: 700,
      lineHeight: 1.18, color: 'var(--txt-primary)', margin: 0,
    }}>
      Your Legal <em style={{ color: 'var(--acc)', fontStyle: 'italic' }}>Ally</em><br />
      in Tax &amp;<br />
      Compliance
    </h2>

    {/* Description */}
    <p style={{
      fontSize: '14.5px', fontFamily: 'var(--font-sans)',
      color: 'var(--txt-secondary)', lineHeight: 1.8, margin: 0,
    }}>
      Simplifying GST filing, ITC reconciliation and tax litigation with
      expert-led, client-first solutions — trusted by businesses across
      Delhi, Gurugram &amp; Pan-India.
    </p>

    {/* Stats 2×2 grid */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      {stats.map(({ value, label }) => (
        <div key={label} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-base)',
          borderRadius: 'var(--r-md)', padding: '16px 18px',
        }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '24px',
            fontWeight: 600, color: 'var(--acc)',
          }}>{value}</div>
          <div style={{
            fontSize: '12px', fontFamily: 'var(--font-sans)',
            color: 'var(--txt-muted)', marginTop: '2px',
          }}>{label}</div>
        </div>
      ))}
    </div>

    {/* Divider */}
    <div style={{ height: '1px', background: 'var(--border-base)' }} />

    {/* Trust list */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {trust.map((item) => (
        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--acc)', flexShrink: 0,
          }} />
          <span style={{
            fontSize: '13px', color: 'var(--txt-secondary)',
            fontFamily: 'var(--font-sans)',
          }}>{item}</span>
        </div>
      ))}
    </div>

    {/* Badge pill */}
    <div style={{ marginTop: 'auto' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: 'var(--bg-card)', border: '1px solid var(--border-base)',
        borderRadius: 'var(--r-pill)', padding: '8px 14px',
        fontSize: '12px', fontFamily: 'var(--font-sans)', color: 'var(--txt-secondary)',
      }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: 'var(--ok)', display: 'inline-block', flexShrink: 0,
        }} />
        256-bit SSL · SOC 2 Type II · GSTN Approved
      </div>
    </div>
  </div>
);

export default AuthLeftPanel;
