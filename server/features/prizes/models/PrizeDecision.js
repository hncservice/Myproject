
'use strict';

const mongoose = require('mongoose');
const { GAME_IDS } = require('../../../config/gameConfig');

const VALID_GAMES = Object.freeze(
  Object.values(GAME_IDS)
);

const VALID_STATUSES = Object.freeze([
  'pending_review',
  'ready_for_draw',
  'approved',
  'rejected',
  'no_prize',
  'prize_awarded',
]);

const prizeDecisionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },

    campaignId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },

    gameSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      required: true,
      immutable: true,
    },

    gameId: {
      type: String,
      enum: VALID_GAMES,
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: VALID_STATUSES,
      required: true,
      default: 'pending_review',
      index: true,
    },

    riskReasons: {
      type: [{
        type: String,
        trim: true,
        maxlength: 100,
      }],
      default: [],
    },

    assessmentVersion: {
      type: Number,
      required: true,
      default: 2,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Invalid assessment version',
      },
    },

    // Only authenticated administrator review logic
    // may assign these fields.
    reviewedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    decision: {
      type: String,
      enum: [
        'NO_PRIZE',
        'PRIZE_AWARDED',
        null,
      ],
      default: null,
    },

    prizeAwardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrizeAward',
      default: null,
    },

    decidedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
    collection: 'prize_decisions',
  }
);

// =====================================================
// INDEXES
// =====================================================

// One prize-decision record per game session.
prizeDecisionSchema.index(
  { gameSessionId: 1 },
  {
    unique: true,
    name: 'unique_prize_decision_per_session',
  }
);

// Campaign-specific review and decision queues.
prizeDecisionSchema.index(
  {
    campaignId: 1,
    status: 1,
    createdAt: -1,
  },
  {
    name: 'prize_decision_review_queue',
  }
);

// Lookup all decisions belonging to a customer.
prizeDecisionSchema.index(
  {
    userId: 1,
    campaignId: 1,
  },
  {
    name: 'prize_decision_customer_campaign',
  }
);

// =====================================================
// DOCUMENT VALIDATION
// =====================================================

// These rules provide document-level consistency.
// Authorization and state transitions must still be
// enforced by server-side transactional services.
prizeDecisionSchema.pre(
  'validate',
  function validateDecision() {
    const pending =
      this.status === 'pending_review';

    const ready =
      this.status === 'ready_for_draw';

    const approved =
      this.status === 'approved';

    const rejected =
      this.status === 'rejected';

    const noPrize =
      this.status === 'no_prize';

    const awarded =
      this.status === 'prize_awarded';

    // -----------------------------------------------
    // Pending review
    // -----------------------------------------------

    if (pending) {
      if (
        this.decision != null ||
        this.prizeAwardId != null ||
        this.decidedAt != null ||
        this.reviewedByAdminId != null ||
        this.reviewedAt != null
      ) {
        this.invalidate(
          'status',
          'Pending review cannot contain approval or final prize data'
        );
      }
    }

    // -----------------------------------------------
    // Automatically cleared for the draw stage
    // -----------------------------------------------

    if (ready) {
      if (
        this.decision != null ||
        this.prizeAwardId != null ||
        this.decidedAt != null ||
        this.reviewedByAdminId != null ||
        this.reviewedAt != null ||
        this.riskReasons.length !== 0
      ) {
        this.invalidate(
          'status',
          'Ready for draw requires a clean assessment and no review or prize data'
        );
      }
    }

    // -----------------------------------------------
    // Administrator-approved review
    // -----------------------------------------------

    if (approved) {
      if (
        this.reviewedByAdminId == null ||
        this.reviewedAt == null ||
        this.decision != null ||
        this.prizeAwardId != null ||
        this.decidedAt != null
      ) {
        this.invalidate(
          'status',
          'Approved review requires administrator details and no final prize decision'
        );
      }
    }

    // -----------------------------------------------
    // Administrator-rejected review
    // -----------------------------------------------

    if (rejected) {
      if (
        this.reviewedByAdminId == null ||
        this.reviewedAt == null ||
        this.decision != null ||
        this.prizeAwardId != null ||
        this.decidedAt != null
      ) {
        this.invalidate(
          'status',
          'Rejected review requires administrator details and no prize'
        );
      }
    }

    // -----------------------------------------------
    // Final result: No Prize
    // -----------------------------------------------

    if (noPrize) {
      if (
        this.decision !== 'NO_PRIZE' ||
        this.prizeAwardId != null ||
        this.decidedAt == null
      ) {
        this.invalidate(
          'decision',
          'No Prize requires a final NO_PRIZE decision'
        );
      }
    }

    // -----------------------------------------------
    // Final result: Prize Awarded
    // -----------------------------------------------

    if (awarded) {
      if (
        this.decision !== 'PRIZE_AWARDED' ||
        this.prizeAwardId == null ||
        this.decidedAt == null
      ) {
        this.invalidate(
          'decision',
          'Prize awarded requires an award ID and decision time'
        );
      }
    }
  }
);

module.exports = mongoose.model(
  'PrizeDecision',
  prizeDecisionSchema
);
