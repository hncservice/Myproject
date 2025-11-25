// server/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,                   // 5 OTP-related requests per IP per window
  message: {
    message:
      'Too many OTP requests from this IP, please try again after 10 minutes.',
    code: 'OTP_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  otpLimiter
};
