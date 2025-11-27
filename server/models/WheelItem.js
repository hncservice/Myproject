// server/models/WheelItem.js
const mongoose = require('mongoose');

const wheelItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },

    probabilityWeight: { type: Number, default: 1, min: 0 },

    // null = unlimited
    quantityTotal: { type: Number, default: null, min: 0 },
    quantityRedeemed: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true, index: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('WheelItem', wheelItemSchema);
