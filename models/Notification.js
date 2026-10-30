const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      default: '',
    },
    senderName: {
      type: String,
      default: 'LoveKaro',
    },
    senderAvatar: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['message', 'like', 'match', 'payment', 'security', 'system', 'social_request', 'social_granted'],
      default: 'system',
    },
    requesterId: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Notification', notificationSchema);

