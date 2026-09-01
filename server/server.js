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
// Required when deployed behind Vercel / reverse proxy.

app.set('trust proxy', 1);

// ======================================================
// 2. CORS
// ======================================================

const allowedOrigins = [
  // Local frontend
  'http://localhost:5173',
  'http://localhost:3000',

  // Production frontend
  'https://spin.hotncool.qa',

  // Vercel frontend
  'https://myproject-three-ecru.vercel.app',

  // Optional HTTP version
  // Remove later after HTTPS is fully enforced
  'http://spin.hotncool.qa',

  // Environment variable
  process.env.CLIENT_URL
]
  .filter(Boolean)
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter((origin, index, array) => array.indexOf(origin) === index);

const corsOptions = {
  origin: function (origin, callback) {
    // Requests from Postman, curl, mobile apps,
    // server-to-server etc. may not have Origin header.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.error(`❌ CORS blocked origin: ${origin}`);

    return callback(
      new Error(`Origin not allowed by CORS: ${origin}`)
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

  exposedHeaders: [
    'Content-Length'
  ],

  optionsSuccessStatus: 204
};

// CORS must be before routes
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
    extended: true,
    limit: '1mb'
  })
);

// ======================================================
// 6. ROOT / HEALTH ROUTES
// ======================================================
// These routes intentionally DO NOT require MongoDB.

app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'HNC Spin API is running'
  });
});

app.get('/api/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'API healthy',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// 7. MONGODB CONNECTION
// ======================================================
// Vercel may reuse the same serverless instance.
// We therefore cache the connection promise.

let dbConnectionPromise = null;

const ensureDatabaseConnection = async () => {
  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  console.log('🔄 Checking MongoDB connection...');

  dbConnectionPromise = connectDB()
    .then((connection) => {
      console.log('✅ MongoDB connection ready');
      return connection;
    })
    .catch((error) => {
      console.error(
        '❌ MongoDB connection failed:',
        error.message
      );

      // Reset so the next request can retry
      dbConnectionPromise = null;

      throw error;
    });

  return dbConnectionPromise;
};

// ======================================================
// 8. DATABASE MIDDLEWARE
// ======================================================
// Everything below /api requires MongoDB,
// except /api/health because it was already handled above.

app.use('/api', async (req, res, next) => {
  try {
    await ensureDatabaseConnection();

    return next();

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
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// ======================================================
// 11. GLOBAL ERROR HANDLER
// ======================================================
// Must always be after all routes.

app.use(errorMiddleware);

// ======================================================
// 12. LOCAL SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

// When running:
// node server.js
//
// start the HTTP server normally.
//
// When Vercel imports this file,
// it will NOT call app.listen().

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log(`✅ HNC Spin API running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================');

    console.log('✅ Allowed CORS origins:');

    allowedOrigins.forEach((origin) => {
      console.log(`   ${origin}`);
    });

    console.log('========================================');
    console.log('');
  });
}

// ======================================================
// 13. EXPORT FOR VERCEL
// ======================================================

module.exports = app;