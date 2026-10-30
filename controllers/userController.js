const userService = require('../services/userService');
const { sendSuccess } = require('../utils/responseHandler');

// @desc    Get public profiles from database (For Web & Mobile App Discovery)
// @route   GET /api/users/public
// @access  Public
const getPublicProfiles = async (req, res, next) => {
  try {
    const filters = {
      gender: req.query.gender,
      viewerGender: req.query.viewerGender,
      city: req.query.city,
    };
    const profiles = await userService.getPublicProfiles(filters);
    return sendSuccess(res, profiles, 'Public profiles retrieved from database');
  } catch (error) {
    next(error);
  }
};

// @desc    Get discoverable profiles
// @route   GET /api/users
// @access  Private
const getProfiles = async (req, res, next) => {
  try {
    const filters = {
      gender: req.query.gender,
    };
    const profiles = await userService.getProfiles(req.user.id, filters);
    return sendSuccess(res, profiles, 'Profiles retrieved');
  } catch (error) {
    next(error);
  }
};

// @desc    Get full user dashboard data (profile, stats, matches, messages, payments, notifications)
// @route   GET /api/users/dashboard
// @access  Private
const getDashboard = async (req, res, next) => {
  try {
    const dashboardData = await userService.getDashboardData(req.user.id);
    return sendSuccess(res, dashboardData, 'Dashboard retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, updated, 'Profile updated successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Update user privacy/notification settings & partner preferences
// @route   PUT /api/users/settings
// @access  Private
const updateSettings = async (req, res, next) => {
  try {
    const updated = await userService.updateSettings(req.user.id, req.body);
    return sendSuccess(res, updated, 'Settings saved successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Change user password
// @route   PUT /api/users/password
// @access  Private
const updatePassword = async (req, res, next) => {
  try {
    const result = await userService.updatePassword(req.user.id, req.body);
    return sendSuccess(res, result, 'Password updated successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Get user chat messages
// @route   GET /api/users/messages
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const messages = await userService.getMessages(req.user.id);
    return sendSuccess(res, messages, 'Messages fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Send a chat message (enforces 5-prompt limit & contact sharing filter)
// @route   POST /api/users/messages
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const result = await userService.sendMessage(req.user.id, req.body);
    return sendSuccess(res, result, 'Message sent', 201);
  } catch (error) {
    if (error.requiresPayment) {
      return res.status(error.statusCode || 402).json({
        success: false,
        requiresPayment: true,
        violationReason: error.violationReason || null,
        message: error.message,
      });
    }
    next(error);
  }
};

// @desc    Process user payment & unlock Premium Chat + Full Profile check
// @route   POST /api/users/payments
// @access  Private
const createPayment = async (req, res, next) => {
  try {
    const result = await userService.processPayment(req.user.id, req.body);
    return sendSuccess(
      res,
      result,
      '🎉 Payment Successful! Unlimited Chat & Full Profile Access Unlocked!',
      201
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's payment history
// @route   GET /api/users/payments
// @access  Private
const getPayments = async (req, res, next) => {
  try {
    const payments = await userService.getUserPayments(req.user.id);
    return sendSuccess(res, payments, 'Payments fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's notifications
// @route   GET /api/users/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await userService.getNotifications(req.user.id);
    return sendSuccess(res, notifications, 'Notifications fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/users/notifications/read
// @access  Private
const markNotificationsRead = async (req, res, next) => {
  try {
    const notifications = await userService.markNotificationsRead(req.user.id);
    return sendSuccess(res, notifications, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc    Like or unlike a user profile
// @route   POST /api/users/:id/like
// @access  Private
const likeProfile = async (req, res, next) => {
  try {
    const result = await userService.likeProfile(req.user.id, req.params.id);
    return sendSuccess(res, result, result.isMatch ? "It's a Match! 💖" : 'Profile preference updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Request permission to view target user's social media links
// @route   POST /api/users/:id/social-access/request
// @access  Private
const requestSocialAccess = async (req, res, next) => {
  try {
    const result = await userService.requestSocialAccess(req.user.id, req.params.id);
    return sendSuccess(res, result, result.message || 'Social media access requested successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Respond to a social access request (allow / decline)
// @route   POST /api/users/social-access/:requesterId/respond
// @access  Private
const respondSocialAccess = async (req, res, next) => {
  try {
    const { action } = req.body;
    const result = await userService.respondSocialAccess(req.user.id, req.params.requesterId, action);
    return sendSuccess(res, result, result.message || 'Response recorded');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicProfiles,
  getProfiles,
  getDashboard,
  updateProfile,
  updateSettings,
  updatePassword,
  getMessages,
  sendMessage,
  createPayment,
  getPayments,
  getNotifications,
  markNotificationsRead,
  likeProfile,
  requestSocialAccess,
  respondSocialAccess,
};
