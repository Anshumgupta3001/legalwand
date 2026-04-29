import React from 'react';
import NewsPanel from '../components/NewsPanel';

const ACC = '#BC6C5F';

const NewsPage = () => (
  <div style={{ padding: '36px 36px 60px' }}>
    {/* Page header */}
    <div style={{ marginBottom: '28px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '.1em',
        textTransform: 'uppercase', color: ACC,
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '8px',
      }}>
        <span style={{ display: 'block', width: '20px', height: '1px', background: ACC }} />
        AI / Insights
      </div>
      <h1 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '28px',
        color: 'var(--txt-primary)',
        lineHeight: 1.2,
        margin: 0,
      }}>
        News Feed
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--txt-muted)', marginTop: '5px' }}>
        Latest GST &amp; legal updates — live from trusted sources
      </p>
    </div>

    {/* Existing NewsPanel — zero changes to logic */}
    <NewsPanel />
  </div>
);

export default NewsPage;
