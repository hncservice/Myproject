// server/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const spinRoutes = require('./routes/spinRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const adminRoutes = require('./routes/adminRoutes');

const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

// ======================================================
// 1. TRUST PROXY
// ======================================================

app.set('trust proxy', 1);

// ======================================================
// 2. CORS
// MUST BE BEFORE ROUTES
// ======================================================

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',

  'https://spin.hotncool.qa',
  'http://spin.hotncool.qa',

  'https://myproject-three-ecru.vercel.app',
  'https://myproject-spin.vercel.app',

  'https://myproject-4ewda3rak-hncservices-projects.vercel.app',

  process.env.CLIENT_URL
]
  .filter(Boolean)
  .filter((value, index, array) => array.indexOf(value) === index);

const corsOptions = {
  origin: function (origin, callback) {

    // Allow Postman, curl, server-to-server, etc.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log(`❌ CORS BLOCKED: ${origin}`);

    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ],

  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// ======================================================
// 3. SECURITY
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

// ======================================================
// 4. LOGGING
// ======================================================

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ======================================================
// 5. BODY PARSING
// ======================================================

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

// ======================================================
// 6. TEST ROUTES
// THESE DO NOT REQUIRE MONGODB
// ======================================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HNC Spin API is running'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API healthy',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// 7. MONGODB CONNECTION
// ======================================================

// Cache the MongoDB connection promise.
// Important for Vercel / serverless environments.

let dbConnectionPromise = null;

const ensureDatabaseConnection = async () => {

  if (!dbConnectionPromise) {

    console.log('🔄 Connecting to MongoDB...');

    dbConnectionPromise = connectDB()
      .then(() => {
        console.log('✅ MongoDB connection ready');
        return true;
      })
      .catch((error) => {

        console.error(
          '❌ MongoDB connection failed:',
          error.message
        );

        // Reset so another request can retry
        dbConnectionPromise = null;

        throw error;
      });
  }

  return dbConnectionPromise;
};

// ======================================================
// 8. DATABASE MIDDLEWARE
// ======================================================

// Any request reaching this point under /api
// requires MongoDB.
//
// /api/health is above this middleware,
// so health checking still works even if MongoDB fails.

app.use('/api', async (req, res, next) => {

  try {

    await ensureDatabaseConnection();

    next();

  } catch (error) {

    console.error(
      '❌ Database unavailable:',
      error.message
    );

    return res.status(503).json({
      success: false,
      message: 'Database connection unavailable'
    });
  }
});

// ======================================================
// 9. API ROUTES
// ======================================================

app.use('/api/auth', authRoutes);

app.use('/api/spin', spinRoutes);

app.use('/api/vendor', vendorRoutes);

app.use('/api/admin', adminRoutes);

// ======================================================
// 10. 404 HANDLER
// ======================================================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });

});

// ======================================================
// 11. ERROR HANDLER
// MUST BE LAST
// ======================================================

app.use(errorMiddleware);

// ======================================================
// 12. LOCAL SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

// Start listening ONLY when running directly locally.
//
// When Vercel loads this file,
// Vercel handles the HTTP server itself.

if (require.main === module) {

  app.listen(PORT, () => {

    console.log('');
    console.log('====================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log('====================================');

    console.log('Allowed origins:');

    allowedOrigins.forEach((origin) => {
      console.log(`✅ ${origin}`);
    });

    console.log('====================================');
    console.log('');

  });

}

// ======================================================
// 13. EXPORT FOR VERCEL
// ======================================================

module.exports = app;