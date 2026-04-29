const express = require('express');
const { upload, uploadFile, clearFileContext, getFileContext, chatWithFile } = require('../controllers/fileController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Wrap multer so its errors return JSON instead of crashing
router.post('/upload', protect, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum allowed size is 25 MB for chat uploads.'
        : err.message;
      return res.status(400).json({ success: false, message: msg });
    }
    next();
  });
}, uploadFile);

router.delete('/context', protect, clearFileContext);
router.get('/context', protect, getFileContext);
router.post('/chat', protect, chatWithFile);

module.exports = router;
