const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  upload,
  uploadAI,
  hybridSearch,
  getDocuments,
  getFilterOptions,
  updateDocument,
  toggleVerify,
  bulkVerify,
  fetchPresignedUrl,
  exportDocuments,
  getAuditLog,
} = require('../controllers/documentController');

const router = express.Router();

router.post('/upload-ai',          protect, upload.single('file'), uploadAI);
router.post('/search',             protect, hybridSearch);
router.get('/filter-options',      protect, getFilterOptions);
router.get('/export',              protect, exportDocuments);
router.get('/',                    protect, getDocuments);
router.patch('/bulk-verify',       protect, bulkVerify);          /* must be before /:id */
router.get('/:id/presigned-url',   protect, fetchPresignedUrl);
router.get('/:id/audit',           protect, getAuditLog);
router.put('/:id',                 protect, updateDocument);
router.patch('/:id/verify',        protect, toggleVerify);

module.exports = router;
