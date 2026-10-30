const User = require('../models/User');
const Otp = require('../models/Otp');
const Notification = require('../models/Notification');
const generateToken = require('../utils/generateToken');
const jwt = require('jsonwebtoken');
const { emitToAdmin, emitToUser } = require('../socket/socketManager');

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

const cleanAvatarUrl = (url, gender = 'female', seedStr = '') => {
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

const resolveInterestedIn = (gender, providedInterestedIn) => {
  const raw = String(providedInterestedIn || '').toLowerCase().trim();
  if (raw === 'male' || raw === 'female' || raw === 'everyone') {
    return raw;
  }
  if (gender === 'male') return 'female';
  if (gender === 'female') return 'male';
  return 'everyone';
};

const formatUserPayload = (user, token) => {
  const resolvedAvatar = cleanAvatarUrl(user.avatar, user.gender, user.name || user.phone);
  const rawPhotos = (user.photos || [])
    .filter((p) => p && !String(p).includes('images.unsplash.com'));

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isPhoneVerified: user.isPhoneVerified ?? true,
    age: user.age,
    dob: user.dob,
    gender: user.gender,
    interestedIn: resolveInterestedIn(user.gender, user.interestedIn),
    maritalStatus: user.maritalStatus || 'Never Married',
    religion: user.religion || 'Hindu',
    motherTongue: user.motherTongue || 'Hindi',
    occupation: user.occupation || '',
    education: user.education || '',
    height: user.height || '',
    diet: user.diet || 'Veg',
    location: user.location || { city: 'Delhi', state: '', country: 'India' },
    bio: user.bio || '',
    avatar: resolvedAvatar,
    photos: rawPhotos.length > 0 ? rawPhotos : [resolvedAvatar],
    interests: user.interests || [],
    likes: user.likes || [],
    matches: user.matches || [],
    settings: user.settings || {
      showOnlineStatus: true,
      showAge: true,
      showDistance: true,
      profileVisibility: 'everyone',
      emailNotifications: true,
      matchAlerts: true,
      messageAlerts: true,
      partnerPreferences: {
        minAge: 20,
        maxAge: 34,
        preferredReligion: 'Any',
        preferredMotherTongue: 'Any',
        preferredCity: 'Any',
        preferredMaritalStatus: 'Any',
      },
    },
    createdAt: user.createdAt,
    role: user.role || 'user',
    isPremium: Boolean(user.isPremium),
    premiumPlan: user.premiumPlan || 'Free',
    premiumSince: user.premiumSince || null,
    freePromptsUsed: user.freePromptsUsed || 0,
    ...(token && { token }),
  };
};

class AuthService {
  // 1. Send OTP to Phone (Saved strictly in MongoDB Otp collection)
  async sendOtp(phone) {
    if (!phone) {
      const error = new Error('Phone number is required');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = phone.toString().trim().replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      const error = new Error('Please provide a valid 10-digit phone number');
      error.statusCode = 400;
      throw error;
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.deleteMany({ phone: cleanPhone });
    const otpDoc = await Otp.create({
      phone: cleanPhone,
      otp: generatedOtp,
      expiresAt,
    });

    emitToAdmin('admin_live_update', {
      type: 'otp_sent',
      phone: cleanPhone,
      otpId: otpDoc._id,
    });

    console.log(`📱 [OTP SERVICE] Saved to MongoDB for ${cleanPhone}: ${generatedOtp}`);

    return {
      phone: cleanPhone,
      message: 'OTP sent successfully to your mobile number',
      otp: process.env.NODE_ENV === 'production' ? undefined : generatedOtp,
      expiresIn: 300,
    };
  }

  // 2. Verify OTP (Verified strictly against MongoDB Otp collection)
  async verifyOtp(phone, otp) {
    if (!phone || !otp) {
      const error = new Error('Phone and OTP are required');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = phone.toString().trim().replace(/[^0-9+]/g, '');
    const cleanOtp = otp.toString().trim();

    const otpRecord = await Otp.findOne({
      phone: cleanPhone,
      otp: cleanOtp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      const error = new Error('Invalid or expired OTP. Please request a new one.');
      error.statusCode = 400;
      throw error;
    }

    otpRecord.verified = true;
    await otpRecord.save();

    const verificationToken = jwt.sign(
      { phone: cleanPhone, verified: true },
      process.env.JWT_SECRET || 'lovekaro_default_jwt_secret',
      { expiresIn: '30m' }
    );

    return {
      verified: true,
      phone: cleanPhone,
      verificationToken,
      message: 'Phone number verified successfully',
    };
  }

  // 3. Step-by-Step Complete Signup (Saved strictly in MongoDB User & Notification collections)
  async registerUser(userData) {
    const {
      name,
      email,
      phone,
      password,
      dob,
      age: providedAge,
      gender,
      interestedIn = 'everyone',
      maritalStatus = 'Never Married',
      religion = 'Hindu',
      motherTongue = 'Hindi',
      occupation = '',
      education = '',
      height = '',
      diet = 'Veg',
      city = 'Delhi',
      state = '',
      country = 'India',
      bio = '',
      avatar,
      photos = [],
      interests = [],
    } = userData;

    if (!name || !email || !phone || !password || !gender) {
      const error = new Error('Please fill all required fields: name, email, phone, password, and gender');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = phone.toString().trim().replace(/[^0-9+]/g, '');
    const cleanEmail = email.toString().trim().toLowerCase();

    const existingPhone = await User.findOne({ phone: cleanPhone });
    if (existingPhone) {
      const error = new Error(`An account already exists with mobile number ${cleanPhone}. Please log in.`);
      error.statusCode = 400;
      throw error;
    }

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      const error = new Error(`An account already exists with email ${cleanEmail}. Please log in.`);
      error.statusCode = 400;
      throw error;
    }

    let finalAge = Number(providedAge);
    let birthDate = null;

    if (dob && !isNaN(new Date(dob).getTime())) {
      birthDate = new Date(dob);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (!finalAge || isNaN(finalAge)) {
        finalAge = calculatedAge;
      }
    } else {
      finalAge = finalAge && !isNaN(finalAge) ? finalAge : 18;
      birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - finalAge);
      birthDate.setMonth(0);
      birthDate.setDate(1);
    }

    if (finalAge < 18) {
      const error = new Error('You must be at least 18 years old to join LoveKaro');
      error.statusCode = 400;
      throw error;
    }

    const finalAvatar = cleanAvatarUrl(avatar, gender, name || cleanPhone);
    const finalInterestedIn = resolveInterestedIn(gender, interestedIn);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      isPhoneVerified: true,
      password,
      dob: birthDate,
      age: finalAge,
      gender,
      interestedIn: finalInterestedIn,
      maritalStatus,
      religion,
      motherTongue,
      occupation: occupation.trim(),
      education: education.trim(),
      height: height.trim(),
      diet: diet.trim(),
      location: {
        city: city.trim(),
        state: state.trim(),
        country: country.trim(),
      },
      bio: bio.trim(),
      avatar: finalAvatar,
      photos:
        Array.isArray(photos) && photos.length
          ? photos
              .filter((p) => p && !String(p).includes('images.unsplash.com'))
              .concat(finalAvatar)
              .slice(0, 6)
          : [finalAvatar],
      interests: Array.isArray(interests) ? interests : [],
    });

    // Create Welcome Notification in MongoDB
    const welcomeNotif = await Notification.create({
      userId: user._id,
      senderName: 'LoveKaro Team',
      type: 'system',
      title: 'Welcome to LoveKaro! 💖',
      message: `Namaste ${user.name}! You have 5 free chat prompts to start connecting with matches.`,
    });

    emitToUser(user._id, 'new_notification', welcomeNotif);
    emitToAdmin('admin_live_update', {
      type: 'user_registered',
      user: formatUserPayload(user),
    });

    const token = generateToken(user._id);
    return formatUserPayload(user, token);
  }

  // 4. Login with Email or Phone + Password
  async loginUser({ identifier, password }) {
    if (!identifier || !password) {
      const error = new Error('Please provide email/phone and password');
      error.statusCode = 400;
      throw error;
    }

    const cleanIdentifier = identifier.toString().trim();
    const isEmail = cleanIdentifier.includes('@');
    const query = isEmail
      ? { email: cleanIdentifier.toLowerCase() }
      : { phone: cleanIdentifier.replace(/[^0-9+]/g, '') };

    const user = await User.findOne(query);
    if (!user) {
      const error = new Error('No account found with this ' + (isEmail ? 'email' : 'phone number'));
      error.statusCode = 401;
      throw error;
    }

    if (user.isActive === false) {
      const error = new Error('Your account has been suspended by Admin.');
      error.statusCode = 403;
      throw error;
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const error = new Error('Incorrect password. Please try again.');
      error.statusCode = 401;
      throw error;
    }

    const token = generateToken(user._id);
    return formatUserPayload(user, token);
  }

  // 5. Login via Mobile OTP
  async loginWithOtp({ phone, otp }) {
    if (!phone || !otp) {
      const error = new Error('Phone and OTP are required');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = phone.toString().trim().replace(/[^0-9+]/g, '');
    const cleanOtp = otp.toString().trim();

    const otpRecord = await Otp.findOne({
      phone: cleanPhone,
      otp: cleanOtp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      const error = new Error('Invalid or expired OTP');
      error.statusCode = 400;
      throw error;
    }

    await Otp.deleteMany({ phone: cleanPhone });

    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      const error = new Error('No account registered with this phone number. Please complete sign up first.');
      error.statusCode = 404;
      throw error;
    }

    if (user.isActive === false) {
      const error = new Error('Your account has been suspended by Admin.');
      error.statusCode = 403;
      throw error;
    }

    const token = generateToken(user._id);
    return formatUserPayload(user, token);
  }

  // 6. Get Current User Profile
  async getCurrentUser(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return formatUserPayload(user);
  }
}

module.exports = new AuthService();
