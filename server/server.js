// server/app.js
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

// (optional) trust proxy
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// CORS – allow your frontend + local dev
const allowedOrigins = [
  'http://localhost:5173',
  'https://myproject-three-ecru.vercel.app', // your frontend on Vercel
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server / tools with no origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Preflight
app.options('*', cors());

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', spinRoutes); // /api/wheel, /api/spin
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin', adminRoutes);

// Error handler
app.use(errorMiddleware);

// ❗ No app.listen here – just export app
module.exports = app;
