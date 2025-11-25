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
// Add more entries here if needed
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'https://myproject-three-ecru.vercel.app',
  'http://play.hotncool.qa','https://myproject-4ewda3rak-hncservices-projects.vercel.app'
];

// CORS Settings
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(`❌ CORS blocked request from: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// ❌ REMOVE this line (it causes the PathError crash)
// app.options('*', cors());

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
  console.log(`🌐 Allowed frontend: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
});
