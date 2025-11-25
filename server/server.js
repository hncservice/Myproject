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

// Render proxy trust (optional but recommended)
app.set('trust proxy', 1);

// Connect to database
connectDB();

// CORS — simple & fully open (works with Render + Vercel)
app.use(
  cors({
    origin: '*', // allow all — no CORS errors
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Handle preflight OPTIONS requests
app.options('*', cors());

app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', spinRoutes); // /api/wheel, /api/spin
app.use('/api/vendor', vendorRoutes);
app.use('/api/admin', adminRoutes);

// Central error handler
app.use(errorMiddleware);

// Start server (Render injects PORT automatically)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on Render at port ${PORT}`);
});
