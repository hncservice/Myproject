// server/controllers/authController.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const AdminUser = require('../models/AdminUser');
const { generateOtp, hashOtp, compareOtp } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');
const { signToken } = require('../config/jwt');

const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow('', null)
});

const otpVerifySchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

exports.registerUser = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, email, phone } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name, email, phone });
    } else {
      user.name = name;
      user.phone = phone;
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    user.otpHash = otpHash;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('registerUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyUserOtp = async (req, res) => {
  try {
    const { error } = otpVerifySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    if (!user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: 'OTP not requested' });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const match = await compareOtp(otp, user.otpHash);
    if (!match) return res.status(400).json({ message: 'Invalid OTP' });

    user.emailVerified = true;
    user.otpHash = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = signToken({ id: user._id, type: 'user' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        hasSpun: user.hasSpun
      }
    });
  } catch (err) {
    console.error('verifyUserOtp error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Vendor/Admin login
exports.loginVendor = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;
    const vendor = await Vendor.findOne({ email });
    if (!vendor) return res.status(400).json({ message: 'Vendor not found' });

    const ok = await bcrypt.compare(password, vendor.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = signToken({ id: vendor._id, type: 'vendor' });

    res.json({ token, vendor: { id: vendor._id, name: vendor.name, email: vendor.email } });
  } catch (err) {
    console.error('loginVendor error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;
    const admin = await AdminUser.findOne({ email });
    if (!admin) return res.status(400).json({ message: 'Admin not found' });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = signToken({ id: admin._id, type: 'admin' });

    res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error('loginAdmin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
