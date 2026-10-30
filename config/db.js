const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

let connectionError = null;

const cleanMongoUri = (rawUri) => {
  if (!rawUri) return 'mongodb://127.0.0.1:27017/lovekaro';
  // Strip BOM, surrounding quotes, whitespace, and carriage returns
  return rawUri
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
};

const connectDB = async () => {
  try {
    const rawUri = process.env.MONGO_URI;
    const uri = cleanMongoUri(rawUri);
    connectionError = null;

    console.log('⏳ Connecting to MongoDB Atlas...');
    console.log(`   Scheme prefix: "${uri.substring(0, 14)}..." (length: ${uri.length})`);

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    connectionError = error.message;
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

const getConnectionError = () => connectionError;

module.exports = { connectDB, getConnectionError, cleanMongoUri };
