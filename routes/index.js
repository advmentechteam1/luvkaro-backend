const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');
const { connectDB, getConnectionError } = require('../config/db');

// API Health Check & Database Status
router.get('/health', (req, res) => {
  const connectionStates = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];
  const stateCode = mongoose.connection.readyState;
  const stateName = connectionStates[stateCode] || 'Unknown';

  res.status(200).json({
    success: true,
    status: 'ok',
    apiVersion: 'v1',
    database: {
      status: stateName,
      connected: stateCode === 1,
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
      error: getConnectionError(),
    },
    timestamp: new Date().toISOString(),
  });
});

// Retry DB Connection endpoint
router.get('/health/reconnect', async (req, res) => {
  try {
    await connectDB();
    const isConnected = mongoose.connection.readyState === 1;
    res.status(200).json({
      success: isConnected,
      message: isConnected
        ? 'Database connected successfully!'
        : 'Connection attempted, check error details',
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
      error: getConnectionError(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Structured Mobile App & Web API Reference (/api/docs and /api/v1/docs)
router.get('/docs', (req, res) => {
  res.status(200).json({
    success: true,
    platform: 'LoveKaro API (Web & Mobile App Ready)',
    apiVersion: 'v1',
    baseUrls: ['/api', '/api/v1'],
    authentication: 'Bearer JWT Token in Authorization header (Authorization: Bearer <token>)',
    collections: ['users', 'otps', 'messages', 'payments', 'notifications'],
    endpoints: {
      auth: {
        sendOtp: { method: 'POST', path: '/auth/send-otp', body: ['phone'], access: 'Public' },
        verifyOtp: { method: 'POST', path: '/auth/verify-otp', body: ['phone', 'otp'], access: 'Public' },
        signup: {
          method: 'POST',
          path: '/auth/signup',
          body: ['name', 'email', 'phone', 'password', 'gender', 'dob', 'city', 'religion', 'motherTongue'],
          access: 'Public',
        },
        login: { method: 'POST', path: '/auth/login', body: ['emailOrPhone', 'password'], access: 'Public' },
        me: { method: 'GET', path: '/auth/me', access: 'Bearer Token' },
      },
      users: {
        publicProfiles: { method: 'GET', path: '/users/public', query: ['gender', 'city'], access: 'Public' },
        discoverProfiles: { method: 'GET', path: '/users', query: ['gender'], access: 'Bearer Token' },
        dashboard: { method: 'GET', path: '/users/dashboard', access: 'Bearer Token' },
        updateProfile: { method: 'PUT', path: '/users/profile', access: 'Bearer Token' },
        updateSettings: { method: 'PUT', path: '/users/settings', access: 'Bearer Token' },
        updatePassword: { method: 'PUT', path: '/users/password', access: 'Bearer Token' },
        likeProfile: { method: 'POST', path: '/users/:id/like', access: 'Bearer Token' },
      },
      chatAndMessages: {
        listMessages: { method: 'GET', path: '/users/messages', access: 'Bearer Token' },
        sendMessage: {
          method: 'POST',
          path: '/users/messages',
          body: ['partnerId', 'partnerName', 'text'],
          rules: 'Max 5 free prompts for non-VIP; blocks phone numbers & social handles (@id, insta)',
          access: 'Bearer Token',
        },
      },
      payments: {
        listUserPayments: { method: 'GET', path: '/users/payments', access: 'Bearer Token' },
        createPayment: {
          method: 'POST',
          path: '/users/payments',
          body: ['planId', 'planName', 'amount', 'paymentMethod', 'paymentReference', 'unlockedPartnerId'],
          access: 'Bearer Token',
        },
      },
      notifications: {
        listNotifications: { method: 'GET', path: '/users/notifications', access: 'Bearer Token' },
        markAllRead: { method: 'PUT', path: '/users/notifications/read', access: 'Bearer Token' },
      },
      admin: {
        login: { method: 'POST', path: '/admin/login', body: ['email', 'password'], access: 'Public' },
        overview: { method: 'GET', path: '/admin/overview', access: 'Admin / Dashboard' },
        listUsers: { method: 'GET', path: '/admin/users', access: 'Admin' },
        createUser: { method: 'POST', path: '/admin/users', access: 'Admin' },
        userDetail: { method: 'GET', path: '/admin/users/:id', access: 'Admin' },
        updateUser: { method: 'PUT', path: '/admin/users/:id', access: 'Admin' },
        toggleStatus: { method: 'PATCH', path: '/admin/users/:id/status', access: 'Admin' },
        togglePremium: { method: 'PATCH', path: '/admin/users/:id/premium', access: 'Admin' },
        deleteUser: { method: 'DELETE', path: '/admin/users/:id', access: 'Admin' },
        listPayments: { method: 'GET', path: '/admin/payments', access: 'Admin' },
        deleteMessage: { method: 'DELETE', path: '/admin/messages/:id', access: 'Admin' },
      },
      realtimeSocketEvents: {
        clientEmits: ['register_user', 'join_admin', 'join_chat', 'typing', 'stop_typing'],
        serverEmits: [
          'online_users',
          'receive_message',
          'new_notification',
          'payment_unlocked',
          'user_typing',
          'user_stop_typing',
          'admin_live_update',
        ],
      },
    },
  });
});

// Mount modular sub-routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
