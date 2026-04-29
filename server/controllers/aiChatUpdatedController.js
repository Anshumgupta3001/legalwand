const { processAIChatQuery } = require('../services/aiChatUpdatedService');

/* POST /api/ai-chat */
const aiChatUpdated = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query?.trim()) {
      return res.status(400).json({ success: false, message: 'Query is required.' });
    }

    if (query.trim().length > 2000) {
      return res.status(400).json({ success: false, message: 'Query must be 2000 characters or fewer.' });
    }

    const { answer, results } = await processAIChatQuery(query.trim());

    return res.status(200).json({ success: true, answer, results });
  } catch (err) {
    console.error('[AIChatUpdated] error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to process your query. Please try again.' });
  }
};

module.exports = { aiChatUpdated };
