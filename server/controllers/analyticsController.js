const Document = require('../models/Document');
const { analyticsCache } = require('../utils/cache');

/* ── GET /api/analytics ── */
const getAnalytics = async (req, res) => {
  try {
    const CACHE_KEY = 'analytics-overview';
    const cached = analyticsCache.get(CACHE_KEY);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const [
      totalDocs,
      verifiedDocs,
      byDecision,
      byCourt,
      byState,
      bySection,
      byMonth,
      confidenceDist,
    ] = await Promise.all([
      Document.countDocuments({}),
      Document.countDocuments({ isVerified: true }),

      /* Cases by final decision */
      Document.aggregate([
        { $match: { 'additional_fields.final_decision.value': { $ne: '' } } },
        { $group: { _id: '$additional_fields.final_decision.value', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      /* Cases by court (top 10) */
      Document.aggregate([
        { $match: { 'structured_data.court.value': { $ne: '' } } },
        { $group: { _id: '$structured_data.court.value', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      /* Cases by state (top 15) */
      Document.aggregate([
        { $match: { 'structured_data.state.value': { $ne: '' } } },
        { $group: { _id: '$structured_data.state.value', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      /* Top sections involved */
      Document.aggregate([
        { $unwind: '$additional_fields.sections_involved.value' },
        { $match: { 'additional_fields.sections_involved.value': { $ne: '' } } },
        { $group: { _id: '$additional_fields.sections_involved.value', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      /* Uploads per month (last 12 months) */
      Document.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              year:  { $year:  '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),

      /* Confidence distribution */
      Document.aggregate([
        {
          $group: {
            _id: null,
            high:   { $sum: { $cond: [{ $eq: ['$structured_data.petitioner.confidence', 'HIGH']   }, 1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$structured_data.petitioner.confidence', 'MEDIUM'] }, 1, 0] } },
            low:    { $sum: { $cond: [{ $eq: ['$structured_data.petitioner.confidence', 'LOW']    }, 1, 0] } },
          },
        },
      ]),
    ]);

    const fmt = (arr) => arr.map(r => ({ label: r._id || 'Unknown', value: r.count }));
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const data = {
      summary: {
        total:    totalDocs,
        verified: verifiedDocs,
        unverified: totalDocs - verifiedDocs,
        verifiedPct: totalDocs ? Math.round((verifiedDocs / totalDocs) * 100) : 0,
      },
      byDecision: fmt(byDecision),
      byCourt:    fmt(byCourt),
      byState:    fmt(byState),
      bySection:  fmt(bySection),
      byMonth: byMonth.map(r => ({
        label: `${MONTH_NAMES[r._id.month - 1]} ${r._id.year}`,
        value: r.count,
      })),
      confidence: {
        high:   confidenceDist[0]?.high   || 0,
        medium: confidenceDist[0]?.medium || 0,
        low:    confidenceDist[0]?.low    || 0,
      },
    };

    analyticsCache.set(CACHE_KEY, data);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[AnalyticsController] getAnalytics error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
};

module.exports = { getAnalytics };
