// server/models/Spin.js
const mongoose = require('mongoose');

const spinSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    wheelItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WheelItem'
    },

    spunAt: {
      type: Date,
      default: Date.now
    },

    status: {
      type: String,
      enum: ['won', 'lost'],
      required: true,
      index: true
    },

    qrToken: {
      type: String,
      index: true,
      unique: true,
      sparse: true // only enforce unique when qrToken exists
    },
    qrExpiry: { type: Date },

    redeemedByVendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true
    },
    redeemedAt: { type: Date },
    redemptionStatus: {
      type: String,
      enum: ['pending', 'redeemed'],
      default: 'pending',
      index: true
    },

    emailSent: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Spin', spinSchema);
