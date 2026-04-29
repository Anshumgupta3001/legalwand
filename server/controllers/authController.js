const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'gstwand_secret';
const JWT_EXPIRES_IN = '30d';

const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const sanitizeUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  mobile: user.mobile || null,
  gstin: user.gstin || null,
  companyName: user.companyName || null,
  businessType: user.businessType || null,
  credits: user.credits || 0,
  pro_user: user.pro_user || false,
  isVerified: user.isVerified || false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide first name, last name, email, and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered. Please sign in instead.',
      });
    }

    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password,
    });

    return res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to create user. Please try again later.',
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    return res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again later.',
    });
  }
};

const getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized.',
    });
  }

  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email is registered, a verification code has been generated.',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save({ validateBeforeSave: false });

    const response = {
      success: true,
      message: 'Verification code generated. Use it to reset your password.',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.otp = otp;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process password reset. Please try again later.',
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, code, and new password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpiry +password');

    if (!user || !user.otp || !user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'No valid reset request found for this email.',
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'The verification code is incorrect.',
      });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'The verification code has expired.',
      });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    console.error('OTP verify error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to verify code. Please try again later.',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  verifyOtp,
};
