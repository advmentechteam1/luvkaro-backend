const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

// @desc    Send 6-digit OTP to mobile number
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const result = await authService.sendOtp(phone);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP for mobile number
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    const result = await authService.verifyOtp(phone, otp);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

// @desc    Complete multi-step registration
// @route   POST /api/auth/register (or /signup)
// @access  Public
const register = async (req, res, next) => {
  try {
    const userData = await authService.registerUser(req.body);
    return sendSuccess(res, userData, 'Account created successfully! Welcome to LoveKaro.', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate with email/phone & password
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const id = identifier || email || phone;
    const userData = await authService.loginUser({ identifier: id, password });
    return sendSuccess(res, userData, 'Welcome back to LoveKaro!');
  } catch (error) {
    next(error);
  }
};

// @desc    Login directly with mobile OTP
// @route   POST /api/auth/login-otp
// @access  Public
const loginWithOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    const userData = await authService.loginWithOtp({ phone, otp });
    return sendSuccess(res, userData, 'Login successful via OTP!');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    return sendSuccess(res, user, 'Profile fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile photo (base64 or file upload)
// @route   POST /api/auth/upload-photo
// @access  Public / Private
const uploadPhoto = async (req, res, next) => {
  try {
    // If multipart file uploaded via multer
    if (req.file) {
      const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      return sendSuccess(res, { url: base64Data }, 'Photo uploaded successfully');
    }
    // If client sent image url or base64 directly
    if (req.body.photo) {
      return sendSuccess(res, { url: req.body.photo }, 'Photo received successfully');
    }
    return sendError(res, 'No photo provided', 400);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  register,
  login,
  loginWithOtp,
  getMe,
  uploadPhoto,
};
