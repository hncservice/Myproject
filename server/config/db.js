
 // server/config/db.js

const mongoose = require('mongoose');

const connectDB = async () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const MONGO_URI = isDevelopment
    ? process.env.HNC_SANDBOX_MONGO_URI
    : process.env.MONGO_URI;

  if (!MONGO_URI) {
    throw new Error('Required MongoDB connection is not configured');
  }

  if (isDevelopment) {
    const uri = new URL(MONGO_URI);
    const databaseName = decodeURIComponent(
      uri.pathname.slice(1)
    );

    if (databaseName !== 'hnc_step15q_sandbox') {
      throw new Error(
        'Development database must be hnc_step15q_sandbox'
      );
    }
  }

  // Reuse existing connection
  if (mongoose.connection.readyState === 1) {
    if (
      isDevelopment &&
      mongoose.connection.name !== 'hnc_step15q_sandbox'
    ) {
      throw new Error('Existing connection is not the sandbox database');
    }

    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10000
    });

    if (
      isDevelopment &&
      mongoose.connection.name !== 'hnc_step15q_sandbox'
    ) {
      await mongoose.disconnect();
      throw new Error('Connected to an unexpected database');
    }

    console.log('✅ MongoDB connected');

    return mongoose.connection;

  } catch (err) {
    console.error('❌ MongoDB initial connection failed');

    // Let server.js return HTTP 503 when database is unavailable.
    throw err;
  }
};

mongoose.connection.on('error', () => {
  console.error('❌ MongoDB connection error');
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

module.exports = connectDB;
