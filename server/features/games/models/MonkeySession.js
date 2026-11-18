// const mongoose = require('mongoose');

// const MonkeySessionSchema = new mongoose.Schema(
//   {
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },

//     // status
//     status: { type: String, enum: ['active', 'finished', 'cancelled', 'expired'], default: 'active', index: true },

//     // game details
//     requiredHits: { type: Number, default: 7 },
//     maxRounds: { type: Number, default: 20 },

//     hits: { type: Number, default: 0 },
//     misses: { type: Number, default: 0 },
//     rounds: { type: Number, default: 0 },
//     result: { type: String, enum: ['win', 'lose', null], default: null },

//     // expiry
//     startedAt: { type: Date, default: Date.now },
//     expiresAt: { type: Date, index: true, required: true },

//     // anti-replay/finish protection
//     finishNonce: { type: String, required: true },
//   },
//   { timestamps: true }
// );

// MonkeySessionSchema.index({ userId: 1, status: 1 });

// module.exports = mongoose.model('MonkeySession', MonkeySessionSchema);
