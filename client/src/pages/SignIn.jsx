import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import AuthLeftPanel from '../components/AuthLeftPanel';

/* ── shared input style helper ── */
const inputStyle = {
  width: '100%',
  padding: '12px 14px 12px 42px',
  border: '1.5px solid var(--border-base)',
  borderRadius: 'var(--r-sm)',
  background: 'var(--bg-input)',
  fontSize: '14px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--txt-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'var(--t)',
};

const formTabs = [
  { label: 'Sign In', path: '/'               },
  { label: 'Sign Up', path: '/signup'         },
  { label: 'Reset',   path: '/forgot-password'},
  { label: 'OTP',     path: '/verify-otp'    },
];

const SignIn = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const { login, isAuthenticated, loading } = useAuth();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginType,  setLoginType]  = useState('Email');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please enter both email and password.'); return; }
    try {
      await login({ email, password });
      toast.success('Signed in successfully');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to sign in.');
    }
  };

  const focusIn  = (e) => { e.target.style.borderColor = 'var(--border-focus)'; e.target.style.boxShadow = '0 0 0 3px var(--acc-mid)'; };
  const focusOut = (e) => { e.target.style.borderColor = 'var(--border-base)';  e.target.style.boxShadow = 'none'; };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
      <AuthLeftPanel />

      {/* Right form area */}
      <div
        className="auth-right-panel"
        style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '40px 56px',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Form tab switcher */}
          <div style={{
            display: 'flex', gap: '2px', padding: '4px',
            background: 'var(--bg-panel)', border: '1px solid var(--border-base)',
            borderRadius: 'var(--r-md)', marginBottom: '28px',
          }}>
            {formTabs.map(({ label, path }) => {
              const active = path === '/';
              return (
                <Link key={path} to={path} style={{
                  flex: 1, padding: '8px 10px', borderRadius: '10px',
                  textAlign: 'center', fontSize: '13px', textDecoration: 'none',
                  fontWeight: active ? 600 : 400,
                  background: active ? 'var(--bg-card)' : 'transparent',
                  color: active ? 'var(--txt-primary)' : 'var(--txt-muted)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  transition: 'var(--t)', whiteSpace: 'nowrap',
                }}>{label}</Link>
              );
            })}
          </div>

          {/* Eyebrow + heading */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '11px', fontWeight: 600, letterSpacing: '1.8px',
              color: 'var(--acc)', textTransform: 'uppercase', marginBottom: '10px',
            }}>
              <div style={{ width: '20px', height: '1.5px', background: 'var(--acc)' }} />
              Secure Access
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', margin: 0, lineHeight: 1.2 }}>
              Welcome <em style={{ color: 'var(--acc)' }}>Back</em>
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--txt-secondary)', margin: '8px 0 0', lineHeight: 1.7 }}>
              Sign in to your GSTWand portal and access your compliance dashboard.
            </p>
          </div>

          {/* Login type toggle */}
          <div style={{
            display: 'flex', gap: '2px', padding: '4px',
            background: 'var(--bg-panel)', border: '1px solid var(--border-base)',
            borderRadius: 'var(--r-md)', marginBottom: '20px',
          }}>
            {[['Email','✉️'], ['Mobile','📱'], ['GSTIN','🏢']].map(([type, icon]) => (
              <button key={type} onClick={() => setLoginType(type)} style={{
                flex: 1, padding: '8px 10px', borderRadius: '10px',
                border: 'none', cursor: 'pointer', fontSize: '13px',
                fontWeight: loginType === type ? 600 : 400,
                background: loginType === type ? 'var(--bg-card)' : 'transparent',
                color: loginType === type ? 'var(--txt-primary)' : 'var(--txt-muted)',
                boxShadow: loginType === type ? 'var(--shadow-sm)' : 'none',
                transition: 'var(--t)', fontFamily: 'var(--font-sans)',
              }}>{icon} {type}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--txt-secondary)', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>✉️</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="rajesh@techfirm.co.in" style={inputStyle}
                  onFocus={focusIn} onBlur={focusOut} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--txt-secondary)', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>🔑</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" style={inputStyle}
                  onFocus={focusIn} onBlur={focusOut} />
              </div>
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: 'var(--acc)', width: '14px', height: '14px' }} />
                <span style={{ fontSize: '13px', color: 'var(--txt-secondary)' }}>Remember this device</span>
              </label>
              <Link to="/forgot-password" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--acc)', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            {/* Primary button */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px 20px',
                background: 'var(--acc)', color: '#fff',
                border: 'none', borderRadius: 'var(--r-sm)',
                fontSize: '14.5px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 8px var(--acc-glow)', transition: 'var(--t)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'var(--acc-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--acc)'; e.currentTarget.style.transform = 'none'; }}
            >
              {loading ? 'Signing in...' : '🔐 Sign In Securely'}
            </button>
          </form>

          {/* OR divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-base)' }} />
            <span style={{ fontSize: '12px', color: 'var(--txt-muted)', whiteSpace: 'nowrap' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-base)' }} />
          </div>

          {/* Google ghost button */}
          <button style={{
            width: '100%', padding: '13px 20px',
            background: 'var(--bg-card)', border: '1.5px solid var(--border-base)',
            color: 'var(--txt-secondary)', borderRadius: 'var(--r-sm)',
            fontSize: '14px', fontFamily: 'var(--font-sans)',
            cursor: 'pointer', transition: 'var(--t)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.transform = 'none'; }}
          >
            🌐 Sign in with Google Workspace
          </button>

          {/* Security strip */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap',
            marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-base)',
          }}>
            {['🔒 Encrypted', '✅ GSTN Live', '⚖️ Legal Grade'].map((badge) => (
              <span key={badge} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-base)',
                borderRadius: 'var(--r-pill)', padding: '5px 12px',
                fontSize: '11.5px', fontFamily: 'var(--font-sans)', color: 'var(--txt-secondary)',
              }}>{badge}</span>
            ))}
          </div>

          {/* Bottom link */}
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--txt-muted)', marginTop: '16px' }}>
            New to GSTWand?{' '}
            <Link to="/signup" style={{ color: 'var(--acc)', fontWeight: 600, textDecoration: 'none' }}>
              Create free account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
