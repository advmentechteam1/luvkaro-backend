const adminService = require('../services/adminService');
const { sendSuccess } = require('../utils/responseHandler');

// @desc    Admin Login
// @route   POST /api/admin/login
const adminLogin = async (req, res, next) => {
  try {
    const result = await adminService.loginAdmin(req.body);
    return sendSuccess(res, result, 'Welcome to LoveKaro Admin Control Center!');
  } catch (error) {
    next(error);
  }
};

// @desc    Get full Admin Overview (All Users, Payments, Analytics, Messages, Reports, OTP Logs, Admin Profile, Settings, System Health)
// @route   GET /api/admin/overview
const getAdminOverview = async (req, res, next) => {
  try {
    const overviewData = await adminService.getOverview();
    return sendSuccess(res, overviewData, 'Admin overview fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get Admin Profile from Database
// @route   GET /api/admin/profile
const getAdminProfile = async (req, res, next) => {
  try {
    const profile = await adminService.getAdminProfile();
    return sendSuccess(res, profile, 'Admin profile fetched from database');
  } catch (error) {
    next(error);
  }
};

// @desc    Update Admin Profile in Database
// @route   PUT /api/admin/profile
const updateAdminProfile = async (req, res, next) => {
  try {
    const updated = await adminService.updateAdminProfile(req.body);
    return sendSuccess(res, updated, 'Admin profile saved to database successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Get Platform Settings from Database
// @route   GET /api/admin/settings
const getPlatformSettings = async (req, res, next) => {
  try {
    const settings = await adminService.getPlatformSettings();
    return sendSuccess(res, settings, 'Platform settings fetched from database');
  } catch (error) {
    next(error);
  }
};

// @desc    Update Platform Settings in Database
// @route   PUT /api/admin/settings
const updatePlatformSettings = async (req, res, next) => {
  try {
    const updated = await adminService.updatePlatformSettings(req.body);
    return sendSuccess(res, updated, 'Platform settings saved to database successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Get Live System Health & Admin Help Tickets from Database
// @route   GET /api/admin/help-health
const getHelpAndHealth = async (req, res, next) => {
  try {
    const data = await adminService.getHelpAndHealth();
    return sendSuccess(res, data, 'System health and help center data fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new Help Ticket / Operational Note in Database
// @route   POST /api/admin/help-tickets
const createHelpTicket = async (req, res, next) => {
  try {
    const tickets = await adminService.createHelpTicket(req.body);
    return sendSuccess(res, tickets, 'Help ticket saved to database!', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update Help Ticket Status (open / resolved) in Database
// @route   PATCH /api/admin/help-tickets/:ticketId
const updateHelpTicketStatus = async (req, res, next) => {
  try {
    const tickets = await adminService.updateHelpTicketStatus(
      req.params.ticketId,
      req.body.status
    );
    return sendSuccess(res, tickets, 'Help ticket status updated in database!');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Help Ticket from Database
// @route   DELETE /api/admin/help-tickets/:ticketId
const deleteHelpTicket = async (req, res, next) => {
  try {
    const tickets = await adminService.deleteHelpTicket(req.params.ticketId);
    return sendSuccess(res, tickets, 'Help ticket deleted from database!');
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user complete 360 detail
// @route   GET /api/admin/users/:id
const getAdminUserDetail = async (req, res, next) => {
  try {
    const detailData = await adminService.getUserDetail(req.params.id);
    return sendSuccess(res, detailData, 'User full details fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new user from Admin Panel
// @route   POST /api/admin/users
const createAdminUser = async (req, res, next) => {
  try {
    const userObj = await adminService.createUser(req.body);
    return sendSuccess(res, userObj, 'New user created successfully by Admin!', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update any user's full details from Admin Panel
// @route   PUT /api/admin/users/:id
const updateAdminUser = async (req, res, next) => {
  try {
    const updated = await adminService.updateUser(req.params.id, req.body);
    return sendSuccess(res, updated, 'User details updated successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user active/blocked status
// @route   PATCH /api/admin/users/:id/status
const toggleUserStatus = async (req, res, next) => {
  try {
    const updated = await adminService.toggleUserStatus(req.params.id, req.body.isActive);
    return sendSuccess(
      res,
      updated,
      updated.isActive ? `${updated.name} account activated` : `${updated.name} account blocked`
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user phone verification status
// @route   PATCH /api/admin/users/:id/verify
const toggleUserVerify = async (req, res, next) => {
  try {
    const updated = await adminService.toggleUserVerify(req.params.id, req.body.isPhoneVerified);
    return sendSuccess(
      res,
      updated,
      updated.isPhoneVerified
        ? `${updated.name} marked as Verified`
        : `${updated.name} verification removed`
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user Premium / Paid membership status
// @route   PATCH /api/admin/users/:id/premium
const toggleUserPremium = async (req, res, next) => {
  try {
    const updated = await adminService.toggleUserPremium(
      req.params.id,
      req.body.isPremium,
      req.body.premiumPlan
    );
    return sendSuccess(
      res,
      updated,
      updated.isPremium
        ? `💎 ${updated.name} upgraded to Premium (Unlimited Chat & Profile View Unlocked)`
        : `${updated.name} moved to Free plan`
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account and associated data
// @route   DELETE /api/admin/users/:id
const deleteAdminUser = async (req, res, next) => {
  try {
    const result = await adminService.deleteUser(req.params.id);
    return sendSuccess(res, result, `User ${result.name} deleted permanently`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a chat message from Admin Panel
// @route   DELETE /api/admin/messages/:id
const deleteAdminMessage = async (req, res, next) => {
  try {
    const result = await adminService.deleteMessage(req.params.id);
    return sendSuccess(res, result, 'Message deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminLogin,
  getAdminOverview,
  getAdminProfile,
  updateAdminProfile,
  getPlatformSettings,
  updatePlatformSettings,
  getHelpAndHealth,
  createHelpTicket,
  updateHelpTicketStatus,
  deleteHelpTicket,
  getAdminUserDetail,
  createAdminUser,
  updateAdminUser,
  toggleUserStatus,
  toggleUserVerify,
  toggleUserPremium,
  deleteAdminUser,
  deleteAdminMessage,
};
