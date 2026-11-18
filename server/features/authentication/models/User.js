
'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    passwordHash: {
      type: String,
      required: true,
      default: null,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },
    // Additive defaults; legacy missing versions remain zero until revoked.
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0, min: 0 },
    otpRequestedAt: { type: Date, default: null },
    otpWindowStartedAt: { type: Date, default: null },
    otpSendCount: { type: Number, default: 0, min: 0 },
    otpAttempts: { type: Number, default: 0, min: 0 },

    // ============================================
    // OTP AUTHENTICATION
    // ============================================

    otpHash: {
      type: String,
      default: null,
    },

    otpExpiresAt: {
      type: Date,
      default: null,
    },
    // Identify whether OTP is for registration or login
otpPurpose: {
  type: String,
  enum: ['registration', 'login', null],
  default: null,
},

     // Hold proposed registration changes until
    // email ownership has been verified.
    pendingRegistration: {
      name: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      passwordHash: {
        type: String,
      },
    },

    // ============================================
    // LEGACY SPIN STATUS
    // ============================================

    hasSpun: {
      type: Boolean,
      default: false,
    },

    // ============================================
    // LEGACY MONKEY GAME FIELDS
    // ============================================

    monkeyAttempts: {
      type: Number,
      default: 0,
    },

    lastMonkeySessionId: {
      type: String,
      default: null,
    },

    monkeyChancesLeft: {
      type: Number,
      default: 3,
    },

    monkeyMaxChances: {
      type: Number,
      default: 3,
    },

    monkeyLocked: {
      type: Boolean,
      default: false,
    },

    monkeyActiveSession: {
      sessionId: {
        type: String,
        default: null,
      },

      status: {
        type: String,
        enum: ['active', 'completed', 'expired'],
        default: 'expired',
      },

      startedAt: {
        type: Date,
        default: null,
      },

      expiresAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
