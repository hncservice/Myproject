// server/controllers/authController.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const AdminUser = require('../models/AdminUser');
const { generateOtp, hashOtp, compareOtp } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');
const { signToken } = require('../config/jwt');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const trimString = (value) => (typeof value === 'string' ? value.trim() : value);
const phoneRegex = /^(\+974)?\s?\d{8}$/;
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().custom((v) => v.trim()),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(phoneRegex)
    .required()
    .messages({
      'string.pattern.base':
        'Please enter a valid Qatar phone number (e.g. +974 12345678).',
      'string.empty': 'Phone number is required.'
    })
})

const otpVerifySchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

exports.registerUser = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let { name, email, phone } = req.body;
    email = normalizeEmail(email);
    name = trimString(name);
    phone = trimString(phone);

    // 1️⃣ Check if email already belongs to a verified user
    let userByEmail = await User.findOne({ email });

    if (userByEmail && userByEmail.emailVerified) {
      return res
        .status(400)
        .json({ message: 'This email is already registered. Please log in or use another email.' });
    }

    // 2️⃣ Check if phone is already used by another user
    const userByPhone = await User.findOne({ phone });

    if (
      userByPhone &&
      (!userByEmail || userByPhone._id.toString() !== userByEmail._id.toString())
    ) {
      return res
        .status(400)
        .json({ message: 'This phone number is already registered with another account.' });
    }

    // 3️⃣ Create or update user (unverified)
    let user = userByEmail;

    if (!user) {
      user = await User.create({ name, email, phone });
    } else {
      user.name = name;
      user.phone = phone;
    }

    // 4️⃣ Generate and save OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    user.otpHash = otpHash;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // 5️⃣ Send OTP email
    await sendOtpEmail(email, otp);

    return res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('registerUser error:', err);

    // Handle unique index error (email/phone)
    if (err.code === 11000 && err.keyPattern) {
      if (err.keyPattern.email) {
        return res.status(400).json({ message: 'This email is already registered.' });
      }
      if (err.keyPattern.phone) {
        return res.status(400).json({ message: 'This phone number is already registered.' });
      }
    }

    return res.status(500).json({ message: 'Server error' });
  }
};


exports.verifyUserOtp = async (req, res) => {
  try {
    const { error } = otpVerifySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let { email, otp } = req.body;
    email = normalizeEmail(email);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (!user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: 'OTP not requested' });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const match = await compareOtp(otp, user.otpHash);
    if (!match) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.emailVerified = true;
    user.otpHash = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = signToken({ id: user._id, type: 'user' });

    return res.json({
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
    return res.status(500).json({ message: 'Server error' });
  }
};

// Vendor/Admin login
exports.loginVendor = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let { email, password } = req.body;
    email = normalizeEmail(email);

    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      // Generic error to avoid user enumeration
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, vendor.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = signToken({ id: vendor._id, type: 'vendor' });

    return res.json({
      token,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email
      }
    });
  } catch (err) {
    console.error('loginVendor error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let { email, password } = req.body;
    email = normalizeEmail(email);

    const admin = await AdminUser.findOne({ email });
    if (!admin) {
      // Generic error to avoid user enumeration
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = signToken({ id: admin._id, type: 'admin' });

    return res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (err) {
    console.error('loginAdmin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
