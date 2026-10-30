const express = require('express');
const router = express.Router();
const {
  sendOtp,
  verifyOtp,
  register,
  login,
  loginWithOtp,
  getMe,
  uploadPhoto,
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// OTP Endpoints
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Registration / Signup Endpoints
router.post('/register', register);
router.post('/signup', register); // Alias for mobile app flexibility

// Authentication / Login Endpoints
router.post('/login', login);
router.post('/login-otp', loginWithOtp);

// Photo Upload Endpoint
router.post('/upload-photo', upload.single('photo'), uploadPhoto);

// Authenticated User Profile
router.get('/me', protect, getMe);

module.exports = router;
