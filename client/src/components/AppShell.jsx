import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_W = 260;

/*
 * NAV config — add disabled: true to any item you want to grey out.
 * Routes and backend are NOT affected; this is purely a UI restriction.
 * The item remains visible so users understand the feature exists.
 */
const NAV = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',        icon: '📊', path: '/home'            },
    ],
  },
  {
    section: 'AI',
    items: [
      { label: 'AI Chat',          icon: '💬', path: '/dashboard',       disabled: true  },
      { label: 'AI Chat (Updated)',icon: '⚖️', path: '/ai-chat-updated', disabled: false },
      { label: 'Library',          icon: '📂', path: '/library'                          },
      { label: 'Explorer',         icon: '🔍', path: '/explorer'                         },
    ],
  },
  {
    section: 'Clients',
    items: [
      { label: 'All Clients',      icon: '👥', path: '/clients',     disabled: true },
      { label: 'New Client',       icon: '➕', path: '/clients/new', disabled: true },
    ],
  },
  {
    section: 'Data',
    items: [
      { label: 'Data Management',  icon: '🗂️', path: '/data-management',  disabled: true  },
      { label: 'Upload',           icon: '📤', path: '/upload',           disabled: true  },
      { label: 'Overview',         icon: '📈', path: '/overview',         disabled: false },
    ],
  },
  {
    section: 'Other',
    items: [
      { label: 'News Feed',        icon: '📰', path: '/news'             },
      { label: 'Features',         icon: '✨', path: '/features'         },
    ],
  },
];

/* ── Shared item layout styles ── */
const ITEM_BASE = {
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  padding: '8px 10px',
  borderRadius: '8px',
  fontSize: '13.5px',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'background 0.15s, color 0.15s',
  margin: '1px 0',
  position: 'relative',
};

/*
 * NavItem — renders an active NavLink for enabled items, a non-interactive
 * div for disabled ones.  Disabled items:
 *   • Cannot be clicked or keyboard-navigated (tabIndex -1, no href)
 *   • Show reduced opacity + not-allowed cursor
 *   • Show a tooltip on hover ("Disabled")
 *   • Display a small inline badge so the state is obvious without hover
 */
const NavItem = ({ label, icon, path, disabled }) => {
  const [hovered, setHovered] = useState(false);

  const iconSpan = (
    <span style={{ fontSize: '15px', width: '22px', textAlign: 'center', flexShrink: 0, lineHeight: 1 }}>
      {icon}
    </span>
  );

  /* ── Disabled: non-interactive div ── */
  if (disabled) {
    return (
      <div
        role="menuitem"
        aria-disabled="true"
        title="This feature is currently disabled"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...ITEM_BASE,
          opacity: 0.62,
          cursor: 'not-allowed',
          color: 'rgba(255,255,255,0.7)',
          userSelect: 'none',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        {iconSpan}

        <span style={{ flex: 1 }}>{label}</span>

        {/* Inline badge — always visible, no hover required */}
        <span style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          padding: '2px 6px',
          borderRadius: '99px',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.35)',
          border: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}>
          off
        </span>

        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute',
            left: 'calc(100% + 10px)',
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#1e293b',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '11.5px',
            fontWeight: 500,
            padding: '5px 10px',
            borderRadius: '7px',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            zIndex: 200,
            pointerEvents: 'none',
          }}>
            This feature is disabled
            {/* Arrow */}
            <span style={{
              position: 'absolute',
              right: '100%', top: '50%', transform: 'translateY(-50%)',
              border: '5px solid transparent',
              borderRightColor: '#1e293b',
            }} />
          </div>
        )}
      </div>
    );
  }

  /* ── Enabled: standard NavLink ── */
  return (
    <NavLink
      to={path}
      className="shell-nav-item"
    >
      {iconSpan}
      {label}
    </NavLink>
  );
};

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
          {/* ── Active sections — enabled items only ── */}
          {NAV.map(({ section, items }) => {
            const enabled = items.filter(i => !i.disabled);
            if (enabled.length === 0) return null;
            return (
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
                {enabled.map(({ label, icon, path }) => (
                  <NavItem key={label} label={label} icon={icon} path={path} />
                ))}
              </div>
            );
          })}

          {/* ── Coming Soon — all disabled items collected globally ── */}
          {(() => {
            const allDisabled = NAV.flatMap(({ items }) =>
              items.filter(i => i.disabled)
            );
            if (allDisabled.length === 0) return null;
            return (
              <div>
                <div style={{
                  height: '1px',
                  background: 'rgba(255,255,255,0.08)',
                  margin: '16px 10px 0',
                }} />
                <div style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.22)',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  padding: '0 10px',
                  margin: '14px 0 6px',
                }}>
                  Coming Soon
                </div>
                {allDisabled.map(({ label, icon, path }) => (
                  <NavItem key={label} label={label} icon={icon} path={path} disabled />
                ))}
              </div>
            );
          })()}
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
