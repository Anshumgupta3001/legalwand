const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { aiChatUpdated } = require('../controllers/aiChatUpdatedController');

/* POST /api/ai-chat */
router.post('/', protect, aiChatUpdated);

module.exports = router;
