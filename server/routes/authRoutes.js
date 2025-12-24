// server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  verifyUserOtp,
  loginVendor,
  loginAdmin,
  loginUser // ✅ NEW
} = require('../controllers/authController');
const { otpLimiter, loginLimiter } = require('../middleware/rateLimit');

router.post('/register', otpLimiter, registerUser);
router.post('/verify-otp', otpLimiter, verifyUserOtp);
router.post('/vendor/login', loginLimiter, loginVendor);
router.post('/admin/login', loginLimiter, loginAdmin);
router.post('/user/login', loginLimiter, loginUser); 

module.exports = router;
