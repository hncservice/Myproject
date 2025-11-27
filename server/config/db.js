// server/config/db.js
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error(' MONGO_URI is not set in environment variables');
}

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 5000
    });

    console.log('MongoDB connected');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
  } catch (err) {
    console.error(' MongoDB initial connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
