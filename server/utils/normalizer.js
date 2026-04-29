/* ── Data normalizer — apply before save and before query ── */

/* ── States (canonical spellings) ── */
const STATE_MAP = {
  'andhra pradesh': 'Andhra Pradesh',
  'andhra': 'Andhra Pradesh',
  'arunachal': 'Arunachal Pradesh',
  'arunachal pradesh': 'Arunachal Pradesh',
  'assam': 'Assam',
  'bihar': 'Bihar',
  'chhattisgarh': 'Chhattisgarh',
  'chattisgarh': 'Chhattisgarh',
  'goa': 'Goa',
  'gujarat': 'Gujarat',
  'haryana': 'Haryana',
  'himachal': 'Himachal Pradesh',
  'himachal pradesh': 'Himachal Pradesh',
  'jharkhand': 'Jharkhand',
  'karnataka': 'Karnataka',
  'kerala': 'Kerala',
  'madhya pradesh': 'Madhya Pradesh',
  'm.p.': 'Madhya Pradesh',
  'mp': 'Madhya Pradesh',
  'maharashtra': 'Maharashtra',
  'manipur': 'Manipur',
  'meghalaya': 'Meghalaya',
  'mizoram': 'Mizoram',
  'nagaland': 'Nagaland',
  'odisha': 'Odisha',
  'orissa': 'Odisha',
  'punjab': 'Punjab',
  'rajasthan': 'Rajasthan',
  'sikkim': 'Sikkim',
  'tamil nadu': 'Tamil Nadu',
  'tamilnadu': 'Tamil Nadu',
  'telangana': 'Telangana',
  'tripura': 'Tripura',
  'uttar pradesh': 'Uttar Pradesh',
  'u.p.': 'Uttar Pradesh',
  'up': 'Uttar Pradesh',
  'uttarakhand': 'Uttarakhand',
  'uttaranchal': 'Uttarakhand',
  'west bengal': 'West Bengal',
  'andaman': 'Andaman & Nicobar Islands',
  'chandigarh': 'Chandigarh',
  'dadra': 'Dadra & Nagar Haveli',
  'daman': 'Daman & Diu',
  'delhi': 'Delhi',
  'new delhi': 'Delhi',
  'lakshadweep': 'Lakshadweep',
  'puducherry': 'Puducherry',
  'pondicherry': 'Puducherry',
  'jammu': 'Jammu & Kashmir',
  'kashmir': 'Jammu & Kashmir',
  'j&k': 'Jammu & Kashmir',
  'ladakh': 'Ladakh',
};

/* ── Courts (canonical) ── */
const COURT_MAP = {
  'supreme court': 'Supreme Court of India',
  'sc': 'Supreme Court of India',
  'supreme court of india': 'Supreme Court of India',

  'allahabad high court': 'Allahabad High Court',
  'bombay high court': 'Bombay High Court',
  'calcutta high court': 'Calcutta High Court',
  'delhi high court': 'Delhi High Court',
  'gujarat high court': 'Gujarat High Court',
  'karnataka high court': 'Karnataka High Court',
  'kerala high court': 'Kerala High Court',
  'madras high court': 'Madras High Court',
  'punjab and haryana high court': 'Punjab & Haryana High Court',
  'punjab & haryana high court': 'Punjab & Haryana High Court',
  'rajasthan high court': 'Rajasthan High Court',
  'telangana high court': 'Telangana High Court',

  'aaar': 'AAAR',
  'appellate authority for advance ruling': 'AAAR',
  'aar': 'AAR',
  'authority for advance ruling': 'AAR',

  'gstat': 'GST Appellate Tribunal',
  'gstat': 'GST Appellate Tribunal',
  'gst appellate tribunal': 'GST Appellate Tribunal',

  'cestat': 'CESTAT',
  'customs excise service tax': 'CESTAT',
};

/* ── Final decision canonical values ── */
const DECISION_MAP = {
  'set aside': 'Set Aside',
  'setaside': 'Set Aside',
  'allowed': 'Allowed',
  'allow': 'Allowed',
  'dismissed': 'Dismissed',
  'dismiss': 'Dismissed',
  'remanded': 'Remanded',
  'remand': 'Remanded',
  'stayed': 'Stayed',
  'stay': 'Stayed',
  'disposed': 'Disposed',
  'disposed of': 'Disposed',
  'partly allowed': 'Partly Allowed',
  'partially allowed': 'Partly Allowed',
  'upheld': 'Upheld',
  'confirmed': 'Confirmed',
};

/* ── Date normalizer → YYYY-MM-DD ── */
const normalizeDate = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;
  const s = raw.trim();
  if (!s) return s;

  /* Already ISO */
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  /* DD-MM-YYYY or DD/MM/YYYY */
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  /* DD Month YYYY */
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const wordy = s.match(/^(\d{1,2})[\/\-\s]+([a-z]{3,9})[\/\-\s,]+(\d{4})$/i);
  if (wordy) {
    const [, d, mStr, y] = wordy;
    const mNum = months[mStr.slice(0, 3).toLowerCase()];
    if (mNum) return `${y}-${String(mNum).padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return s; /* Return as-is if unrecognized */
};

/* ── Section normalizer → "Section 73" format ── */
const normalizeSection = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;
  const s = raw.trim();

  /* Already prefixed */
  if (/^(Section|Rule|Article)\s+/i.test(s)) {
    return s.replace(/^(section|rule|article)\s+/i, (m) => m.trim().replace(/^./, c => c.toUpperCase()) + ' ');
  }

  /* Plain number or number(subsection) */
  if (/^\d[\w()\/]*$/.test(s)) return `Section ${s}`;

  return s;
};

const normalizeSections = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map(normalizeSection).filter(Boolean);
};

/* ── State normalizer ── */
const normalizeState = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;
  const key = raw.trim().toLowerCase();
  return STATE_MAP[key] || raw.trim();
};

/* ── Court normalizer ── */
const normalizeCourt = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;
  const key = raw.trim().toLowerCase();
  /* Try full match first */
  if (COURT_MAP[key]) return COURT_MAP[key];
  /* Partial match for "X High Court" */
  for (const [k, v] of Object.entries(COURT_MAP)) {
    if (key.includes(k)) return v;
  }
  return raw.trim();
};

/* ── Decision normalizer ── */
const normalizeDecision = (raw) => {
  if (!raw || typeof raw !== 'string') return raw;
  const key = raw.trim().toLowerCase();
  return DECISION_MAP[key] || raw.trim();
};

/* ── Normalize full structured_data & additional_fields objects ── */
const normalizeDocumentFields = (structured_data, additional_fields) => {
  const sd = { ...structured_data };
  const af = { ...additional_fields };

  /* structured_data */
  if (sd.date?.value)  sd.date  = { ...sd.date,  value: normalizeDate(sd.date.value)   };
  if (sd.court?.value) sd.court = { ...sd.court, value: normalizeCourt(sd.court.value)  };
  if (sd.state?.value) sd.state = { ...sd.state, value: normalizeState(sd.state.value)  };

  /* additional_fields */
  if (af.sections_involved?.value) {
    af.sections_involved = { ...af.sections_involved, value: normalizeSections(af.sections_involved.value) };
  }
  if (af.final_decision?.value) {
    af.final_decision = { ...af.final_decision, value: normalizeDecision(af.final_decision.value) };
  }

  return { structured_data: sd, additional_fields: af };
};

module.exports = {
  normalizeDate,
  normalizeSection,
  normalizeSections,
  normalizeState,
  normalizeCourt,
  normalizeDecision,
  normalizeDocumentFields,
  STATE_MAP,
  COURT_MAP,
  DECISION_MAP,
};
