const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    partnerId: {
      type: String,
      required: true,
      index: true,
    },
    partnerName: {
      type: String,
      default: '',
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['sent', 'received', 'blocked'],
      default: 'sent',
    },
    isBlockedAttempt: {
      type: Boolean,
      default: false,
    },
    blockReason: {
      type: String,
      default: '',
    },
    time: {
      type: String,
      default: () =>
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Message', messageSchema);
