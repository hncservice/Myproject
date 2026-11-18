
'use strict';

const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
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

    passwordHash: {
      type: String,
      required: true,
    },

    vendorKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
    },

    // Existing vendors without this field are treated
    // as active until explicitly disabled.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Increment to revoke all previously issued tokens.
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
     // Internal counter used to coordinate QR redemption
    // with vendor disable and session revocation.
    // Not a replacement for tokenVersion.
    redemptionFence: {
      type: Number,
      default: 0,
      min: 0,
    },

    disabledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'Vendor',
  vendorSchema
);
