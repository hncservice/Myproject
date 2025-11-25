// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const spinRoutes = require('./routes/spinRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

// Connect to MongoDB
connectDB();

// Allow multiple origins (dev + production)
const allowedOrigins = [
  'http://localhost:5173', // Vite local dev
  process.env.CLIENT_URL,  // main production frontend (set in Render env)
  'https://myproject-three-ecru.vercel.app',
  'http://play.hotncool.qa',
  'https://myproject-4ewda3rak-hncservices-projects.vercel.app',
].filter(Boolean); // remove any undefined entries

// CORS Settings
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(`❌ CORS blocked request from: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ❌ DO NOT use app.options('*', cors()); – it breaks path-to-regexp with express 5+

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', spinRoutes);      // /api/wheel, /api/spin
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin', adminRoutes);

// Error handler
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('🌐 Allowed origins:', allowedOrigins);
});
