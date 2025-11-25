// server/models/Spin.js
const mongoose = require('mongoose');

const spinSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    wheelItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WheelItem' },

    spunAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['won', 'lost'], required: true },

    qrToken: { type: String },
    qrExpiry: { type: Date },

    redeemedByVendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor'
    },
    redeemedAt: { type: Date },
    redemptionStatus: {
      type: String,
      enum: ['pending', 'redeemed'],
      default: 'pending'
    },

    emailSent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Spin', spinSchema);
