const express = require('express');
const { getAdminOverview } = require('../controllers/adminController');
const { upload, requireAdminKey, adminUpload, adminUploadUrl } = require('../controllers/adminUploadController');

const router = express.Router();

router.get('/overview', getAdminOverview);

// POST /api/admin/upload — admin-key protected, file extraction + Pinecone storage
router.post(
  '/upload',
  requireAdminKey,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  adminUpload
);

// POST /api/admin/upload-url — admin-key protected, fetch PDF from URL + Pinecone storage
router.post('/upload-url', requireAdminKey, adminUploadUrl);

module.exports = router;
