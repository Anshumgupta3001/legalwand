const express = require('express');
const { getNews, summarizeArticle } = require('../controllers/newsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getNews);
router.post('/summarize', protect, summarizeArticle);

module.exports = router;
