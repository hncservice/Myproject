// server/models/Vendor.js
const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    vendorKey: { type: String, unique: true },

    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);
