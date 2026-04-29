/* ── Smart query parser: natural language → structured filters + semantic remainder ──
   Example: "section 73 set aside cases in gujarat 2023"
   → { sections:"Section 73", finalDecision:"Set Aside", state:"Gujarat", dateFrom:"2023-01-01", dateTo:"2023-12-31", semantic:"cases" }
*/

const { normalizeState, normalizeCourt, normalizeDecision, STATE_MAP, COURT_MAP, DECISION_MAP } = require('./normalizer');

/* ── Sorted state/court/decision keys for greedy matching ── */
const STATE_KEYS    = Object.keys(STATE_MAP).sort((a, b) => b.length - a.length);
const COURT_KEYS    = Object.keys(COURT_MAP).sort((a, b) => b.length - a.length);
const DECISION_KEYS = Object.keys(DECISION_MAP).sort((a, b) => b.length - a.length);

/* ── Patterns ── */
const SECTION_RE     = /\b(?:section|sec\.?|rule|article)\s*(\d+[\w()\/]*(?:\s*[,&]\s*\d+[\w()\/]*)*)/gi;
const BARE_SECTION_RE = /\bsec\s*(\d+[\w()\/]*)/gi;
const YEAR_RE        = /\b(20\d{2})\b/g;

const parseQuery = (raw) => {
  if (!raw || typeof raw !== 'string') return { semantic: '' };

  let q         = raw.trim();
  const result  = {};
  const removed = []; /* track spans to erase from q */

  const erase = (re) => {
    q = q.replace(re, (m) => { removed.push(m); return ' '; });
  };

  /* ── 1. Extract section numbers ── */
  const sections = [];
  q = q.replace(SECTION_RE, (match, nums) => {
    nums.split(/[,&\s]+/).filter(Boolean).forEach(n => sections.push(`Section ${n.trim()}`));
    return ' ';
  });
  q = q.replace(BARE_SECTION_RE, (match, n) => {
    sections.push(`Section ${n.trim()}`);
    return ' ';
  });
  if (sections.length) result.sections = sections.join(', ');

  /* ── 2. Extract final decision ── */
  for (const key of DECISION_KEYS) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(q)) {
      result.finalDecision = DECISION_MAP[key];
      erase(re);
      break;
    }
  }

  /* ── 3. Extract state ── */
  for (const key of STATE_KEYS) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(q)) {
      result.state = STATE_MAP[key];
      erase(re);
      break;
    }
  }

  /* ── 4. Extract court ── */
  for (const key of COURT_KEYS) {
    const re = new RegExp(`\\b${key.replace(/[-\s]+/g, '[-\\s]+').replace(/[&]/g, '[&]')}\\b`, 'i');
    if (re.test(q)) {
      result.court = COURT_MAP[key];
      erase(re);
      break;
    }
  }

  /* ── 5. Extract year → date range ── */
  const years = [];
  q = q.replace(YEAR_RE, (y) => { years.push(y); return ' '; });
  if (years.length === 1) {
    result.dateFrom = `${years[0]}-01-01`;
    result.dateTo   = `${years[0]}-12-31`;
  } else if (years.length >= 2) {
    const sorted = years.sort();
    result.dateFrom = `${sorted[0]}-01-01`;
    result.dateTo   = `${sorted[sorted.length - 1]}-12-31`;
  }

  /* ── 6. Remaining query = semantic search text ── */
  const semantic = q
    .replace(/\bcases?\b/gi, '')
    .replace(/\bmatters?\b/gi, '')
    .replace(/\bin\b/gi, '')
    .replace(/\bfor\b/gi, '')
    .replace(/\bof\b/gi, '')
    .replace(/\bthe\b/gi, '')
    .replace(/\band\b/gi, '')
    .replace(/\brelated\s+to\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  result.semantic = semantic;

  return result;
};

module.exports = { parseQuery };
