// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  verifyUserOtp,
  loginVendor,
  loginAdmin
} = require('../controllers/authController');
const { otpLimiter } = require('../middleware/rateLimit');

router.post('/register',otpLimiter, registerUser);     // user registration + OTP send
router.post('/verify-otp', otpLimiter, verifyUserOtp);  // user OTP verification
router.post('/vendor/login', loginVendor);  // vendor login
router.post('/admin/login', loginAdmin);    // admin login

module.exports = router;
