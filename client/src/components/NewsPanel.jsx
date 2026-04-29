import React, { useState, useRef } from 'react';
import { newsAPI } from '../services/api';

const ACC = '#BC6C5F';

const CATEGORIES = [
  { label: 'GST News',      query: 'GST India',           icon: '📋' },
  { label: 'Finance',       query: 'finance news India',  icon: '💰' },
  { label: 'Tax Updates',   query: 'tax updates India',   icon: '📊' },
  { label: 'Business',      query: 'business news India', icon: '🏢' },
  { label: 'CBIC / GSTN',   query: 'CBIC GSTN India',     icon: '🏛️' },
  { label: 'Budget',        query: 'India budget tax',    icon: '📑' },
];

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SkeletonCard = () => (
  <div className="rounded-xl border animate-pulse" style={{ borderColor: '#e8e0d4', backgroundColor: '#fff' }}>
    <div className="h-40 rounded-t-xl" style={{ backgroundColor: '#f2ede6' }} />
    <div className="p-4 space-y-2">
      <div className="h-3 rounded w-1/3" style={{ backgroundColor: '#e8e0d4' }} />
      <div className="h-4 rounded w-full" style={{ backgroundColor: '#e8e0d4' }} />
      <div className="h-4 rounded w-5/6" style={{ backgroundColor: '#e8e0d4' }} />
      <div className="h-3 rounded w-2/3" style={{ backgroundColor: '#f2ede6' }} />
    </div>
  </div>
);

/* ── Spinner ── */
const Spinner = ({ size = 14, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ animation: 'np-spin 0.75s linear infinite', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.3" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/* ── Parse structured summary from markdown ── */
const parseSummary = (raw) => {
  const sections = { summary: [], insights: [], tldr: '' };
  let current = null;
  for (const line of (raw || '').split('\n')) {
    const t = line.trim();
    if (/^##\s*summary/i.test(t))  { current = 'summary';  continue; }
    if (/^##\s*insight/i.test(t))  { current = 'insights'; continue; }
    if (/^##\s*(tl;?dr|tldr)/i.test(t)) { current = 'tldr'; continue; }
    if (!t || /^#+/.test(t) || t === '---') continue;
    if (current === 'summary' || current === 'insights') {
      const bullet = t.replace(/^[-*•]\s*/, '').replace(/^\[|\]$/g, '').trim();
      if (bullet) sections[current].push(bullet);
    } else if (current === 'tldr') {
      sections.tldr += (sections.tldr ? ' ' : '') + t;
    }
  }
  return sections;
};

/* ── Summary section display ── */
const SummarySection = ({ icon, label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '11px', fontWeight: 700, color: '#5a4c3c',
      textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px',
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    {children}
  </div>
);

/* ── Stateful NewsCard ── */
const NewsCard = ({ article }) => {
  // sumState: null | 'loading' | { text: string } | { error: string }
  const [sumState,   setSumState]   = useState(null);
  const [sumVisible, setSumVisible] = useState(false);

  const hasSummary = sumState && sumState.text;
  const hasError   = sumState && sumState.error;
  const isLoading  = sumState === 'loading';

  const handleSummarize = async () => {
    if (isLoading) return;
    if (hasSummary) { setSumVisible((v) => !v); return; }

    setSumState('loading');
    setSumVisible(false);
    try {
      const res = await newsAPI.summarize(article.url);
      setSumState({ text: res.data.summary });
      setSumVisible(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate summary. Try again.';
      setSumState({ error: msg });
    }
  };

  const handleRetry = () => {
    setSumState(null);
    setSumVisible(false);
  };

  const parsed = hasSummary ? parseSummary(sumState.text) : null;

  /* Button label + style */
  let btnLabel = '✨ Summarize Article';
  if (isLoading)  btnLabel = 'Processing…';
  if (hasSummary) btnLabel = sumVisible ? '▲ Hide Summary' : '▼ Show Summary';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRadius: '12px', border: '1px solid #e8e0d4',
      backgroundColor: '#fff',
      boxShadow: '0 1px 4px rgba(26,18,8,0.04)',
      overflow: 'hidden',
      transition: 'border-color .2s, box-shadow .2s',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = ACC;
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(188,108,95,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e8e0d4';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(26,18,8,0.04)';
      }}
    >
      {/* ── Image (click → open article) ── */}
      <a href={article.url} target="_blank" rel="noopener noreferrer"
        className="flex-shrink-0 block h-40 overflow-hidden"
        style={{ backgroundColor: '#f2ede6' }}
        tabIndex={-1}
      >
        {article.image ? (
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">📰</div>
        )}
      </a>

      {/* ── Card body ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '14px' }}>
        {/* Source + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
            backgroundColor: 'rgba(188,108,95,0.1)', color: ACC,
          }}>{article.source}</span>
          <span style={{ fontSize: '11px', color: '#9a8c7c' }}>{formatDate(article.publishedAt)}</span>
        </div>

        {/* Title */}
        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <h3 style={{
            fontSize: '14px', fontWeight: 700, lineHeight: 1.45,
            color: '#1f1510', margin: '0 0 6px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.title}
          </h3>
        </a>

        {/* Description */}
        {article.description && (
          <p style={{
            fontSize: '12px', lineHeight: 1.55, color: '#9a8c7c', margin: '0 0 12px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.description}
          </p>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', flexWrap: 'wrap' }}>
          {/* Read Article */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '12px', fontWeight: 600, color: ACC,
              padding: '6px 12px', borderRadius: '8px',
              border: `1px solid rgba(188,108,95,0.3)`,
              background: 'rgba(188,108,95,0.06)',
              textDecoration: 'none', transition: 'background .15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(188,108,95,0.13)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(188,108,95,0.06)'; }}
          >
            Read Article →
          </a>

          {/* Summarize / toggle */}
          <button
            onClick={handleSummarize}
            disabled={isLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', fontWeight: 600,
              padding: '6px 12px', borderRadius: '8px',
              border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', transition: 'background .15s, opacity .15s',
              background: hasSummary
                ? (sumVisible ? '#1f1510' : '#1f1510')
                : 'linear-gradient(135deg, #BC6C5F, #9a5248)',
              color: '#fff',
              opacity: isLoading ? 0.75 : 1,
              boxShadow: hasSummary ? 'none' : '0 2px 8px rgba(188,108,95,0.3)',
            }}
          >
            {isLoading && <Spinner size={13} color="#fff" />}
            {btnLabel}
          </button>
        </div>

        {/* ── Error box ── */}
        {hasError && (
          <div style={{
            marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
              <p style={{ fontSize: '12px', color: '#8a2c1e', margin: 0, lineHeight: 1.5 }}>
                {sumState.error}
              </p>
            </div>
            <button
              onClick={handleRetry}
              style={{
                fontSize: '11px', fontWeight: 600, color: ACC,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Summary panel (expandable) ── */}
      {hasSummary && sumVisible && (
        <div style={{
          borderTop: '1px solid #e8e0d4',
          background: '#faf8f5',
          padding: '16px 14px',
          maxHeight: '420px',
          overflowY: 'auto',
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', borderRadius: '6px',
                background: 'linear-gradient(135deg, #BC6C5F, #9a5248)',
                fontSize: '11px',
              }}>✨</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1f1510' }}>AI Summary</span>
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
              background: 'rgba(90,154,122,0.12)', color: '#2d6e48',
            }}>Generated by AI</span>
          </div>

          {/* Summary section */}
          {parsed?.summary?.length > 0 && (
            <SummarySection icon="📋" label="Summary">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {parsed.summary.map((pt, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{
                      marginTop: '5px', width: '5px', height: '5px', borderRadius: '50%',
                      background: ACC, flexShrink: 0, display: 'block',
                    }} />
                    <span style={{ fontSize: '12.5px', lineHeight: 1.6, color: '#4a3c2c' }}>{pt}</span>
                  </li>
                ))}
              </ul>
            </SummarySection>
          )}

          {/* Insights section */}
          {parsed?.insights?.length > 0 && (
            <SummarySection icon="💡" label="Insights">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {parsed.insights.map((pt, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{
                      marginTop: '5px', width: '5px', height: '5px', borderRadius: '50%',
                      background: '#5a9a7a', flexShrink: 0, display: 'block',
                    }} />
                    <span style={{ fontSize: '12.5px', lineHeight: 1.6, color: '#4a3c2c' }}>{pt}</span>
                  </li>
                ))}
              </ul>
            </SummarySection>
          )}

          {/* TL;DR section */}
          {parsed?.tldr && (
            <div style={{
              padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(188,108,95,0.07)', border: '1px solid rgba(188,108,95,0.2)',
            }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, color: ACC,
                textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px',
              }}>⚡ TL;DR</div>
              <p style={{ fontSize: '12.5px', lineHeight: 1.65, color: '#4a3c2c', margin: 0 }}>
                {parsed.tldr}
              </p>
            </div>
          )}

          {/* Fallback: raw text if parsing gave nothing */}
          {(!parsed?.summary?.length && !parsed?.insights?.length && !parsed?.tldr) && (
            <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#4a3c2c', margin: 0 }}>
              {sumState.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════ NewsPanel ════════════════════════ */
const NewsPanel = () => {
  const [articles,        setArticles]        = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [activeQuery,     setActiveQuery]     = useState('');
  const [searchInput,     setSearchInput]     = useState('');
  const [activeCategory,  setActiveCategory]  = useState('');
  const searchRef = useRef(null);

  const loadNews = async (q, label = '') => {
    setLoading(true);
    setError('');
    setActiveQuery(label || q);
    try {
      const res = await newsAPI.getNews(q);
      setArticles(res.data.articles || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load news. Please try again.');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat.label);
    setSearchInput('');
    loadNews(cat.query, cat.label);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setActiveCategory('');
    loadNews(q, q);
  };

  const handleClear = () => {
    setSearchInput('');
    setActiveCategory('');
    setActiveQuery('');
    setArticles(null);
    setError('');
  };

  const isIdle = articles === null && !loading && !error;

  return (
    <>
      <style>{`@keyframes np-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="flex flex-col h-full" style={{ backgroundColor: '#faf8f5' }}>

        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 py-5" style={{ borderBottom: '1px solid #e8e0d4' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px] font-semibold" style={{ color: '#1f1510' }}>News</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(90,154,122,0.12)', color: '#5a9a7a' }}>
              Free · No credits used
            </span>
          </div>
          <p className="text-[12px] mb-4" style={{ color: '#9a8c7c' }}>
            Latest GST, taxation, and business news from India
          </p>

          {/* Category buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.label;
              return (
                <button
                  key={cat.label}
                  onClick={() => handleCategoryClick(cat)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-150 disabled:opacity-50"
                  style={{
                    backgroundColor: isActive ? ACC : '#fff',
                    color: isActive ? '#fff' : '#5a4c3c',
                    border: `1px solid ${isActive ? ACC : '#e8e0d4'}`,
                    boxShadow: isActive ? '0 2px 8px rgba(188,108,95,0.22)' : 'none',
                    transform: isActive ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border"
              style={{ backgroundColor: '#fff', borderColor: '#e8e0d4' }}>
              <span className="text-[13px]" style={{ color: '#9a8c7c' }}>🔍</span>
              <input
                ref={searchRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search news…"
                className="flex-1 outline-none text-[13px] bg-transparent"
                style={{ color: '#1f1510' }}
              />
              {searchInput && (
                <button type="button" onClick={handleClear}
                  className="text-[12px] transition-opacity hover:opacity-70"
                  style={{ color: '#9a8c7c' }}>✕</button>
              )}
            </div>
            <button
              type="submit"
              disabled={!searchInput.trim() || loading}
              className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:-translate-y-px disabled:opacity-50"
              style={{ backgroundColor: ACC }}>
              Search
            </button>
          </form>

          {activeQuery && !loading && (
            <p className="text-[12px] mt-2" style={{ color: '#9a8c7c' }}>
              Showing: <strong style={{ color: '#1f1510' }}>"{activeQuery}"</strong>
              <button onClick={handleClear} className="ml-2 hover:underline" style={{ color: ACC }}>
                Clear
              </button>
            </p>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {isIdle && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-5xl mb-4">📰</div>
              <p className="text-[15px] font-semibold mb-1" style={{ color: '#1f1510' }}>
                Get Latest News
              </p>
              <p className="text-[13px] mb-6 max-w-xs" style={{ color: '#9a8c7c' }}>
                Select a category above or search a topic to load the latest news — completely free, no credits used.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {CATEGORIES.slice(0, 3).map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => handleCategoryClick(cat)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all hover:-translate-y-px"
                    style={{ backgroundColor: 'rgba(188,108,95,0.08)', color: ACC, border: `1px solid rgba(188,108,95,0.2)` }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">📡</div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: '#1f1510' }}>Could not load news</p>
              <p className="text-[13px] mb-4" style={{ color: '#9a8c7c' }}>{error}</p>
              <button
                onClick={() => activeQuery && loadNews(activeQuery, activeQuery)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
                style={{ backgroundColor: ACC }}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && articles !== null && articles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: '#1f1510' }}>No articles found</p>
              <p className="text-[13px]" style={{ color: '#9a8c7c' }}>
                Try a different category or search term
              </p>
            </div>
          )}

          {!loading && !error && articles && articles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((article, i) => (
                <NewsCard key={`${article.url}-${i}`} article={article} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NewsPanel;
