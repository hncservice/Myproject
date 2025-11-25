// server/models/WheelItem.js
const mongoose = require('mongoose');

const wheelItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
    probabilityWeight: { type: Number, default: 1 },
    quantityTotal: { type: Number, default: null }, // null = unlimited
    quantityRedeemed: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WheelItem', wheelItemSchema);
