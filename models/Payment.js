const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
    },
    userPhone: {
      type: String,
      default: '',
      trim: true,
    },
    userAvatar: {
      type: String,
      default: '',
    },
    planId: {
      type: String,
      default: 'gold',
    },
    planName: {
      type: String,
      required: true,
      default: 'Gold Unlimited Chat & Profile Unlock',
    },
    amount: {
      type: Number,
      required: true,
      default: 499,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Card', 'NetBanking', 'Wallet'],
      default: 'UPI',
    },
    paymentReference: {
      type: String,
      default: '',
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    unlockedPartnerId: {
      type: String,
      default: '',
    },
    unlockedPartnerName: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['success', 'pending', 'failed'],
      default: 'success',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payment', paymentSchema);

