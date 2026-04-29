const express = require('express');
const {
  sendMessage,
  createChat,
  getChats,
  getChatById,
  addMessageToChat,
  deleteChatById,
  getRelatedFiles,
  regenerateMessage,
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Existing route — untouched
router.post('/message', protect, sendMessage);

// Chat history CRUD
router.post('/', protect, createChat);
router.get('/', protect, getChats);
router.get('/:id', protect, getChatById);
router.post('/:id/message', protect, addMessageToChat);
router.post('/:id/regenerate', protect, regenerateMessage);
router.delete('/:id', protect, deleteChatById);

// Related files — must come before /:id to avoid route collision
router.post('/related-files', protect, getRelatedFiles);

module.exports = router;
