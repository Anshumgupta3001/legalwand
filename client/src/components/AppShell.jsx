import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_W = 260;

const NAV = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',      icon: '📊', path: '/home'            },
    ],
  },
  {
    section: 'AI',
    items: [
      { label: 'AI Chat',         icon: '💬', path: '/dashboard'          },
      { label: 'AI Chat (Updated)',icon: '⚖️', path: '/ai-chat-updated'   },
    ],
  },
  {
    section: 'Clients',
    items: [
      { label: 'All Clients',    icon: '👥', path: '/clients'         },
      { label: 'New Client',     icon: '➕', path: '/clients/new'     },
    ],
  },
  {
    section: 'Data',
    items: [
      { label: 'Data Management', icon: '🗂️', path: '/data-management' },
      { label: 'Upload',          icon: '📤', path: '/upload'          },
      { label: 'Overview',        icon: '📈', path: '/overview'        },
    ],
  },
  {
    section: 'GST Documents',
    items: [
      { label: 'Library',        icon: '📂', path: '/library'         },
      { label: 'Explorer',       icon: '🔍', path: '/explorer'        },
    ],
  },
  {
    section: 'Other',
    items: [
      { label: 'News Feed',      icon: '📰', path: '/news'            },
      { label: 'Features',       icon: '✨', path: '/features'        },
    ],
  },
];

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const initials = (
    (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')
  ).toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`.trim()
    : user?.email || 'User';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Fixed sidebar ── */}
      <aside style={{
        width: `${SIDEBAR_W}px`,
        flexShrink: 0,
        background: '#0f172a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0,
        height: '100vh',
        zIndex: 100,
        boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
      }}>

        {/* Logo */}
        <div style={{
          padding: '20px 18px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '34px', height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #BC6C5F 0%, #9a5248 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', flexShrink: 0,
            boxShadow: '0 2px 10px rgba(188,108,95,0.45)',
          }}>⚖️</div>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '17px',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-.3px',
          }}>
            GST<span style={{ color: '#BC6C5F' }}>Wand</span>
          </span>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px 10px', flex: 1, overflowY: 'auto' }}>
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                padding: '0 10px',
                margin: '20px 0 6px',
              }}>
                {section}
              </div>
              {items.map(({ label, icon, path }) => (
                <NavLink
                  key={label}
                  to={path}
                  className="shell-nav-item"
                >
                  <span style={{
                    fontSize: '15px',
                    width: '22px',
                    textAlign: 'center',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}>
                    {icon}
                  </span>
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User + sign out */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          {/* User card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)',
            marginBottom: '8px',
          }}>
            <div style={{
              width: '32px', height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #BC6C5F 0%, #9a5248 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(188,108,95,0.4)',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px', fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {displayName}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.35)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user?.email || ''}
              </div>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              padding: '9px 14px',
              borderRadius: '10px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.18)',
              color: 'rgba(239,68,68,0.8)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s, color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
              e.currentTarget.style.color = 'rgba(239,68,68,1)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.color = 'rgba(239,68,68,0.8)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)';
            }}
          >
            ↩ Sign Out
          </button>
        </div>
      </aside>

      {/* ── Content area ── */}
      <div style={{
        flex: 1,
        marginLeft: `${SIDEBAR_W}px`,
        minHeight: '100vh',
        background: 'var(--bg-base)',
      }}>
        {children}
      </div>
    </div>
  );
};

export default AppShell;
