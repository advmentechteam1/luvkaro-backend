const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    dob: {
      type: Date,
      default: function () {
        const d = new Date();
        d.setFullYear(d.getFullYear() - (this.age || 18));
        return d;
      },
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [18, 'Age must be at least 18 years'],
      default: 18,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required'],
    },
    interestedIn: {
      type: String,
      enum: ['female', 'male', 'everyone'],
      default: 'everyone',
    },
    // Matrimonial & Cultural Attributes
    maritalStatus: {
      type: String,
      enum: ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce', 'Other'],
      default: 'Never Married',
    },
    religion: {
      type: String,
      enum: ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Jain', 'Buddhist', 'Parsi', 'Jewish', 'Spiritual', 'Other'],
      default: 'Hindu',
    },
    motherTongue: {
      type: String,
      default: 'Hindi',
      trim: true,
    },
    occupation: {
      type: String,
      default: '',
      trim: true,
    },
    education: {
      type: String,
      default: '',
      trim: true,
    },
    height: {
      type: String,
      default: '',
      trim: true,
    },
    diet: {
      type: String,
      default: 'Veg',
      trim: true,
    },
    location: {
      city: { type: String, default: 'Delhi' },
      state: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    bio: {
      type: String,
      default: '',
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    photos: {
      type: [String],
      default: [],
    },
    interests: {
      type: [String],
      default: [],
    },
    socialLinks: {
      instagram: { type: String, default: '', trim: true },
      facebook: { type: String, default: '', trim: true },
      linkedin: { type: String, default: '', trim: true },
      twitter: { type: String, default: '', trim: true },
      youtube: { type: String, default: '', trim: true },
    },
    socialAccessAllowed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    socialAccessRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    settings: {
      showOnlineStatus: { type: Boolean, default: true },
      showAge: { type: Boolean, default: true },
      showDistance: { type: Boolean, default: true },
      profileVisibility: {
        type: String,
        enum: ['everyone', 'matches_only', 'hidden'],
        default: 'everyone',
      },
      emailNotifications: { type: Boolean, default: true },
      matchAlerts: { type: Boolean, default: true },
      messageAlerts: { type: Boolean, default: true },
      partnerPreferences: {
        minAge: { type: Number, default: 20 },
        maxAge: { type: Number, default: 34 },
        preferredReligion: { type: String, default: 'Any' },
        preferredMotherTongue: { type: String, default: 'Any' },
        preferredCity: { type: String, default: 'Any' },
        preferredMaritalStatus: { type: String, default: 'Any' },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    premiumPlan: {
      type: String,
      default: 'Free',
    },
    premiumSince: {
      type: Date,
      default: null,
    },
    freePromptsUsed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password helper method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
