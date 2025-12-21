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

// 1) Connect to MongoDB
connectDB();

// 2) Trust proxy (for Render / Vercel / AWS ALB)
app.set('trust proxy', 1);

// 3) Security middleware
app.use(helmet());
app.use(
  helmet.crossOriginResourcePolicy({
    policy: 'cross-origin'
  })
);

// 4) Logging (disable or change level in production if you want)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 5) CORS
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL,
  'https://myproject-three-ecru.vercel.app',
  'https://myproject-spin.vercel.app/api',
  'https://myproject-spin.vercel.app',
  'http://spin.hotncool.qa',
  'https://spin.hotncool.qa',
  'https://myproject-4ewda3rak-hncservices-projects.vercel.app'
].filter(Boolean);

// Simpler: let express-cors handle array
app.use(
  cors({
    origin(origin, callback) {
      // Allow tools like Postman / curl (no origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.log(`CORS blocked request from: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 6) Body parsing
app.use(express.json({ limit: '1mb' }));

// 7) Routes
app.use('/api/auth', authRoutes);
// app.use('/api', spinRoutes);        // /api/wheel, /api/spin
app.use('/api/spin', spinRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin', adminRoutes);

// 8) Error handler (must be after routes)
app.use(errorMiddleware);

// 9) Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
  console.log(' Allowed origins:', allowedOrigins);
});
