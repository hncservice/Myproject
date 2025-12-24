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
      passwordHash: { type: String, required: true,default: null },

    emailVerified: { type: Boolean, default: false },

    // OTP fields
    otpHash: { type: String },
    otpExpiresAt: { type: Date },

    hasSpun: { type: Boolean, default: false },
     monkeyAttempts: {
    type: Number,
    default: 0,
  },
  
monkeyAttempts: { type: Number, default: 0 },  
lastMonkeySessionId: { type: String, default: null },
monkeyChancesLeft: { type: Number, default: 3 },
monkeyMaxChances: { type: Number, default: 3 },
monkeyLocked: { type: Boolean, default: false },

monkeyActiveSession: {
  sessionId: { type: String, default: null },
  status: { type: String, enum: ['active', 'completed', 'expired'], default: 'expired' },
  startedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
}


  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
