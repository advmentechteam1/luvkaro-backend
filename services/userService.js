const User = require('../models/User');
const Message = require('../models/Message');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { emitToUser, emitToAdmin } = require('../socket/socketManager');

const MAX_FREE_PROMPTS = 5;

const FEMALE_LOCAL_AVATARS = [
  '/priya-sharma.jpg',
  '/images%20(7).jpg',
  '/images%20(11).jpg',
  '/images%20(5).jpg',
  '/images%20(13).jpg',
  '/images%20(10).jpg',
];

const MALE_LOCAL_AVATARS = [
  '/rohit-verma.jpg',
  '/aman-singh.jpg',
  '/images%20(14).jpg',
  '/images%20(6).jpg',
  '/images%20(2).jpg',
  '/images%20(18).jpg',
];

const DUMMY_SEED_EMAILS = [
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
];

const DUMMY_SEED_PHONES = [
  '9811001101',
  '9811001102',
  '9811001103',
  '9811001104',
  '9811001105',
  '9811001106',
  '9811002201',
  '9811002202',
  '9811002203',
  '9811002204',
  '9811002205',
  '9811002206',
];

const cleanAvatar = (url, gender = 'female', seedStr = '') => {
  if (url && typeof url === 'string' && !url.includes('images.unsplash.com')) {
    return url;
  }
  const pool = gender === 'male' ? MALE_LOCAL_AVATARS : FEMALE_LOCAL_AVATARS;
  let hash = 0;
  const s = String(seedStr || 'lovekaro');
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 1000;
  }
  return pool[Math.abs(hash) % pool.length];
};

function maskPhoneNumber(phone) {
  if (!phone) return '+91 XXXXX XXXXX';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 2)}XXXXXX${last10.slice(-2)}`;
  }
  return '+91 XXXXX XXXXX';
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '******@lovekaro.com';
  const [uname, domain] = email.split('@');
  const visible = uname.slice(0, 2) + '****';
  return `${visible}@${domain}`;
}

const sanitizeProfile = (u, viewerId = null) => {
  const obj = u && typeof u.toObject === 'function' ? u.toObject() : { ...u };
  const resolvedAvatar = cleanAvatar(obj.avatar, obj.gender, obj.name || obj.phone || obj._id);
  obj.avatar = resolvedAvatar;
  const cleanPhotos = (obj.photos || [])
    .filter((p) => p && !String(p).includes('images.unsplash.com'));
  obj.photos = cleanPhotos.length > 0 ? cleanPhotos : [resolvedAvatar];
  if (!obj.interestedIn) {
    obj.interestedIn = obj.gender === 'male' ? 'female' : obj.gender === 'female' ? 'male' : 'everyone';
  }

  const isOwner = Boolean(viewerId && obj._id && obj._id.toString() === viewerId.toString());

  if (isOwner) {
    obj.isOwner = true;
    obj.hasSocialAccess = true;
    obj.socialAccessStatus = 'owner';
    obj.hasConfiguredSocial = Boolean(
      obj.socialLinks?.instagram ||
      obj.socialLinks?.facebook ||
      obj.socialLinks?.linkedin ||
      obj.socialLinks?.twitter ||
      obj.socialLinks?.youtube
    );
  } else {
    // Mask sensitive contact details for 100% privacy
    obj.rawPhone = undefined;
    obj.phone = maskPhoneNumber(obj.phone);
    obj.email = maskEmail(obj.email);
    obj.location = {
      city: obj.location?.city || 'Delhi NCR',
      state: obj.location?.state || '',
      country: obj.location?.country || 'India',
      address: 'XXXXXXXXXXXXXX (Detailed Address Hidden for Privacy)',
    };

    const allowedList = (obj.socialAccessAllowed || []).map((id) => id.toString());
    const requestsList = (obj.socialAccessRequests || []).map((id) => id.toString());
    const viewerIdStr = viewerId ? viewerId.toString() : '';

    const hasAccess = Boolean(viewerIdStr && allowedList.includes(viewerIdStr));
    const hasRequested = Boolean(viewerIdStr && requestsList.includes(viewerIdStr));

    obj.hasSocialAccess = hasAccess;
    obj.socialAccessStatus = hasAccess ? 'granted' : hasRequested ? 'requested' : 'none';

    const realLinks = obj.socialLinks || {};
    obj.hasConfiguredSocial = Boolean(
      realLinks.instagram || realLinks.facebook || realLinks.linkedin || realLinks.twitter || realLinks.youtube
    );

    if (!hasAccess) {
      // Mask social handles until target user explicitly verifies and grants access
      obj.socialLinks = {
        instagram: realLinks.instagram ? 'instagram.com/XXXXXXX' : '',
        facebook: realLinks.facebook ? 'facebook.com/XXXXXXX' : '',
        linkedin: realLinks.linkedin ? 'linkedin.com/in/XXXXXXX' : '',
        twitter: realLinks.twitter ? 'x.com/XXXXXXX' : '',
        youtube: realLinks.youtube ? 'youtube.com/@XXXXXXX' : '',
      };
    }
  }

  return obj;
};

let dummyPurged = false;
async function purgeDummySeedUsersFromDB() {
  if (dummyPurged) return;
  try {
    await User.deleteMany({
      $or: [
        { email: { $in: DUMMY_SEED_EMAILS } },
        { phone: { $in: DUMMY_SEED_PHONES } },
      ],
    });
    dummyPurged = true;
  } catch (err) {
    console.warn('Purge dummy users warning:', err.message);
  }
}

// Strict detector for phone numbers, Instagram IDs, social handles, emails, or external links
function detectRestrictedContactInfo(rawText) {
  if (!rawText) return null;
  const text = rawText.toLowerCase();

  // 1. Check for 6+ digits (even with spaces, dashes, dots, brackets)
  const digitsOnly = text.replace(/\D/g, '');
  if (digitsOnly.length >= 6) {
    return 'Phone Number / Digits Sharing Restricted';
  }

  // 2. Check for spoken/written numbers
  const numberWords = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ek', 'do', 'teen', 'char', 'panch', 'che', 'saat', 'aath', 'nau', 'das',
  ];
  let wordHits = 0;
  const words = text.split(/[\s,.-]+/);
  for (const w of words) {
    if (numberWords.includes(w)) wordHits++;
  }
  if (wordHits >= 4) {
    return 'Written Phone Number Restricted';
  }

  // 3. Check for @handle (Instagram / Telegram / Twitter IDs) or emails
  if (/@[a-z0-9._]{2,}/i.test(rawText) || /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(rawText)) {
    return 'Instagram / Social Handle (@id) or Email Restricted';
  }

  // 4. Check for social media & contact keywords
  const bannedPatterns = [
    /\binsta\b/i,
    /\binstagram\b/i,
    /\big\s*[:-]?\s*[a-z0-9._]+/i,
    /\bsnap\b/i,
    /\bsnapchat\b/i,
    /\btelegram\b/i,
    /\bwhatsapp\b/i,
    /\bwa\.me\b/i,
    /\bfacebook\b/i,
    /\bfb\s*id\b/i,
    /\bmy\s*id\b/i,
    /\binsta\s*id\b/i,
    /\bnumber\s*lo\b/i,
    /\bcall\s*me\b/i,
    /\bdm\s*me\b/i,
    /https?:\/\//i,
    /www\./i,
  ];

  for (const pattern of bannedPatterns) {
    if (pattern.test(text)) {
      return 'Instagram ID / Social Media Handle Restricted';
    }
  }

  return null;
}

class UserService {
  async getPublicProfiles(filters = {}) {
    await purgeDummySeedUsersFromDB();

    const query = {
      isActive: { $ne: false },
    };

    if (filters.viewerGender === 'male') {
      query.gender = 'female';
    } else if (filters.viewerGender === 'female') {
      query.gender = 'male';
    } else if (filters.gender && filters.gender !== 'all') {
      query.gender = filters.gender;
    }

    if (filters.city && filters.city !== 'all') {
      query['location.city'] = new RegExp(filters.city, 'i');
    }

    const rawProfiles = await User.find(query)
      .select('-password -email -phone')
      .sort({ createdAt: -1 })
      .limit(100);
    return rawProfiles.map(sanitizeProfile);
  }

  async getProfiles(currentUserId, filters = {}) {
    await purgeDummySeedUsersFromDB();

    const currentUser = await User.findById(currentUserId).select('gender interestedIn');
    const query = {
      _id: { $ne: currentUserId },
      isActive: { $ne: false },
    };

    if (filters.gender && filters.gender !== 'all') {
      query.gender = filters.gender;
    } else if (currentUser) {
      if (currentUser.gender === 'male') {
        query.gender = 'female';
      } else if (currentUser.gender === 'female') {
        query.gender = 'male';
      } else if (
        currentUser.interestedIn === 'male' ||
        currentUser.interestedIn === 'female'
      ) {
        query.gender = currentUser.interestedIn;
      }
    }

    const rawProfiles = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(100);
    return rawProfiles.map((p) => sanitizeProfile(p, currentUserId));
  }

  async getDashboardData(userId) {
    await purgeDummySeedUsersFromDB();

    const user = await User.findById(userId).select('-password');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Dynamic matching based on user's selected interestedIn preference:
    // User selects gender AND selects interestedIn (male, female, or everyone)
    let targetGender = null;
    if (user.interestedIn === 'male' || user.interestedIn === 'female') {
      targetGender = user.interestedIn;
    } else if (user.interestedIn === 'everyone' || user.interestedIn === 'all') {
      targetGender = null; // show both men and women
    } else if (user.gender === 'male') {
      targetGender = 'female';
    } else if (user.gender === 'female') {
      targetGender = 'male';
    }

    const matchQuery = {
      _id: { $ne: userId },
      isActive: { $ne: false },
      ...(targetGender ? { gender: targetGender } : {}),
    };

    const rawOtherUsers = await User.find(matchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(100);

    const usersWhoLikedMe = await User.find({ likes: userId }).select('_id');
    const whoLikedMeIds = usersWhoLikedMe.map((u) => u._id.toString());

    const otherUsers = rawOtherUsers.map((p) => {
      const sanitized = sanitizeProfile(p, userId);
      sanitized.hasLikedMe = whoLikedMeIds.includes(p._id.toString());
      return sanitized;
    });

    // Fetch messages where user is sender OR recipient
    const rawUserMessages = await Message.find({
      $or: [{ userId }, { partnerId: userId.toString() }],
      isBlockedAttempt: { $ne: true },
    }).sort({ createdAt: 1 });

    // Deduplicate and normalize so partnerId ALWAYS points to the conversation partner
    const seenMsgKeys = new Set();
    const userMessages = [];
    rawUserMessages.forEach((m) => {
      const isSender = m.userId.toString() === userId.toString();
      const realPartnerId = isSender ? m.partnerId.toString() : m.userId.toString();
      const dedupKey = `${realPartnerId}_${m.text}_${m.time || ''}`;
      if (seenMsgKeys.has(dedupKey)) return;
      seenMsgKeys.add(dedupKey);

      userMessages.push({
        _id: m._id,
        partnerId: realPartnerId,
        partnerName: m.partnerName,
        text: m.text,
        type: isSender ? m.type : 'received',
        time: m.time || 'Recently',
        createdAt: m.createdAt,
      });
    });

    const sentCount = userMessages.filter(
      (m) => m.type === 'sent'
    ).length;

    let shouldSaveUser = false;
    if (user.freePromptsUsed !== sentCount) {
      user.freePromptsUsed = sentCount;
      shouldSaveUser = true;
    }

    // Ensure user has a valid avatar persisted in DB if missing
    const resolvedUserAvatar = cleanAvatar(user.avatar, user.gender, user.name || user.phone);
    if (!user.avatar || user.avatar.includes('images.unsplash.com')) {
      user.avatar = resolvedUserAvatar;
      shouldSaveUser = true;
    }
    if (!user.interestedIn) {
      user.interestedIn = user.gender === 'male' ? 'female' : user.gender === 'female' ? 'male' : 'everyone';
      shouldSaveUser = true;
    }

    if (shouldSaveUser) {
      await user.save();
    }

    const likesReceivedCount = await User.countDocuments({ likes: userId });
    const userPayments = await Payment.find({ userId }).sort({ createdAt: -1 });
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(40);

    let completedFields = 5;
    const totalFields = 10;
    if (user.bio && user.bio.length > 10) completedFields++;
    if (user.occupation) completedFields++;
    if (user.education) completedFields++;
    if (user.location?.city) completedFields++;
    if (user.interests?.length > 0) completedFields++;
    const completionPercent = Math.min(100, Math.round((completedFields / totalFields) * 100));

    const sanitizedUser = sanitizeProfile(user, userId);

    const pendingRequesters = await User.find({
      _id: { $in: user.socialAccessRequests || [] },
    }).select('_id name avatar gender age location.city');
    sanitizedUser.pendingSocialRequests = pendingRequesters.map((r) => sanitizeProfile(r, userId));

    return {
      user: sanitizedUser,
      stats: {
        profileViews: likesReceivedCount + (user.matches?.length || 0),
        likesSent: user.likes?.length || 0,
        likesReceived: likesReceivedCount,
        matchesCount: user.matches?.length || 0,
        totalMembers: otherUsers.length,
        completionPercent,
        freePromptsUsed: sentCount,
        freePromptsRemaining: user.isPremium ? 9999 : Math.max(0, MAX_FREE_PROMPTS - sentCount),
        maxFreePrompts: MAX_FREE_PROMPTS,
        isPremium: Boolean(user.isPremium),
      },
      profiles: otherUsers,
      whoLikedMeIds,
      messages: userMessages,
      payments: userPayments,
      notifications,
    };
  }

  async updateProfile(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const allowedScalarFields = [
      'name',
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
    ];

    allowedScalarFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    });

    if (updateData.dob && !isNaN(new Date(updateData.dob).getTime())) {
      user.dob = new Date(updateData.dob);
    }

    if (updateData.location || updateData.city !== undefined || updateData.state !== undefined) {
      user.location = {
        city: updateData.location?.city ?? updateData.city ?? user.location?.city ?? 'Delhi',
        state: updateData.location?.state ?? updateData.state ?? user.location?.state ?? '',
        country: updateData.location?.country ?? updateData.country ?? user.location?.country ?? 'India',
      };
    }

    if (Array.isArray(updateData.interests)) {
      user.interests = updateData.interests;
    }

    if (Array.isArray(updateData.photos)) {
      user.photos = updateData.photos;
    } else if (updateData.avatar && (!user.photos || user.photos.length === 0)) {
      user.photos = [updateData.avatar];
    }

    if (updateData.socialLinks && typeof updateData.socialLinks === 'object') {
      const currentSocial = user.socialLinks ? user.socialLinks.toObject() : {};
      user.socialLinks = {
        instagram: updateData.socialLinks.instagram !== undefined ? String(updateData.socialLinks.instagram).trim() : currentSocial.instagram || '',
        facebook: updateData.socialLinks.facebook !== undefined ? String(updateData.socialLinks.facebook).trim() : currentSocial.facebook || '',
        linkedin: updateData.socialLinks.linkedin !== undefined ? String(updateData.socialLinks.linkedin).trim() : currentSocial.linkedin || '',
        twitter: updateData.socialLinks.twitter !== undefined ? String(updateData.socialLinks.twitter).trim() : currentSocial.twitter || '',
        youtube: updateData.socialLinks.youtube !== undefined ? String(updateData.socialLinks.youtube).trim() : currentSocial.youtube || '',
      };
    }

    await user.save();
    const updatedObj = user.toObject();
    delete updatedObj.password;

    emitToAdmin('admin_live_update', { type: 'user_updated', user: updatedObj });
    return updatedObj;
  }

  async updateSettings(userId, settingsData) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const currentSettings = user.settings ? user.settings.toObject() : {};
    const currentPrefs = currentSettings.partnerPreferences || {};

    user.settings = {
      ...currentSettings,
      ...settingsData,
      partnerPreferences: {
        ...currentPrefs,
        ...(settingsData.partnerPreferences || {}),
      },
    };

    await user.save();
    const updatedObj = user.toObject();
    delete updatedObj.password;
    return updatedObj;
  }

  async updatePassword(userId, { currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
      const error = new Error('Please provide both current password and new password');
      error.statusCode = 400;
      throw error;
    }

    if (newPassword.length < 6) {
      const error = new Error('New password must be at least 6 characters long');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 401;
      throw error;
    }

    user.password = newPassword;
    await user.save();

    return { updated: true };
  }

  async getMessages(userId) {
    const rawMessages = await Message.find({
      $or: [{ userId }, { partnerId: userId.toString() }],
      isBlockedAttempt: { $ne: true },
    }).sort({ createdAt: 1 });

    const seen = new Set();
    const formatted = [];
    rawMessages.forEach((m) => {
      const isSender = m.userId.toString() === userId.toString();
      const realPartnerId = isSender ? m.partnerId.toString() : m.userId.toString();
      const key = `${realPartnerId}_${m.text}_${m.time || ''}`;
      if (seen.has(key)) return;
      seen.add(key);

      formatted.push({
        _id: m._id,
        partnerId: realPartnerId,
        partnerName: m.partnerName,
        text: m.text,
        type: isSender ? m.type : 'received',
        time: m.time || 'Recently',
        createdAt: m.createdAt,
      });
    });
    return formatted;
  }

  // Send Message: Saves strictly in MongoDB + Emits Real-Time Socket.IO Message & Notification
  async sendMessage(userId, { partnerId, partnerName, text }) {
    if (!partnerId || !text || !text.trim()) {
      const error = new Error('Recipient and message text are required');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const cleanText = text.trim();
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // 1. Count messages sent by this user in MongoDB
    const sentMessagesCount = await Message.countDocuments({
      userId,
      type: 'sent',
      isBlockedAttempt: { $ne: true },
    });

    // 2. If user is NOT premium, enforce 5-prompt limit AND anti-contact-sharing filter
    if (!user.isPremium) {
      const violationReason = detectRestrictedContactInfo(cleanText);
      if (violationReason) {
        const blockedDoc = await Message.create({
          userId,
          partnerId: partnerId.toString(),
          partnerName: partnerName || '',
          text: cleanText,
          type: 'blocked',
          isBlockedAttempt: true,
          blockReason: violationReason,
          time: nowTime,
        });

        const secNotif = await Notification.create({
          userId,
          senderName: 'Security Filter',
          type: 'security',
          title: '🚫 Contact Sharing Blocked',
          message: `Free chat does not allow sending phone numbers or social IDs (${violationReason}). Upgrade to VIP to unlock.`,
        });

        emitToUser(userId, 'new_notification', secNotif);
        emitToAdmin('admin_live_update', {
          type: 'message_blocked',
          blockedMessage: blockedDoc,
        });

        const error = new Error(
          `🚫 Free Chat me Mobile Number, Instagram ID ya koi bhi Social ID send karna allowed nahi hai! (${violationReason}). Unlimited chat aur full profile unlock karne ke liye abhi Payment karein.`
        );
        error.statusCode = 403;
        error.requiresPayment = true;
        error.violationReason = violationReason;
        throw error;
      }

      if (sentMessagesCount >= MAX_FREE_PROMPTS) {
        const error = new Error(
          '🔒 Aapke 5 Free Chat Prompts poore ho chuke hain! Aage unlimited chat karne aur ek dusre ki full profile check karne ke liye abhi Payment plan unlock karein.'
        );
        error.statusCode = 402;
        error.requiresPayment = true;
        throw error;
      }
    }

    // 3. Save sent message in MongoDB
    const sentMsg = await Message.create({
      userId,
      partnerId: partnerId.toString(),
      partnerName: partnerName || '',
      text: cleanText,
      type: 'sent',
      time: nowTime,
    });

    const newSentCount = sentMessagesCount + 1;
    user.freePromptsUsed = newSentCount;
    await user.save();

    // 4. Check if partner is a real DB User (24-char ObjectId) and deliver via MongoDB + Socket.IO
    const isPartnerDbUser = /^[0-9a-fA-F]{24}$/.test(partnerId.toString());

    if (isPartnerDbUser) {
      // Save mirrored received message for the recipient user in MongoDB
      const mirroredMsg = await Message.create({
        userId: partnerId,
        partnerId: user._id.toString(),
        partnerName: user.name,
        text: cleanText,
        type: 'received',
        time: nowTime,
      });

      // Save Notification in MongoDB for recipient
      const msgNotif = await Notification.create({
        userId: partnerId,
        senderId: user._id.toString(),
        senderName: user.name,
        senderAvatar: cleanAvatar(user.avatar),
        type: 'message',
        title: `💬 New Message from ${user.name}`,
        message: cleanText.length > 60 ? `${cleanText.slice(0, 60)}...` : cleanText,
      });

      // Emit real-time message & notification to recipient via Socket.IO!
      emitToUser(partnerId, 'receive_message', {
        partnerId: user._id.toString(),
        partnerName: user.name,
        partnerAvatar: cleanAvatar(user.avatar),
        text: cleanText,
        type: 'received',
        time: nowTime,
        message: mirroredMsg,
      });
      emitToUser(partnerId, 'new_notification', msgNotif);
    }

    emitToAdmin('admin_live_update', {
      type: 'new_message',
      message: sentMsg,
    });

    return {
      sent: sentMsg,
      reply: null,
      freePromptsUsed: newSentCount,
      freePromptsRemaining: user.isPremium ? 9999 : Math.max(0, MAX_FREE_PROMPTS - newSentCount),
      limitReached: !user.isPremium && newSentCount >= MAX_FREE_PROMPTS,
      isPremium: Boolean(user.isPremium),
    };
  }

  // Process Payment: Saves in MongoDB Payment Collection & Emits Real-Time Socket Notifications
  async processPayment(userId, paymentPayload) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const {
      planId = 'gold',
      planName = 'Gold Unlimited Chat & Full Profile Pass',
      amount = 499,
      paymentMethod = 'UPI',
      paymentReference = '',
      unlockedPartnerId = '',
      unlockedPartnerName = '',
    } = paymentPayload;

    const transactionId =
      'TXN_LK_' +
      Date.now().toString().slice(-6) +
      '_' +
      Math.floor(100 + Math.random() * 900);

    const payment = await Payment.create({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      userAvatar: user.avatar,
      planId,
      planName,
      amount: Number(amount) || 499,
      currency: 'INR',
      paymentMethod,
      paymentReference: paymentReference || `${user.phone}@upi`,
      transactionId,
      unlockedPartnerId: unlockedPartnerId ? unlockedPartnerId.toString() : '',
      unlockedPartnerName,
      status: 'success',
    });

    user.isPremium = true;
    user.premiumPlan = planName;
    user.premiumSince = new Date();
    await user.save();

    // Save Payment Notification in MongoDB
    const payNotif = await Notification.create({
      userId: user._id,
      senderName: 'LoveKaro Billing',
      type: 'payment',
      title: '💎 VIP Membership Activated!',
      message: `Your payment of ₹${payment.amount} (${planName}) is confirmed. Unlimited chat & full profile checks are now unlocked!`,
    });

    const updatedUser = user.toObject();
    delete updatedUser.password;

    emitToUser(user._id, 'new_notification', payNotif);
    emitToUser(user._id, 'payment_unlocked', { payment, user: updatedUser });
    emitToAdmin('admin_live_update', {
      type: 'payment_received',
      payment,
      user: updatedUser,
    });

    return {
      payment,
      user: updatedUser,
    };
  }

  async getUserPayments(userId) {
    return await Payment.find({ userId }).sort({ createdAt: -1 });
  }

  async getNotifications(userId) {
    return await Notification.find({ userId }).sort({ createdAt: -1 }).limit(40);
  }

  async markNotificationsRead(userId) {
    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
    return await Notification.find({ userId }).sort({ createdAt: -1 }).limit(40);
  }

  async likeProfile(currentUserId, targetUserId) {
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      const error = new Error('Current user not found');
      error.statusCode = 404;
      throw error;
    }

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(targetUserId);
    if (!isValidObjectId) {
      return { isMatch: true, likedId: targetUserId, matches: currentUser.matches };
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      const error = new Error('User to like does not exist');
      error.statusCode = 404;
      throw error;
    }

    const alreadyLiked = currentUser.likes.some((id) => id.toString() === targetUserId.toString());
    if (alreadyLiked) {
      currentUser.likes = currentUser.likes.filter((id) => id.toString() !== targetUserId.toString());
    } else {
      currentUser.likes.push(targetUserId);
    }

    let isMatch = false;
    if (!alreadyLiked) {
      if (targetUser.likes.some((id) => id.toString() === currentUserId.toString())) {
        isMatch = true;
        if (!currentUser.matches.some((id) => id.toString() === targetUserId.toString())) {
          currentUser.matches.push(targetUserId);
        }
        if (!targetUser.matches.some((id) => id.toString() === currentUserId.toString())) {
          targetUser.matches.push(currentUserId);
          await targetUser.save();
        }
      }

      // Create real-time Notification in MongoDB for targetUser
      const likeNotif = await Notification.create({
        userId: targetUser._id,
        senderId: currentUser._id.toString(),
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        type: isMatch ? 'match' : 'like',
        title: isMatch
          ? `🎉 It's a Mutual Match with ${currentUser.name}!`
          : `💖 ${currentUser.name} liked your profile!`,
        message: isMatch
          ? `You and ${currentUser.name} both liked each other. Start chatting now!`
          : `${currentUser.name} (${currentUser.age}, ${currentUser.location?.city || 'India'}) liked your profile.`,
      });

      emitToUser(targetUser._id.toString(), 'new_notification', likeNotif);
      emitToUser(targetUser._id.toString(), 'profile_liked', {
        likerId: currentUser._id.toString(),
        likerName: currentUser.name,
        likerAvatar: currentUser.avatar,
        isMatch,
        notification: likeNotif,
      });

      if (isMatch) {
        const matchNotifForCurrent = await Notification.create({
          userId: currentUser._id,
          senderId: targetUser._id.toString(),
          senderName: targetUser.name,
          senderAvatar: targetUser.avatar,
          type: 'match',
          title: `🎉 Mutual Match with ${targetUser.name}!`,
          message: `You and ${targetUser.name} both liked each other! Start chatting now.`,
        });
        emitToUser(currentUser._id.toString(), 'new_notification', matchNotifForCurrent);
      }

      emitToAdmin('admin_live_update', {
        type: isMatch ? 'new_match' : 'new_like',
        user: currentUser.name,
        target: targetUser.name,
      });
    }

    await currentUser.save();
    return {
      isMatch,
      liked: !alreadyLiked,
      likes: currentUser.likes,
      matches: currentUser.matches,
    };
  }

  // Request permission from targetUser to view their social media links
  async requestSocialAccess(viewerId, targetUserId) {
    if (!targetUserId) {
      const error = new Error('Target user ID is required');
      error.statusCode = 400;
      throw error;
    }

    if (viewerId.toString() === targetUserId.toString()) {
      return { success: true, status: 'owner', message: 'This is your own profile' };
    }

    const [viewer, targetUser] = await Promise.all([
      User.findById(viewerId),
      User.findById(targetUserId),
    ]);

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const allowed = (targetUser.socialAccessAllowed || []).map((id) => id.toString());
    if (allowed.includes(viewerId.toString())) {
      return { success: true, status: 'granted', message: 'You already have access to their social links' };
    }

    const requests = (targetUser.socialAccessRequests || []).map((id) => id.toString());
    if (!requests.includes(viewerId.toString())) {
      targetUser.socialAccessRequests.push(viewerId);
      await targetUser.save();
    }

    // Create Notification for target user
    const notif = await Notification.create({
      userId: targetUser._id,
      senderId: viewer._id.toString(),
      senderName: viewer.name,
      senderAvatar: viewer.avatar,
      type: 'social_request',
      title: '🔐 Social Media Access Request',
      message: `${viewer.name} has requested permission to view your Social Media links.`,
      requesterId: viewer._id.toString(),
    });

    // Real-time Socket.IO emission to target user
    emitToUser(targetUser._id.toString(), 'new_notification', notif);
    emitToUser(targetUser._id.toString(), 'social_access_requested', {
      requesterId: viewer._id.toString(),
      requesterName: viewer.name,
      requesterAvatar: viewer.avatar,
      notification: notif,
    });

    return {
      success: true,
      status: 'requested',
      message: `Access request sent to ${targetUser.name}! Unki approval milte hi links unlock ho jayengi.`,
    };
  }

  // Target user responds to Social Access request (Allow / Decline)
  async respondSocialAccess(targetUserId, requesterId, action = 'allow') {
    if (!requesterId) {
      const error = new Error('Requester ID is required');
      error.statusCode = 400;
      throw error;
    }

    const [targetUser, requester] = await Promise.all([
      User.findById(targetUserId),
      User.findById(requesterId),
    ]);

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Remove from pending requests
    targetUser.socialAccessRequests = (targetUser.socialAccessRequests || []).filter(
      (id) => id.toString() !== requesterId.toString()
    );

    if (action === 'allow') {
      const allowed = (targetUser.socialAccessAllowed || []).map((id) => id.toString());
      if (!allowed.includes(requesterId.toString())) {
        targetUser.socialAccessAllowed.push(requesterId);
      }

      await targetUser.save();

      // Notify requester that access is granted
      if (requester) {
        const notif = await Notification.create({
          userId: requester._id,
          senderId: targetUser._id.toString(),
          senderName: targetUser.name,
          senderAvatar: targetUser.avatar,
          type: 'social_granted',
          title: '🎉 Social Media Access Granted!',
          message: `${targetUser.name} has approved your request! You can now view their social media links.`,
          requesterId: targetUser._id.toString(),
        });

        emitToUser(requester._id.toString(), 'new_notification', notif);
        emitToUser(requester._id.toString(), 'social_access_granted', {
          targetUserId: targetUser._id.toString(),
          targetUserName: targetUser.name,
          socialLinks: targetUser.socialLinks,
          notification: notif,
        });
      }

      // Mark the social_request notification as read for targetUser
      await Notification.updateMany(
        { userId: targetUser._id, senderId: requesterId.toString(), type: 'social_request' },
        { read: true }
      );

      return {
        success: true,
        action: 'allow',
        message: `Access granted to ${requester?.name || 'user'}!`,
      };
    } else {
      await targetUser.save();
      await Notification.updateMany(
        { userId: targetUser._id, senderId: requesterId.toString(), type: 'social_request' },
        { read: true }
      );

      return {
        success: true,
        action: 'decline',
        message: 'Request declined.',
      };
    }
  }
}

module.exports = new UserService();
