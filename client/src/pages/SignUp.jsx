import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import AuthLeftPanel from '../components/AuthLeftPanel';

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

const SignUp = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const { register, isAuthenticated, loading } = useAuth();

  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) { toast.error('Please fill in all required fields.'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    try {
      await register({ firstName, lastName, email, password });
      toast.success('Account created successfully');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to create account.');
    }
  };

  const focusIn  = (e) => { e.target.style.borderColor = 'var(--border-focus)'; e.target.style.boxShadow = '0 0 0 3px var(--acc-mid)'; };
  const focusOut = (e) => { e.target.style.borderColor = 'var(--border-base)';  e.target.style.boxShadow = 'none'; };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
      <AuthLeftPanel />

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
              const active = path === '/signup';
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
              Create Account
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', margin: 0, lineHeight: 1.2 }}>
              Join <em style={{ color: 'var(--acc)' }}>GSTWand</em>
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--txt-secondary)', margin: '8px 0 0', lineHeight: 1.7 }}>
              Start using GSTWand to manage your filings and business compliance.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--txt-secondary)', marginBottom: '6px' }}>First name</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>👤</span>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--txt-secondary)', marginBottom: '6px' }}>Last name</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>👤</span>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--txt-secondary)', marginBottom: '6px' }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>✉️</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--txt-secondary)', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>🔑</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--txt-secondary)', marginBottom: '6px' }}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>🔒</span>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
              </div>
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
              {loading ? 'Creating account...' : '🚀 Create Account'}
            </button>
          </form>

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
            Already have an account?{' '}
            <Link to="/" style={{ color: 'var(--acc)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
