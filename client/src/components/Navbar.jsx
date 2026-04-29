import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const navLinks = isAuthenticated
    ? [
        { label: 'Dashboard',  path: '/dashboard' },
        { label: 'Overview',   path: '/overview'  },
        { label: 'Upload',     path: '/upload'    },
      ]
    : [
        { label: 'Sign In',         path: '/'               },
        { label: 'Register',        path: '/signup'         },
        { label: 'Reset Password',  path: '/forgot-password'},
        { label: 'Verify OTP',      path: '/verify-otp'    },
      ];

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-[60px] flex items-center justify-between px-4 md:px-8"
      style={{
        background: 'rgba(247,244,239,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-base)',
      }}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ backgroundColor: 'var(--acc)', boxShadow: '0 2px 8px rgba(188,108,95,0.25)' }}
        >
          ⚖️
        </div>
        <span className="font-serif text-[17px] font-semibold text-txt-primary">
          GST<span style={{ color: 'var(--acc)' }}>Wand</span>
        </span>
      </Link>

      {/* Center Nav Tabs — desktop */}
      <div
        className="hidden md:flex items-center gap-1 p-1"
        style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-base)', borderRadius: '999px' }}
      >
        {navLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/'}
            className={({ isActive }) =>
              `px-5 py-1.5 text-[13px] font-medium transition-all duration-150 whitespace-nowrap rounded-full ${
                isActive
                  ? 'text-white'
                  : 'text-txt-muted hover:bg-bg-hover'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--acc)' : 'transparent',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
            })}
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      {/* Right — desktop */}
      <div className="hidden md:flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <span className="text-[13px] text-txt-secondary">Hi, {user?.firstName || 'User'}</span>
            <button
              onClick={handleLogout}
              className="rounded-full border border-border-base bg-card px-4 py-2 text-[13px] font-semibold text-txt-secondary transition hover:bg-bg-hover"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <span className="text-[13px] text-txt-muted">Help</span>
            <span className="text-[13px] font-semibold text-txt-secondary">+91-9811775008</span>
          </>
        )}
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden flex flex-col justify-center gap-[5px] p-2 rounded-md hover:bg-bg-hover transition-colors"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span
          className="block w-5 h-[2px] bg-txt-secondary transition-all duration-200 origin-center"
          style={{ transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }}
        />
        <span
          className="block w-5 h-[2px] bg-txt-secondary transition-all duration-200"
          style={{ opacity: menuOpen ? 0 : 1 }}
        />
        <span
          className="block w-5 h-[2px] bg-txt-secondary transition-all duration-200 origin-center"
          style={{ transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }}
        />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="absolute top-[60px] left-0 right-0 md:hidden flex flex-col gap-1 p-3 shadow-md"
          style={{ background: 'rgba(247,244,239,0.99)', borderBottom: '1px solid var(--border-base)' }}
        >
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'text-white' : 'text-txt-secondary hover:bg-bg-hover'
                }`
              }
              style={({ isActive }) => ({ background: isActive ? 'var(--acc)' : 'transparent' })}
            >
              {link.label}
            </NavLink>
          ))}
          <div className="flex flex-col gap-2 px-4 pt-2 mt-1 border-t border-border-base">
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--acc)' }}
              >
                Log out
              </button>
            ) : (
              <span className="text-xs text-txt-muted">+91-9811775008</span>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
