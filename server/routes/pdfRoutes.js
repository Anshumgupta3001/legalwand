const express = require('express');
const { exportChatPdf } = require('../controllers/pdfController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/export', protect, exportChatPdf);

module.exports = router;
