const mongoose = require('mongoose');
const { connectDB, getConnectionError } = require('../config/db');
const User = require('../models/User');

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

// Database lifecycle events listener & connection manager
const initDatabase = async () => {
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected! Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected successfully.');
  });

  await connectDB();

  if (mongoose.connection.readyState === 1) {
    try {
      await User.deleteMany({ email: { $in: DUMMY_SEED_EMAILS } });
    } catch (err) {
      console.warn('Dummy user cleanup notice:', err.message);
    }
  }
};

module.exports = { initDatabase, getConnectionError };
