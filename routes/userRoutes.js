const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

// Public endpoint (No auth required) — returns real registered profiles from MongoDB
router.get('/public', getPublicProfiles);

// Protected endpoints (Require Bearer JWT token)
router.use(protect);

router.get('/', getProfiles);
router.get('/profiles', getProfiles);
router.get('/dashboard', getDashboard);
router.put('/profile', updateProfile);
router.put('/settings', updateSettings);
router.put('/password', updatePassword);
router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.get('/payments', getPayments);
router.post('/payments', createPayment);
router.get('/notifications', getNotifications);
router.put('/notifications/read', markNotificationsRead);
router.post('/:id/like', likeProfile);
router.post('/:id/social-access/request', requestSocialAccess);
router.post('/social-access/:requesterId/respond', respondSocialAccess);

module.exports = router;
