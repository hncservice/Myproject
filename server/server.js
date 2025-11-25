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

// 🔥 SIMPLE, PERMISSIVE CORS (DEV + PROD)
app.use(
  cors({
    origin: true, // reflect the requesting origin in Access-Control-Allow-Origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// No app.options('*') here – cors() already handles OPTIONS

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
});
