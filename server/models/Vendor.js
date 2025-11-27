// server/models/Vendor.js
const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: { type: String, required: true },

    vendorKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },

    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Vendor', vendorSchema);
