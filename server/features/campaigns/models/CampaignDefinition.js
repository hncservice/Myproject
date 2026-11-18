'use strict';
const mongoose = require('mongoose');
const nested = fields => new mongoose.Schema(fields, { _id: false, strict: 'throw' });
const schema = new mongoose.Schema({
  campaignId: { type: String, required: true, immutable: true, unique: true },
  name: { type: String, required: true, maxlength: 100 },
  enabled: { type: Boolean, default: false, required: true },
  gameIds: { type: [String], required: true },
  startsAt: { type: String, required: true }, endsAt: { type: String, required: true },
  eligibility: { type: nested({ verifiedEmailRequired: { type: Boolean, enum: [true], required: true }, minAccountAgeHours: { type: Number, min: 0, max: 8760, required: true } }), required: true },
  participation: { type: nested({ maxSessionsPerUser: { type: Number, min: 1, max: 6, required: true }, maxConcurrentSessions: { type: Number, enum: [1], required: true }, allowPriorWinners: { type: Boolean, enum: [false], required: true } }), required: true },
  prizeItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WheelItem' }],
  revision: { type: Number, min: 1, required: true },
  lastRequestId: { type: String, required: true, select: false },
  lastFingerprint: { type: String, required: true, select: false },
}, { timestamps: true, strict: 'throw', versionKey: false });
module.exports = mongoose.model('CampaignDefinition', schema);
