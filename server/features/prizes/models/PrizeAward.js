'use strict';

const mongoose = require('mongoose');

const prizeAwardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    campaignId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },

    // Monkey or Perfect Shot game session
    gameSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      default: null,
      immutable: true,
    },

    // QR redemption record for a GameSession-sourced award.
    // This is a delivery link, not a second award source.
    redemptionSpinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Spin',
      default: null,
      immutable: true,
    },

    // Legacy Spin reference
    spinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Spin',
      default: null,
      immutable: true,
    },

    wheelItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WheelItem',
      required: true,
      immutable: true,
    },

    awardedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

// Only one prize per customer per campaign
prizeAwardSchema.index(
  { userId: 1, campaignId: 1 },
  {
    unique: true,
    name: 'one_prize_per_user_per_campaign',
  }
);

// A legacy spin cannot issue multiple awards
prizeAwardSchema.index(
  { spinId: 1 },
  {
    unique: true,
    name: 'unique_prize_spin',
    partialFilterExpression: {
      spinId: { $type: 'objectId' },
    },
  }
);

// A redemption Spin cannot be linked to multiple game awards.
prizeAwardSchema.index(
  { redemptionSpinId: 1 },
  {
    unique: true,
    name: 'unique_award_redemption_spin',
    partialFilterExpression: {
      redemptionSpinId: { $type: 'objectId' },
    },
  }
);

// A game session cannot issue multiple awards
prizeAwardSchema.index(
  { gameSessionId: 1 },
  {
    unique: true,
    name: 'unique_game_session_award',
    partialFilterExpression: {
      gameSessionId: { $type: 'objectId' },
    },
  }
);

/**
 * PrizeAward must originate from exactly one source:
 * - Legacy Spin, OR
 * - Monkey / Perfect Shot GameSession
 *
 * Both missing and both present are invalid.
 */
prizeAwardSchema.pre('validate', function validateSource() {
  const hasSpin = this.spinId != null;
  const hasGameSession = this.gameSessionId != null;

  if (hasSpin === hasGameSession) {
    this.invalidate(
      'gameSessionId',
      'PrizeAward must reference exactly one source: Spin or GameSession'
    );
  }
});

module.exports = mongoose.model('PrizeAward', prizeAwardSchema);
