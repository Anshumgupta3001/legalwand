const express = require('express');
const {
  register,
  login,
  getMe,
  forgotPassword,
  verifyOtp,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.get('/me', protect, getMe);

module.exports = router;
