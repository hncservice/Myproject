// server/config/db.js

const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not set in environment variables');
  }

  // Reuse existing connection in Vercel/serverless environment
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 10000
    });

    console.log('✅ MongoDB connected');

    return mongoose.connection;

  } catch (err) {
    console.error(
      '❌ MongoDB initial connection error:',
      err.message
    );

    // IMPORTANT:
    // Never use process.exit(1) on Vercel.
    // Let server.js handle the error and return HTTP 503.
    throw err;
  }
};

mongoose.connection.on('error', (err) => {
  console.error(
    '❌ MongoDB connection error:',
    err.message
  );
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

module.exports = connectDB;
