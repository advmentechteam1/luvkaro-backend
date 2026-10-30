const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Otp = require('../models/Otp');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const PlatformSetting = require('../models/PlatformSetting');
const generateToken = require('../utils/generateToken');
const { emitToUser } = require('../socket/socketManager');

const cleanAvatar = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('images.unsplash.com')) return '';
  return url;
};

const sanitizeUserRecord = (u) => {
  const obj = u && typeof u.toObject === 'function' ? u.toObject() : { ...u };
  obj.avatar = cleanAvatar(obj.avatar);
  obj.photos = (obj.photos || []).map(cleanAvatar).filter(Boolean);
  return obj;
};

class AdminService {
  async getOrCreatePlatformConfig() {
    let configDoc = await PlatformSetting.findOne({ singletonKey: 'lovekaro_master_config' });
    if (!configDoc) {
      const adminUser = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
      const firstUser = adminUser || (await User.findOne({}).sort({ createdAt: 1 }));

      configDoc = await PlatformSetting.create({
        singletonKey: 'lovekaro_master_config',
        adminProfile: {
          name: firstUser?.name || 'Admin',
          email: firstUser?.email || process.env.ADMIN_EMAIL || 'admin@lovekaro.com',
          phone: firstUser?.phone || '9811223344',
          designation: 'Founder & Super Admin',
          department: 'Platform Operations & Trust Safety',
          city: firstUser?.location?.city
            ? `${firstUser.location.city}, India`
            : 'New Delhi, India',
          bio:
            firstUser?.bio ||
            'Managing LoveKaro platform operations, user safety, real-time chat moderation, and VIP matrimony & dating memberships.',
          avatar: cleanAvatar(firstUser?.avatar),
          lastUpdatedAt: new Date(),
        },
      });
    } else if (configDoc.adminProfile) {
      configDoc.adminProfile.avatar = cleanAvatar(configDoc.adminProfile.avatar);
    }
    return configDoc;
  }

  async buildSystemHealth(counts = {}) {
    const dbStateMap = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting',
    };
    const readyState = mongoose.connection.readyState;
    const mem = process.memoryUsage();

    const usersCount = counts.users ?? (await User.countDocuments());
    const paymentsCount = counts.payments ?? (await Payment.countDocuments());
    const messagesCount = counts.messages ?? (await Message.countDocuments());
    const otpsCount = counts.otps ?? (await Otp.countDocuments());
    const notificationsCount = counts.notifications ?? (await Notification.countDocuments());

    return {
      status: readyState === 1 ? 'Healthy' : 'Degraded',
      databaseStatus: dbStateMap[readyState] || 'Unknown',
      databaseName: mongoose.connection.name || 'lovekaro',
      databaseHost: mongoose.connection.host || 'localhost',
      socketServer: 'Active (Socket.IO Real-Time)',
      apiVersion: 'v1 (Mobile & Web Ready)',
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      collections: {
        users: usersCount,
        payments: paymentsCount,
        messages: messagesCount,
        otps: otpsCount,
        notifications: notificationsCount,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  async loginAdmin({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const masterEmail = (process.env.ADMIN_EMAIL || 'admin@lovekaro.com').toLowerCase();
    const masterPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const configDoc = await this.getOrCreatePlatformConfig();

    if (cleanEmail === masterEmail && password === masterPassword) {
      const token = generateToken('master_admin_id');
      return {
        _id: 'master_admin_id',
        name: configDoc.adminProfile?.name || 'Super Admin',
        email: configDoc.adminProfile?.email || masterEmail,
        phone: configDoc.adminProfile?.phone || '',
        role: 'admin',
        avatar: cleanAvatar(configDoc.adminProfile?.avatar),
        token,
      };
    }

    const user = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: cleanEmail.replace(/[^0-9+]/g, '') }],
    });

    if (user && (await user.matchPassword(password || ''))) {
      user.role = 'admin';
      await user.save();
      const token = generateToken(user._id);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: cleanAvatar(user.avatar),
        role: 'admin',
        token,
      };
    }

    const error = new Error('Invalid Admin credentials. Default: admin@lovekaro.com / admin123');
    error.statusCode = 401;
    throw error;
  }

  async getOverview() {
    const configDoc = await this.getOrCreatePlatformConfig();

    // Purge any legacy seed dummy users so Admin Panel only displays 100% real signed-up users
    await User.deleteMany({
      email: {
        $in: [
          'priya.sharma@lovekaro.com',
          'sneha.patel@lovekaro.com',
          'ananya.verma@lovekaro.com',
          'kavya.nair@lovekaro.com',
          'riya.malhotra@lovekaro.com',
          'meera.joshi@lovekaro.com',
          'rohit.verma@lovekaro.com',
          'aman.singh@lovekaro.com',
          'vikram.rathore@lovekaro.com',
          'siddharth.mehta@lovekaro.com',
          'arjun.kapoor@lovekaro.com',
          'karan.oberoi@lovekaro.com',
          'kabir.khan@lovekaro.com',
          'vikram.aditya@lovekaro.com',
          'siddharth.malhotra@lovekaro.com',
          'riya.kapoor@lovekaro.com',
        ],
      },
    });

    const rawUsers = await User.find({}).select('-password').sort({ createdAt: -1 });
    const users = rawUsers.map(sanitizeUserRecord);

    const payments = await Payment.find({})
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone avatar isPremium premiumPlan');
    const messages = await Message.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('userId', 'name email phone avatar');
    const otps = await Otp.find({}).sort({ createdAt: -1 }).limit(100);
    const notificationsCount = await Notification.countDocuments();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.isActive !== false).length;
    const blockedUsers = users.filter((u) => u.isActive === false).length;
    const verifiedUsers = users.filter((u) => u.isPhoneVerified).length;
    const premiumUsers = users.filter((u) => u.isPremium).length;
    const maleUsers = users.filter((u) => u.gender === 'male').length;
    const femaleUsers = users.filter((u) => u.gender === 'female').length;
    const otherUsers = users.filter((u) => u.gender && !['male', 'female'].includes(u.gender)).length;
    const newUsersToday = users.filter((u) => new Date(u.createdAt) >= startOfToday).length;
    const newUsersThisWeek = users.filter((u) => new Date(u.createdAt) >= sevenDaysAgo).length;

    const totalRevenue = payments
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const blockedMessages = messages.filter((m) => m.isBlockedAttempt || m.type === 'blocked');

    const cityMap = {};
    const religionMap = {};
    users.forEach((u) => {
      const city = u.location?.city || 'Not Specified';
      const rel = u.religion || 'Not Specified';
      cityMap[city] = (cityMap[city] || 0) + 1;
      religionMap[rel] = (religionMap[rel] || 0) + 1;
    });

    // Build 100% Real 7-Day Daily Series directly from MongoDB timestamps
    const chartSeries = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const label = dayStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

      const dayUsers = users.filter((u) => {
        const d = new Date(u.createdAt);
        return d >= dayStart && d < dayEnd;
      }).length;

      const dayPayments = payments.filter((p) => {
        const d = new Date(p.createdAt);
        return d >= dayStart && d < dayEnd;
      }).length;

      const dayMessages = messages.filter((m) => {
        const d = new Date(m.createdAt);
        return d >= dayStart && d < dayEnd;
      }).length;

      chartSeries.push({
        label,
        date: dayStart.toISOString().split('T')[0],
        users: dayUsers,
        payments: dayPayments,
        messages: dayMessages,
      });
    }

    const adminUser = users.find((u) => u.role === 'admin') || users[0] || null;
    const savedAdmin = configDoc.adminProfile || {};

    const mergedAdminProfile = {
      _id: adminUser?._id || 'master_admin_id',
      name: savedAdmin.name || adminUser?.name || 'Admin',
      email: savedAdmin.email || adminUser?.email || process.env.ADMIN_EMAIL || 'admin@lovekaro.com',
      phone: savedAdmin.phone || adminUser?.phone || '9811223344',
      designation: savedAdmin.designation || 'Founder & Super Admin',
      department: savedAdmin.department || 'Platform Operations & Trust Safety',
      city:
        savedAdmin.city ||
        (adminUser?.location?.city ? `${adminUser.location.city}, India` : 'New Delhi, India'),
      bio:
        savedAdmin.bio ||
        adminUser?.bio ||
        'Managing LoveKaro platform operations, user safety, real-time chat moderation, and VIP matrimony & dating memberships.',
      avatar: cleanAvatar(savedAdmin.avatar || adminUser?.avatar),
      role: 'Super Admin',
      permissions:
        Array.isArray(savedAdmin.permissions) && savedAdmin.permissions.length > 0
          ? savedAdmin.permissions
          : [
              'Full Database Read/Write',
              'VIP Payment & Revenue Ledger',
              '360° User Profile Moderation',
              'Real-Time Chat & Anti-Spam Filter',
              'Mobile App REST API v1 Control',
            ],
      lastUpdatedAt: savedAdmin.lastUpdatedAt || configDoc.updatedAt,
    };

    const systemHealth = await this.buildSystemHealth({
      users: totalUsers,
      payments: payments.length,
      messages: messages.length,
      otps: otps.length,
      notifications: notificationsCount,
    });

    return {
      adminProfile: mergedAdminProfile,
      platformSettings: configDoc.settings,
      helpTickets: configDoc.helpTickets || [],
      systemHealth,
      stats: {
        totalUsers,
        activeUsers,
        blockedUsers,
        verifiedUsers,
        premiumUsers,
        maleUsers,
        femaleUsers,
        otherUsers,
        newUsersToday,
        newUsersThisWeek,
        totalPayments: payments.length,
        totalRevenue,
        totalMessages: messages.length,
        blockedAttemptsCount: blockedMessages.length,
        totalOtps: otps.length,
        cityBreakdown: cityMap,
        religionBreakdown: religionMap,
        chartSeries,
      },
      users,
      payments,
      messages,
      blockedMessages,
      otps,
    };
  }

  async getAdminProfile() {
    const overview = await this.getOverview();
    return overview.adminProfile;
  }

  async updateAdminProfile(payload = {}) {
    const configDoc = await this.getOrCreatePlatformConfig();

    const nextName =
      payload.name !== undefined ? String(payload.name).trim() : configDoc.adminProfile.name;
    const nextEmail =
      payload.email !== undefined
        ? String(payload.email).trim().toLowerCase()
        : configDoc.adminProfile.email;
    const nextPhone =
      payload.phone !== undefined ? String(payload.phone).trim() : configDoc.adminProfile.phone;
    const nextDesignation =
      payload.designation !== undefined
        ? String(payload.designation).trim()
        : configDoc.adminProfile.designation;
    const nextDepartment =
      payload.department !== undefined
        ? String(payload.department).trim()
        : configDoc.adminProfile.department;
    const nextCity =
      payload.city !== undefined ? String(payload.city).trim() : configDoc.adminProfile.city;
    const nextBio =
      payload.bio !== undefined ? String(payload.bio).trim() : configDoc.adminProfile.bio;
    const nextAvatar =
      payload.avatar !== undefined
        ? cleanAvatar(payload.avatar)
        : cleanAvatar(configDoc.adminProfile.avatar);

    configDoc.adminProfile = {
      ...configDoc.adminProfile.toObject(),
      name: nextName || 'Admin',
      email: nextEmail || 'admin@lovekaro.com',
      phone: nextPhone || '',
      designation: nextDesignation || 'Super Admin',
      department: nextDepartment || 'Platform Operations',
      city: nextCity || 'New Delhi, India',
      bio: nextBio || '',
      avatar: nextAvatar,
      lastUpdatedAt: new Date(),
    };

    await configDoc.save();

    // Also sync with primary admin user in User collection if present
    const adminUser =
      (await User.findOne({ role: 'admin' })) || (await User.findOne({}).sort({ createdAt: 1 }));
    if (adminUser) {
      if (nextName) adminUser.name = nextName;
      if (nextAvatar !== undefined) adminUser.avatar = nextAvatar;
      if (nextBio !== undefined) adminUser.bio = nextBio;
      if (nextCity) {
        adminUser.location = {
          ...(adminUser.location || {}),
          city: nextCity.split(',')[0].trim(),
          country: 'India',
        };
      }
      if (payload.newPassword && String(payload.newPassword).trim().length >= 6) {
        adminUser.password = String(payload.newPassword).trim();
      }
      await adminUser.save();
    }

    return configDoc.adminProfile;
  }

  async getPlatformSettings() {
    const configDoc = await this.getOrCreatePlatformConfig();
    return configDoc.settings;
  }

  async updatePlatformSettings(payload = {}) {
    const configDoc = await this.getOrCreatePlatformConfig();
    const current = configDoc.settings ? configDoc.settings.toObject() : {};

    configDoc.settings = {
      ...current,
      siteName:
        payload.siteName !== undefined ? String(payload.siteName).trim() : current.siteName,
      tagline: payload.tagline !== undefined ? String(payload.tagline).trim() : current.tagline,
      supportEmail:
        payload.supportEmail !== undefined
          ? String(payload.supportEmail).trim()
          : current.supportEmail,
      supportPhone:
        payload.supportPhone !== undefined
          ? String(payload.supportPhone).trim()
          : current.supportPhone,
      whatsappSupport:
        payload.whatsappSupport !== undefined
          ? String(payload.whatsappSupport).trim()
          : current.whatsappSupport,
      freePromptsLimit:
        payload.freePromptsLimit !== undefined
          ? Math.max(1, Number(payload.freePromptsLimit) || 5)
          : current.freePromptsLimit,
      blockContactSharingInFreeChat:
        payload.blockContactSharingInFreeChat !== undefined
          ? Boolean(payload.blockContactSharingInFreeChat)
          : current.blockContactSharingInFreeChat,
      requirePhoneOtpVerification:
        payload.requirePhoneOtpVerification !== undefined
          ? Boolean(payload.requirePhoneOtpVerification)
          : current.requirePhoneOtpVerification,
      autoApproveNewUsers:
        payload.autoApproveNewUsers !== undefined
          ? Boolean(payload.autoApproveNewUsers)
          : current.autoApproveNewUsers,
      maintenanceMode:
        payload.maintenanceMode !== undefined
          ? Boolean(payload.maintenanceMode)
          : current.maintenanceMode,
      starterPlanPrice:
        payload.starterPlanPrice !== undefined
          ? Math.max(1, Number(payload.starterPlanPrice) || 199)
          : current.starterPlanPrice,
      goldPlanPrice:
        payload.goldPlanPrice !== undefined
          ? Math.max(1, Number(payload.goldPlanPrice) || 499)
          : current.goldPlanPrice,
      diamondPlanPrice:
        payload.diamondPlanPrice !== undefined
          ? Math.max(1, Number(payload.diamondPlanPrice) || 999)
          : current.diamondPlanPrice,
    };

    await configDoc.save();
    return configDoc.settings;
  }

  async getHelpAndHealth() {
    const configDoc = await this.getOrCreatePlatformConfig();
    const systemHealth = await this.buildSystemHealth();
    return {
      systemHealth,
      helpTickets: configDoc.helpTickets || [],
      supportContact: {
        supportEmail: configDoc.settings?.supportEmail || 'support@lovekaro.com',
        supportPhone: configDoc.settings?.supportPhone || '+91 9811223344',
        whatsappSupport: configDoc.settings?.whatsappSupport || '+91 9811223344',
      },
    };
  }

  async createHelpTicket(payload = {}) {
    if (!payload.title || !String(payload.title).trim()) {
      const error = new Error('Ticket / Note title is required');
      error.statusCode = 400;
      throw error;
    }

    const configDoc = await this.getOrCreatePlatformConfig();
    configDoc.helpTickets.unshift({
      title: String(payload.title).trim(),
      category: payload.category || 'General Help',
      priority: payload.priority || 'Medium',
      status: 'open',
      description: payload.description ? String(payload.description).trim() : '',
      contactInfo: payload.contactInfo ? String(payload.contactInfo).trim() : '',
    });

    await configDoc.save();
    return configDoc.helpTickets;
  }

  async updateHelpTicketStatus(ticketId, status) {
    const configDoc = await this.getOrCreatePlatformConfig();
    const ticket = configDoc.helpTickets.id(ticketId);
    if (!ticket) {
      const error = new Error('Help ticket not found');
      error.statusCode = 404;
      throw error;
    }
    ticket.status = status === 'resolved' ? 'resolved' : 'open';
    await configDoc.save();
    return configDoc.helpTickets;
  }

  async deleteHelpTicket(ticketId) {
    const configDoc = await this.getOrCreatePlatformConfig();
    configDoc.helpTickets = configDoc.helpTickets.filter(
      (t) => t._id.toString() !== ticketId.toString()
    );
    await configDoc.save();
    return configDoc.helpTickets;
  }

  async getUserDetail(userId) {
    const rawUser = await User.findById(userId).select('-password');
    if (!rawUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    const user = sanitizeUserRecord(rawUser);

    const userMessages = await Message.find({ userId: user._id }).sort({ createdAt: -1 });
    const userPayments = await Payment.find({ userId: user._id }).sort({ createdAt: -1 });
    const otpHistory = await Otp.find({ phone: user.phone }).sort({ createdAt: -1 });

    return {
      user,
      messages: userMessages,
      payments: userPayments,
      otpHistory,
    };
  }

  async createUser(payload) {
    const {
      name,
      email,
      phone,
      password = 'password123',
      age = 24,
      gender = 'female',
      interestedIn = 'everyone',
      maritalStatus = 'Never Married',
      religion = 'Hindu',
      motherTongue = 'Hindi',
      occupation = '',
      education = '',
      city = 'Delhi',
      state = '',
      bio = '',
      avatar,
      interests = [],
      role = 'user',
      isPremium = false,
    } = payload;

    if (!name || !email || !phone) {
      const error = new Error('Name, email, and phone are required');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = phone.toString().trim().replace(/[^0-9+]/g, '');
    const cleanEmail = email.toString().trim().toLowerCase();

    const exists = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: cleanPhone }],
    });
    if (exists) {
      const error = new Error('A user with this email or phone already exists');
      error.statusCode = 400;
      throw error;
    }

    const defaultAvatar = cleanAvatar(avatar);

    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      isPhoneVerified: true,
      password,
      age: Number(age) || 24,
      gender,
      interestedIn,
      maritalStatus,
      religion,
      motherTongue,
      occupation,
      education,
      location: { city, state, country: 'India' },
      bio,
      avatar: defaultAvatar,
      photos: defaultAvatar ? [defaultAvatar] : [],
      interests: Array.isArray(interests)
        ? interests
        : interests
            .toString()
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean),
      role,
      isPremium: Boolean(isPremium),
      premiumPlan: isPremium ? 'Admin Granted VIP' : 'Free',
      premiumSince: isPremium ? new Date() : null,
      isActive: true,
    });

    const userObj = newUser.toObject();
    delete userObj.password;
    return userObj;
  }

  async updateUser(userId, updatePayload) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const editableFields = [
      'name',
      'email',
      'phone',
      'age',
      'gender',
      'interestedIn',
      'maritalStatus',
      'religion',
      'motherTongue',
      'occupation',
      'education',
      'height',
      'diet',
      'bio',
      'avatar',
      'role',
      'isActive',
      'isPhoneVerified',
      'isPremium',
      'premiumPlan',
    ];

    editableFields.forEach((field) => {
      if (updatePayload[field] !== undefined) {
        user[field] = updatePayload[field];
      }
    });

    if (updatePayload.dob && !isNaN(new Date(updatePayload.dob).getTime())) {
      user.dob = new Date(updatePayload.dob);
    }

    if (
      updatePayload.city !== undefined ||
      updatePayload.state !== undefined ||
      updatePayload.location
    ) {
      user.location = {
        city:
          updatePayload.location?.city ??
          updatePayload.city ??
          user.location?.city ??
          'Delhi',
        state:
          updatePayload.location?.state ??
          updatePayload.state ??
          user.location?.state ??
          '',
        country:
          updatePayload.location?.country ??
          updatePayload.country ??
          user.location?.country ??
          'India',
      };
    }

    if (updatePayload.interests !== undefined) {
      user.interests = Array.isArray(updatePayload.interests)
        ? updatePayload.interests
        : updatePayload.interests
            .toString()
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean);
    }

    if (updatePayload.newPassword && updatePayload.newPassword.trim().length >= 6) {
      user.password = updatePayload.newPassword.trim();
    }

    await user.save();
    const updated = user.toObject();
    delete updated.password;
    return updated;
  }

  async toggleUserStatus(userId, isActive) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    user.isActive = isActive !== undefined ? Boolean(isActive) : !user.isActive;
    await user.save();

    const updated = user.toObject();
    delete updated.password;
    return updated;
  }

  async toggleUserVerify(userId, isPhoneVerified) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    user.isPhoneVerified =
      isPhoneVerified !== undefined ? Boolean(isPhoneVerified) : !user.isPhoneVerified;
    await user.save();

    const updated = user.toObject();
    delete updated.password;
    return updated;
  }

  async toggleUserPremium(userId, isPremium, premiumPlan) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const nextPremium = isPremium !== undefined ? Boolean(isPremium) : !user.isPremium;
    user.isPremium = nextPremium;
    user.premiumPlan = nextPremium ? premiumPlan || 'Gold Unlimited Pass' : 'Free';
    user.premiumSince = nextPremium ? new Date() : null;
    await user.save();

    if (nextPremium) {
      const notif = await Notification.create({
        userId: user._id,
        senderName: 'LoveKaro Admin',
        type: 'payment',
        title: '💎 VIP Membership Granted by Admin!',
        message: 'Unlimited Chat & Full Profile Viewing have been unlocked on your account.',
      });
      emitToUser(user._id, 'new_notification', notif);
    }

    const updated = user.toObject();
    delete updated.password;
    return updated;
  }

  async deleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    await Message.deleteMany({ userId: user._id });
    await Otp.deleteMany({ phone: user.phone });
    await Payment.deleteMany({ userId: user._id });
    await Notification.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(user._id);

    return { deletedId: userId, name: user.name };
  }

  async deleteMessage(messageId) {
    await Message.findByIdAndDelete(messageId);
    return { deletedId: messageId };
  }
}

module.exports = new AdminService();
