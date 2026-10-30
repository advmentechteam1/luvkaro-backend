const mongoose = require('mongoose');

const helpTicketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Payment Issue', 'Account & OTP', 'Profile Verification', 'Bug / Technical', 'General Help'],
      default: 'General Help',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open',
    },
    description: {
      type: String,
      default: '',
    },
    contactInfo: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const platformSettingSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: 'lovekaro_master_config',
      unique: true,
    },
    adminProfile: {
      name: {
        type: String,
        default: 'Arvind Kumar (Admin)',
      },
      email: {
        type: String,
        default: 'admin@lovekaro.com',
      },
      phone: {
        type: String,
        default: '9811223344',
      },
      designation: {
        type: String,
        default: 'Founder & Super Admin',
      },
      department: {
        type: String,
        default: 'Platform Operations & Trust Safety',
      },
      city: {
        type: String,
        default: 'New Delhi, India',
      },
      bio: {
        type: String,
        default:
          'Managing LoveKaro platform operations, user safety, real-time chat moderation, and VIP matrimony & dating memberships.',
      },
      avatar: {
        type: String,
        default: '',
      },
      permissions: {
        type: [String],
        default: [
          'Full Database Read/Write',
          'VIP Payment & Revenue Ledger',
          '360° User Profile Moderation',
          'Real-Time Chat & Anti-Spam Filter',
          'Mobile App REST API v1 Control',
        ],
      },
      lastUpdatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    settings: {
      siteName: {
        type: String,
        default: 'LoveKaro',
      },
      tagline: {
        type: String,
        default: 'Meaningful Indian Dating & Matrimony',
      },
      supportEmail: {
        type: String,
        default: 'support@lovekaro.com',
      },
      supportPhone: {
        type: String,
        default: '+91 9811223344',
      },
      whatsappSupport: {
        type: String,
        default: '+91 9811223344',
      },
      freePromptsLimit: {
        type: Number,
        default: 5,
      },
      blockContactSharingInFreeChat: {
        type: Boolean,
        default: true,
      },
      requirePhoneOtpVerification: {
        type: Boolean,
        default: true,
      },
      autoApproveNewUsers: {
        type: Boolean,
        default: true,
      },
      maintenanceMode: {
        type: Boolean,
        default: false,
      },
      starterPlanPrice: {
        type: Number,
        default: 199,
      },
      goldPlanPrice: {
        type: Number,
        default: 499,
      },
      diamondPlanPrice: {
        type: Number,
        default: 999,
      },
    },
    helpTickets: {
      type: [helpTicketSchema],
      default: [
        {
          title: 'Verify Razorpay / UPI Webhook & Instant VIP Unlock Flow',
          category: 'Payment Issue',
          priority: 'High',
          status: 'resolved',
          description:
            'Ensure that when a user completes ₹199 / ₹499 / ₹999 payment, their isPremium flag and payments collection entry update immediately in MongoDB.',
          contactInfo: 'admin@lovekaro.com',
        },
        {
          title: 'Monitor 5-Prompt Free Chat Limit & Anti-Contact Sharing Filter',
          category: 'Profile Verification',
          priority: 'Medium',
          status: 'open',
          description:
            'Free users are restricted from sharing 10-digit mobile numbers or @instagram handles before unlocking VIP membership.',
          contactInfo: 'support@lovekaro.com',
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);

