// server/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
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
    phone: { type: String, trim: true, unique: true,
      sparse: true },

    emailVerified: { type: Boolean, default: false },

    // OTP fields
    otpHash: { type: String },
    otpExpiresAt: { type: Date },

    hasSpun: { type: Boolean, default: false },
     monkeyAttempts: {
    type: Number,
    default: 0,
  },
  monkeyLocked: {
    type: Boolean,
    default: false,
  },
  
lastMonkeySessionId: { type: String, default: null },

  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
