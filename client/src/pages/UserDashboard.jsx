import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { adminAPI } from '../services/api';

const ACC = '#BC6C5F';
const ACC_LIGHT = 'rgba(188,108,95,0.1)';
const ADMIN_KEY = '0000';
const SESSION_KEY = 'gstwand_admin_unlocked';

/* ── Helpers ── */
const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/* ── Small reusable pieces ── */
const StatCard = ({ icon, label, value, sub }) => (
  <div className="rounded-2xl p-5"
    style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4', boxShadow: '0 1px 6px rgba(26,18,8,0.04)' }}>
    <div className="text-xl mb-2">{icon}</div>
    <div className="text-[28px] font-bold font-serif" style={{ color: '#1f1510' }}>{value}</div>
    <div className="text-[12px] font-medium mt-0.5" style={{ color: '#9a8c7c' }}>{label}</div>
    {sub && <div className="text-[11px] mt-0.5" style={{ color: '#c4b49a' }}>{sub}</div>}
  </div>
);

const Badge = ({ ok }) => (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
    style={ok
      ? { backgroundColor: 'rgba(90,154,122,0.12)', color: '#5a9a7a' }
      : { backgroundColor: 'rgba(192,57,43,0.1)', color: '#c0392b' }}>
    {ok ? '✓ Verified' : '✗ Unverified'}
  </span>
);

const Skeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => (
        <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ backgroundColor: '#f0ebe4' }} />
      ))}
    </div>
    <div className="h-56 rounded-2xl animate-pulse" style={{ backgroundColor: '#f0ebe4' }} />
    <div className="h-64 rounded-2xl animate-pulse" style={{ backgroundColor: '#f0ebe4' }} />
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[12px]"
      style={{ backgroundColor: '#1f1510', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div className="font-semibold">{label}</div>
      <div style={{ color: '#fdd9d3' }}>{payload[0].value} msg{payload[0].value !== 1 ? 's' : ''}</div>
    </div>
  );
};

/* ════════════════════════════════════════
   KEY GATE
════════════════════════════════════════ */
const KeyGate = ({ onUnlock }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (key === ADMIN_KEY) {
      sessionStorage.setItem(SESSION_KEY, '1');
      onUnlock();
    } else {
      setError('Invalid key. Access denied.');
      setShake(true);
      setKey('');
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ backgroundColor: ACC, boxShadow: '0 4px 16px rgba(188,108,95,0.3)' }}>⚖️</div>
          <span className="font-serif text-[20px] font-semibold" style={{ color: '#1f1510' }}>
            GST<span style={{ color: ACC }}>Wand</span>
          </span>
        </div>

        <div className="rounded-2xl p-8"
          style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4', boxShadow: '0 4px 24px rgba(26,18,8,0.08)' }}>
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
              style={{ backgroundColor: ACC_LIGHT }}>🔐</div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: ACC }}>
              Admin Access
            </div>
            <h1 className="font-serif text-[20px] font-semibold" style={{ color: '#1f1510' }}>
              Enter Admin Key
            </h1>
            <p className="text-[12px] mt-1" style={{ color: '#9a8c7c' }}>
              This area is restricted to administrators only.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className={`transition-all duration-150 ${shake ? 'translate-x-2' : ''}`}
              style={{ animation: shake ? 'shake 0.4s ease' : 'none' }}>
              <input
                ref={inputRef}
                type="password"
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(''); }}
                placeholder="Enter admin key"
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all"
                style={{
                  backgroundColor: '#faf8f5',
                  border: `1.5px solid ${error ? '#c0392b' : '#e8e0d4'}`,
                  color: '#1f1510',
                  letterSpacing: key ? '6px' : 'normal',
                }}
                onFocus={e => { if (!error) e.target.style.borderColor = ACC; }}
                onBlur={e => { if (!error) e.target.style.borderColor = '#e8e0d4'; }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
                style={{ backgroundColor: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', color: '#c0392b' }}>
                <span>⚠</span> {error}
              </div>
            )}

            <button type="submit" disabled={!key.trim()}
              className="w-full py-3 rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-px disabled:opacity-40"
              style={{ backgroundColor: ACC, color: '#fff', boxShadow: '0 4px 16px rgba(188,108,95,0.25)' }}>
              Unlock Dashboard
            </button>
          </form>

          <p className="text-center text-[11px] mt-5" style={{ color: '#c4b49a' }}>
            <Link to="/dashboard" style={{ color: ACC }} className="hover:underline">← Back to Chat</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

/* ════════════════════════════════════════
   USER ROW (expandable)
════════════════════════════════════════ */
const UserRow = ({ user, idx }) => {
  const [open, setOpen] = useState(false);
  const creditPct = Math.round((user.credits / 10) * 100);

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className="cursor-pointer transition-colors"
        style={{ borderBottom: '1px solid #f0ebe4' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#faf8f5'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = open ? '#fdf9f7' : 'transparent'}>
        <td className="px-4 py-3 text-[12px] font-medium" style={{ color: '#9a8c7c' }}>{idx + 1}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: ACC }}>
              {(user.name[0] || 'U').toUpperCase()}
            </div>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: '#1f1510' }}>{user.name}</div>
              <div className="text-[11px]" style={{ color: '#9a8c7c' }}>{user.email}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <Badge ok={user.isVerified} />
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-[13px] font-semibold" style={{ color: '#1f1510' }}>{user.totalChats}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-[13px] font-semibold" style={{ color: '#1f1510' }}>{user.totalMessages}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-[13px] font-bold" style={{ color: user.credits <= 2 ? '#c0392b' : '#1f1510' }}>
            {user.credits}<span className="text-[10px] font-normal" style={{ color: '#9a8c7c' }}>/10</span>
          </span>
        </td>
        <td className="px-4 py-3 text-[12px] text-center" style={{ color: '#9a8c7c' }}>
          {fmtDate(user.createdAt)}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-[11px]" style={{ color: ACC }}>{open ? '▲' : '▼'}</span>
        </td>
      </tr>

      {open && (
        <tr style={{ backgroundColor: '#fdf9f7' }}>
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4' }}>
                <div className="text-[18px] font-bold font-serif" style={{ color: '#1f1510' }}>{user.totalChats}</div>
                <div className="text-[10px]" style={{ color: '#9a8c7c' }}>Chats</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4' }}>
                <div className="text-[18px] font-bold font-serif" style={{ color: '#1f1510' }}>{user.totalMessages}</div>
                <div className="text-[10px]" style={{ color: '#9a8c7c' }}>Messages</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4' }}>
                <div className="text-[18px] font-bold font-serif" style={{ color: '#1f1510' }}>{user.creditsUsed}</div>
                <div className="text-[10px]" style={{ color: '#9a8c7c' }}>Credits Used</div>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4' }}>
                <div className="text-[10px] mb-1.5" style={{ color: '#9a8c7c' }}>Credit Bar</div>
                <div className="h-2 rounded-full" style={{ backgroundColor: '#f0ebe4' }}>
                  <div className="h-2 rounded-full"
                    style={{ width: `${creditPct}%`, backgroundColor: creditPct > 30 ? ACC : '#c0392b' }} />
                </div>
                <div className="text-[10px] mt-1" style={{ color: '#9a8c7c' }}>{user.credits} remaining</div>
              </div>
            </div>
            <div className="text-[11px]" style={{ color: '#9a8c7c' }}>
              Joined: {fmtDate(user.createdAt)}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/* ════════════════════════════════════════
   ADMIN DASHBOARD
════════════════════════════════════════ */
const AdminDashboard = ({ onLock }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await adminAPI.getOverview();
        setData(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load admin data.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleLock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    onLock();
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
        <AdminHeader onLock={handleLock} />
        <div className="max-w-6xl mx-auto px-5 pb-12"><Skeleton /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-[14px] mb-4" style={{ color: '#5a4c3c' }}>{error}</p>
          <button onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white"
            style={{ backgroundColor: ACC }}>Retry</button>
        </div>
      </div>
    );
  }

  const { users, stats, activity } = data;
  const hasActivity = activity.some(d => d.count > 0);
  const maxCount = Math.max(...activity.map(d => d.count), 1);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <AdminHeader onLock={handleLock} userCount={stats.totalUsers} />

      <div className="max-w-6xl mx-auto px-5 pb-12 space-y-6">

        {/* ── Global Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon="👥" label="Total Users" value={stats.totalUsers} />
          <StatCard icon="💬" label="Total Chats" value={stats.totalChats} />
          <StatCard icon="📨" label="Total Messages" value={stats.totalMessages} />
          <StatCard icon="⚡" label="Credits Used" value={stats.totalCreditsUsed}
            sub={`across all users`} />
        </div>

        {/* ── Activity Chart ── */}
        <div className="rounded-2xl p-6"
          style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4', boxShadow: '0 1px 6px rgba(26,18,8,0.04)' }}>
          <div className="mb-5">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: ACC }}>Activity</div>
            <h3 className="text-[15px] font-semibold" style={{ color: '#1f1510' }}>Platform Messages — Last 7 Days</h3>
          </div>
          {hasActivity ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={activity} barCategoryGap="35%">
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9a8c7c' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9a8c7c' }} width={24} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(188,108,95,0.06)', radius: 8 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {activity.map((entry) => (
                    <Cell key={entry.date} fill={entry.count > 0 ? ACC : '#e8e0d4'}
                      fillOpacity={entry.count === maxCount ? 1 : 0.5 + (entry.count / maxCount) * 0.5} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center rounded-xl"
              style={{ backgroundColor: '#faf8f5', border: '1px dashed #e8e0d4' }}>
              <span className="text-3xl mb-2">📊</span>
              <p className="text-[13px]" style={{ color: '#9a8c7c' }}>No activity in the last 7 days</p>
            </div>
          )}
        </div>

        {/* ── Users Table ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4', boxShadow: '0 1px 6px rgba(26,18,8,0.04)' }}>

          {/* Table header + search */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ borderBottom: '1px solid #e8e0d4' }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: ACC }}>Users</div>
              <h3 className="text-[15px] font-semibold" style={{ color: '#1f1510' }}>
                All Users
                <span className="ml-2 text-[12px] font-normal" style={{ color: '#9a8c7c' }}>({filtered.length})</span>
              </h3>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full sm:w-64 px-4 py-2 rounded-xl text-[13px] outline-none"
              style={{ backgroundColor: '#faf8f5', border: '1.5px solid #e8e0d4', color: '#1f1510' }}
              onFocus={e => e.target.style.borderColor = ACC}
              onBlur={e => e.target.style.borderColor = '#e8e0d4'}
            />
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <span className="text-3xl block mb-2">👥</span>
                <p className="text-[13px]" style={{ color: '#9a8c7c' }}>
                  {search ? 'No users match your search.' : 'No users registered yet.'}
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr style={{ backgroundColor: '#faf8f5', borderBottom: '1px solid #e8e0d4' }}>
                    {['#', 'User', 'Status', 'Chats', 'Messages', 'Credits', 'Joined', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: '#9a8c7c' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, idx) => (
                    <UserRow key={user.id} user={user} idx={idx} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

/* ── Admin Header ── */
const AdminHeader = ({ onLock, userCount }) => (
  <div className="sticky top-0 z-10 px-5 py-4 mb-6 flex items-center justify-between"
    style={{ backgroundColor: '#f7f4ef', borderBottom: '1px solid #e8e0d4' }}>
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
        style={{ backgroundColor: ACC }}>⚖️</div>
      <span className="font-serif text-[16px] font-semibold" style={{ color: '#1f1510' }}>
        GST<span style={{ color: ACC }}>Wand</span>
      </span>
      <span className="hidden sm:block text-[11px] font-bold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: 'rgba(192,57,43,0.1)', color: '#c0392b' }}>🔐 Admin</span>
      {userCount !== undefined && (
        <span className="hidden sm:block text-[11px] px-2 py-0.5 rounded-full"
          style={{ backgroundColor: ACC_LIGHT, color: ACC }}>{userCount} users</span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <Link to="/dashboard"
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all hover:opacity-80"
        style={{ backgroundColor: '#fff', border: '1px solid #e8e0d4', color: '#5a4c3c' }}>
        ← Chat
      </Link>
      <button onClick={onLock}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all hover:opacity-80"
        style={{ backgroundColor: 'rgba(192,57,43,0.08)', color: '#c0392b', border: '1px solid rgba(192,57,43,0.2)' }}>
        🔒 Lock
      </button>
    </div>
  </div>
);

/* ════════════════════════════════════════
   ROOT — decides which screen to show
════════════════════════════════════════ */
const UserDashboard = () => {
  const [unlocked, setUnlocked] = useState(
    sessionStorage.getItem(SESSION_KEY) === '1'
  );

  if (!unlocked) {
    return <KeyGate onUnlock={() => setUnlocked(true)} />;
  }

  return <AdminDashboard onLock={() => setUnlocked(false)} />;
};

export default UserDashboard;
