
'use strict';

const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema(
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
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ['admin', 'superadmin'],
      default: 'admin',
    },

    // Administrator account security
    isActive: {
      type: Boolean,
      default: true,
    },

    // Increment to invalidate older JWT sessions.
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Invalid administrator token version',
      },
    },

    disabledAt: {
      type: Date,
      default: null,
    },
    // Internal transactional write fence for sensitive
// administrator actions.
prizeReviewFence: {
  type: Number,
  default: 0,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: 'Invalid prize review fence',
  },
},
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'AdminUser',
  adminUserSchema
);
