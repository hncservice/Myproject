'use strict';

const bcrypt = require('bcrypt');
const Joi = require('joi');

const User = require('../models/User');
const Vendor = require('../../vendors/models/Vendor');
const AdminUser = require('../../administration/models/AdminUser');

const { issueUserOtp } = require('../services/otpChallengeService');
const { consumeUserOtp } = require('../services/otpVerificationService');
const { signToken } = require('../../../config/jwt');

const PASSWORD_ROUNDS = 10;
const phoneRegex = /^(\+974)?\s?\d{8}$/;

const normalizeEmail = value =>
  String(value || '').trim().toLowerCase();

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string()
    .trim()
    .pattern(phoneRegex)
    .required()
    .messages({
      'string.pattern.base': 'Please enter a valid Qatar phone number.',
      'string.empty': 'Phone number is required.',
    }),
  password: Joi.string()
    .min(6)
    .custom((value, helpers) =>
      Buffer.byteLength(value, 'utf8') <= 72
        ? value
        : helpers.error('any.invalid')
    )
    .required(),
});

const otpVerifySchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const resendSchema = Joi.object({
  email: Joi.string().trim().email().required(),
});

function validationError(res, error) {
  return res.status(400).json({
    message: error.details[0].message,
  });
}

function serverError(res, label, error) {
  if (
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 503 &&
    typeof error.code === 'string' &&
    error.code.startsWith('OTP_')
  ) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
    });
  }

  const code =
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : 'UNEXPECTED_ERROR';

  console.error(label, { code });
  return res.status(500).json({ message: 'Server error' });
}

function invalidCredentials(res) {
  return res.status(400).json({
    message: 'Invalid email or password',
  });
}

function sendUserSession(res, user) {
  const token = signToken({
    id: user._id,
    type: 'user',
    tokenVersion: user.tokenVersion ?? 0,
  });

  res.set('Cache-Control', 'no-store');

  return res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      hasSpun: user.hasSpun,
    },
  });
}

exports.registerUser = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return validationError(res, error);

    const name = value.name;
    const email = normalizeEmail(value.email);
    const digits = value.phone.replace(/^\+974\s?/, '');
    const phone = '+974' + digits;

    const [existingUser, phoneOwner] = await Promise.all([
      User.findOne({ email }),
      User.findOne({
        phone: { $in: [digits, phone, '+974 ' + digits] },
      }).select('_id').lean(),
    ]);

    if (existingUser?.emailVerified) {
      return res.status(400).json({
        message: 'This email is already registered. Please log in.',
      });
    }

    if (
      phoneOwner &&
      (!existingUser || String(phoneOwner._id) !== String(existingUser._id))
    ) {
      return res.status(409).json({
        message: 'This phone number is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(value.password, PASSWORD_ROUNDS);
    const pendingRegistration = { name, phone, passwordHash };

    const user = existingUser ?? await User.create({
      name,
      email,
      phone,
      passwordHash,
      emailVerified: false,
      pendingRegistration,
    });

    const issued = await issueUserOtp({
      user,
      purpose: 'registration',
      pendingRegistration,
    });

    if (!issued) {
      return res.status(409).json({
        message: 'Registration state changed',
      });
    }

    return res.json({ message: 'OTP sent to email' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        code: 'REGISTRATION_CONFLICT',
        message: 'Email or phone number already registered',
      });
    }

    return serverError(res, 'registerUser error:', error);
  }
};
exports.loginUser = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return validationError(res, error);

    const user = await User.findOne({
      email: normalizeEmail(value.email),
    });

    if (!user?.passwordHash) {
      return invalidCredentials(res);
    }

    const passwordMatches = await bcrypt.compare(
      value.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return invalidCredentials(res);
    }

    if (user.isActive === false) {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        message: 'Account is disabled',
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        code: 'ACCOUNT_NOT_VERIFIED',
        message: 'Please complete registration verification.',
      });
    }

    const tokenVersion = user.tokenVersion ?? 0;

    if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
      return res.status(403).json({
        code: 'ACCOUNT_INVALID',
        message: 'Account requires review',
      });
    }

    return sendUserSession(res, user);
  } catch (error) {
    return serverError(res, 'loginUser error:', error);
  }
};

exports.verifyUserOtp = async (req, res) => {
  try {
    const { error, value } = otpVerifySchema.validate(req.body);
    if (error) return validationError(res, error);

    const user = await consumeUserOtp({
      email: normalizeEmail(value.email),
      otp: value.otp,
    });

    return sendUserSession(res, user);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    return serverError(res, 'verifyUserOtp error:', error);
  }
};

exports.resendUserOtp = async (req, res) => {
  try {
    const { error, value } = resendSchema.validate(req.body);
    if (error) return validationError(res, error);

    const user = await User.findOne({
      email: normalizeEmail(value.email),
    });

    if (
      user &&
      user.isActive !== false &&
      !user.emailVerified &&
      user.otpPurpose === 'registration'
    ) {
      await issueUserOtp({ user, purpose: 'registration' });
    }

    return res.json({
      message: 'If a challenge is available, an OTP will be sent.',
    });
  } catch (error) {
    return serverError(res, 'resendUserOtp error:', error);
  }
};

exports.loginVendor = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return validationError(res, error);

    const vendor = await Vendor.findOne({
      email: normalizeEmail(value.email),
    });

    if (!vendor?.passwordHash) {
      return invalidCredentials(res);
    }

    const passwordMatches = await bcrypt.compare(
      value.password,
      vendor.passwordHash
    );

    if (!passwordMatches) {
      return invalidCredentials(res);
    }

    if (vendor.isActive === false) {
      return res.status(403).json({
        code: 'VENDOR_DISABLED',
        message: 'Vendor account is disabled',
      });
    }

    const tokenVersion = vendor.tokenVersion ?? 0;

    if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
      return res.status(403).json({
        message: 'Vendor account requires review',
      });
    }

    const token = signToken({
      id: vendor._id,
      type: 'vendor',
      tokenVersion,
    });

    return res.json({
      token,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
      },
    });
  } catch (error) {
    return serverError(res, 'loginVendor error:', error);
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return validationError(res, error);

    const admin = await AdminUser.findOne({
      email: normalizeEmail(value.email),
    });

    if (!admin?.passwordHash) {
      return invalidCredentials(res);
    }

    const passwordMatches = await bcrypt.compare(
      value.password,
      admin.passwordHash
    );

    if (!passwordMatches) {
      return invalidCredentials(res);
    }

    if (admin.isActive === false || admin.disabledAt != null) {
      return res.status(403).json({
        code: 'ADMIN_DISABLED',
        message: 'Administrator account is disabled',
      });
    }

    const tokenVersion = admin.tokenVersion ?? 0;

    if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
      return res.status(403).json({
        code: 'ADMIN_ACCOUNT_INVALID',
        message: 'Administrator account requires review',
      });
    }

    const token = signToken({
      id: admin._id,
      type: 'admin',
      tokenVersion,
    });

    return res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    return serverError(res, 'loginAdmin error:', error);
  }
};