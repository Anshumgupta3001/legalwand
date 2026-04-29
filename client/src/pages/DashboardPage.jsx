import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { analyticsDataAPI } from '../services/api';

/* ── Palette ── */
const C = {
  bg:       '#f5f4f0',
  surface:  '#ffffff',
  surfAlt:  '#faf9f7',
  border:   '#e5e2db',
  accent:   '#BC6C5F',
  accentBg: '#fdf2f0',
  text:     '#1a1714',
  sub:      '#6b6560',
  muted:    '#a09890',
  green:    '#16a34a',
  greenBg:  '#f0fdf4',
  amber:    '#d97706',
  amberBg:  '#fffbeb',
  blue:     '#2563eb',
  blueBg:   '#eff6ff',
  red:      '#dc2626',
};

const CHART_COLORS = ['#BC6C5F','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#6366f1'];

/* ── Spinner ── */
const Spinner = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite', display: 'block' }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <circle cx="12" cy="12" r="9" fill="none" stroke={C.accent} strokeWidth="2.5" strokeDasharray="38 18" strokeLinecap="round" />
  </svg>
);

/* ── Stat Card ── */
const StatCard = ({ icon, label, value, sub, color }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px',
    padding: '20px 20px 18px', boxShadow: '0 1px 6px rgba(0,0,0,.05)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px',
        background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: C.sub }}>{label}</div>
    </div>
    <div style={{ fontSize: '28px', fontWeight: 800, color: C.text, letterSpacing: '-.5px' }}>{value}</div>
    {sub && <div style={{ marginTop: '4px', fontSize: '12px', color: C.muted }}>{sub}</div>}
  </div>
);

/* ── Chart Card ── */
const ChartCard = ({ title, children, height = 260 }) => (
  <div style={{
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px',
    padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,.05)',
  }}>
    <div style={{ fontSize: '13.5px', fontWeight: 700, color: C.text, marginBottom: '16px' }}>{title}</div>
    <div style={{ height }}>{children}</div>
  </div>
);

/* ── Custom tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
      padding: '8px 12px', fontSize: '12.5px', boxShadow: '0 4px 12px rgba(0,0,0,.1)',
    }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.accent }}>{p.name || 'Count'}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
};

/* ── Section heading ── */
const Section = ({ children }) => (
  <div style={{
    fontSize: '10px', fontWeight: 700, color: C.muted,
    letterSpacing: '.1em', textTransform: 'uppercase',
    marginBottom: '12px', marginTop: '28px',
    display: 'flex', alignItems: 'center', gap: '8px',
  }}>
    <span style={{ flex: 1, height: '1px', background: C.border }} />
    {children}
    <span style={{ flex: 1, height: '1px', background: C.border }} />
  </div>
);

const DashboardPage = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    analyticsDataAPI.getAnalytics()
      .then(res => setData(res.data.data))
      .catch(() => setError('Failed to load analytics. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '16px' }}>
      <Spinner />
      <div style={{ fontSize: '13px', color: C.muted }}>Loading analytics…</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ padding: '20px 28px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #dc262622', color: '#dc2626', fontSize: '13px' }}>{error}</div>
    </div>
  );

  if (!data) return null;

  const { summary, byDecision, byCourt, byState, bySection, byMonth, confidence } = data;
  const totalConf = (confidence.high + confidence.medium + confidence.low) || 1;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'inherit', padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.text, letterSpacing: '-.5px' }}>Analytics</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.sub }}>Real-time insights from your GST case law library.</p>
      </div>

      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
        <StatCard icon="📂" label="Total Documents"  value={summary.total.toLocaleString()}    color={C.accent} />
        <StatCard icon="✓"  label="Verified"         value={summary.verified.toLocaleString()}  color={C.green}  sub={`${summary.verifiedPct}% of total`} />
        <StatCard icon="⚠" label="Needs Review"     value={summary.unverified.toLocaleString()} color={C.amber} />
        <StatCard icon="🧠" label="High Confidence"  value={`${Math.round(confidence.high / totalConf * 100)}%`} color={C.blue} sub={`${confidence.high} documents`} />
      </div>

      {/* ── Confidence donut-style breakdown ── */}
      <Section>Confidence Distribution</Section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

        <ChartCard title="Data Confidence">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'High',   value: confidence.high   },
                  { name: 'Medium', value: confidence.medium },
                  { name: 'Low',    value: confidence.low    },
                ]}
                cx="50%" cy="50%" outerRadius={90} innerRadius={55}
                dataKey="value" paddingAngle={2}
              >
                {[C.green, C.amber, C.red].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Uploads trend ── */}
        <ChartCard title="Uploads Over Time (Last 12 Months)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byMonth} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3, fill: C.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── By Decision ── */}
      <Section>Cases by Final Decision</Section>
      <ChartCard title="Final Decision Breakdown" height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byDecision} layout="vertical" margin={{ top: 0, right: 24, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: C.sub }} width={100} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Cases">
              {byDecision.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── By Court + By State ── */}
      <Section>By Court & State</Section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <ChartCard title="Top Courts" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCourt} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: C.sub }} width={140} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 5, 5, 0]} fill={C.blue} name="Cases" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top States" height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byState} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: C.sub }} width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 5, 5, 0]} fill={C.green} name="Cases" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Top Sections ── */}
      <Section>Most Cited Sections</Section>
      <ChartCard title="Top GST Sections Involved" height={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bySection} margin={{ top: 4, right: 16, left: 4, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.sub, angle: -35, textAnchor: 'end' }} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: C.muted }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Cases">
              {bySection.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ height: '40px' }} />
    </div>
  );
};

export default DashboardPage;
