'use strict';
const mongoose = require('mongoose');
const { GAMES } = require('../../../config/gameConfig');

/**
 * One document per CONSUMED game attempt. The server creates and advances
 * this record; the client must never be trusted to set result or score.
 *
 * Phase 1: additive model only. No endpoint writes GameSession yet.
 */
const gameSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    immutable: true,
  },
  campaignId: { type: String, required: true, immutable: true, trim: true },
  gameId: {
    type: String,
    required: true,
    immutable: true,
    enum: Object.keys(GAMES),
  },
  attemptNumber: {
    type: Number,
    required: true,
    immutable: true,
    min: 1,
    max: 5,
  },
  campaignAttemptNumber: {
  type: Number,
  min: 1,
  max: 6,
  immutable: true,
},
  sessionTokenHash: { type: String, required: true, select: false },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'cancelled'],
    default: 'active',
    index: true,
  },
  outcome: {
    type: String,
    enum: ['qualified', 'not-qualified', null],
    default: null,
  },
  score: { type: Number, min: 0, default: 0 },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  // Server-owned progress for interactive gameplay.
  gameState: { type: mongoose.Schema.Types.Mixed, default: null },
  // Server-authored event record; use bounded events in gameplay service.
  events: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });

// Independently numbered attempts within each game and campaign.
gameSessionSchema.index(
  { userId: 1, campaignId: 1, gameId: 1, attemptNumber: 1 },
  { unique: true, name: 'unique_attempt_per_game' }
);
// User should not hold two active sessions of the same game simultaneously.
gameSessionSchema.index(
  { userId: 1, campaignId: 1, gameId: 1 },
  {
    unique: true,
    name: 'one_active_session_per_game',
    partialFilterExpression: { status: 'active' },
  }
);

gameSessionSchema.index(
  { userId: 1, campaignId: 1, campaignAttemptNumber: 1 },
  {
    unique: true,
    name: 'unique_campaign_attempt_per_user',
    partialFilterExpression: {
      campaignAttemptNumber: { $type: 'number' },
    },
  }
);

gameSessionSchema.index(
  { userId: 1, campaignId: 1 },
  {
    unique: true,
    name: 'one_active_managed_campaign_session_per_user',
    partialFilterExpression: {
      status: 'active',
      campaignAttemptNumber: { $type: 'number' },
    },
  }
);

module.exports = mongoose.model('GameSession', gameSessionSchema);
