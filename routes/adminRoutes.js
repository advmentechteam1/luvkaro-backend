const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/adminController');

// Admin Auth & Overview
router.post('/login', adminLogin);
router.get('/overview', getAdminOverview);

// Admin Own Profile (Database Backed)
router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);

// Platform Settings (Database Backed)
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSettings);

// System Health & Admin Help Center (Database Backed)
router.get('/help-health', getHelpAndHealth);
router.post('/help-tickets', createHelpTicket);
router.patch('/help-tickets/:ticketId', updateHelpTicketStatus);
router.delete('/help-tickets/:ticketId', deleteHelpTicket);

// Full CRUD & Management on Users
router.get('/users/:id', getAdminUserDetail);
router.post('/users', createAdminUser);
router.put('/users/:id', updateAdminUser);
router.patch('/users/:id/status', toggleUserStatus);
router.patch('/users/:id/verify', toggleUserVerify);
router.patch('/users/:id/premium', toggleUserPremium);
router.delete('/users/:id', deleteAdminUser);

// Message Moderation
router.delete('/messages/:id', deleteAdminMessage);

module.exports = router;
