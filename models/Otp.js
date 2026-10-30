const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically delete document after expiry
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Otp', otpSchema);
