// server/models/AdminUser.js
const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'admin' } // could be 'admin', 'superadmin'
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminUser', adminUserSchema);
