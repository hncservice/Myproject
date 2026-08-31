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
// 1. MongoDB
// ======================================================
connectDB();

// ======================================================
// 2. Trust proxy
// ======================================================
app.set('trust proxy', 1);

// ======================================================
// 3. CORS
// MUST COME BEFORE ROUTES
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
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {

    // Allow Postman, curl, server-to-server requests
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('❌ CORS BLOCKED:', origin);

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
// 4. Security
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

// ======================================================
// 5. Logging
// ======================================================

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ======================================================
// 6. Body parsing
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
// 7. Basic test route
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
    message: 'API healthy'
  });
});

// ======================================================
// 8. API Routes
// ======================================================

app.use('/api/auth', authRoutes);

app.use('/api/spin', spinRoutes);

app.use('/api/vendor', vendorRoutes);

app.use('/api/admin', adminRoutes);

// ======================================================
// 9. 404
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// ======================================================
// 10. Error handler
// ======================================================

app.use(errorMiddleware);

// ======================================================
// 11. Start server
// ======================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);

  console.log('✅ Allowed origins:');
  allowedOrigins.forEach((origin) => {
    console.log(`   ${origin}`);
  });
});