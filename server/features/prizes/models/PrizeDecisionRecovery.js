
'use strict';

const mongoose = require('mongoose');

const recoverySchema = new mongoose.Schema(
  {
    // ============================================
    // GAME AND CUSTOMER REFERENCES
    // ============================================

    gameSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      required: true,
      immutable: true,
    },

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

    // ============================================
    // RECOVERY STATUS
    // ============================================

    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'retry_scheduled',
        'held',
        'completed',
      ],
      required: true,
      default: 'pending',
    },

    // ============================================
    // RETRY TRACKING
    // ============================================

    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 5,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Invalid recovery attempt count',
      },
    },

    lastErrorCode: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    lastAttemptAt: {
      type: Date,
      default: null,
    },

    nextRetryAt: {
      type: Date,
      default: null,
    },

    // ============================================
    // WORKER CLAIM OWNERSHIP
    // ============================================

    // Time when an active processing claim expires.
    leaseUntil: {
      type: Date,
      default: null,
    },

    // Hash of the worker's claim token.
    // Never expose the raw token in API responses.
    claimTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    // ============================================
    // COMPLETION
    // ============================================

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'prize_decision_recoveries',
    versionKey: '__v',
  }
);

// ============================================
// INDEXES
// ============================================

// One recovery record per GameSession.
recoverySchema.index(
  {
    gameSessionId: 1,
  },
  {
    unique: true,
    name: 'unique_recovery_per_game_session',
  }
);

// Efficient lookup of scheduled retries.
recoverySchema.index(
  {
    campaignId: 1,
    status: 1,
    nextRetryAt: 1,
    createdAt: 1,
  },
  {
    name: 'recovery_due_queue',
  }
);

// Lookup abandoned processing leases.
recoverySchema.index(
  {
    status: 1,
    leaseUntil: 1,
  },
  {
    name: 'recovery_expired_leases',
  }
);

// ============================================
// DOCUMENT VALIDATION
// ============================================

recoverySchema.pre(
  'validate',
  function validateRecoveryState() {
    if (
      this.status === 'processing' &&
      (
        this.leaseUntil == null ||
        this.claimTokenHash == null
      )
    ) {
      this.invalidate(
        'status',
        'Processing requires an active worker claim'
      );
    }

    if (
      this.status === 'retry_scheduled' &&
      this.nextRetryAt == null
    ) {
      this.invalidate(
        'nextRetryAt',
        'Scheduled retry requires a retry time'
      );
    }

    if (
      this.status === 'completed' &&
      this.completedAt == null
    ) {
      this.invalidate(
        'completedAt',
        'Completed recovery requires a completion time'
      );
    }

    if (
      this.status === 'held' &&
      !this.lastErrorCode
    ) {
      this.invalidate(
        'lastErrorCode',
        'Held recovery requires a failure reason'
      );
    }
  }
);

// ============================================
// EXPORT
// ============================================

module.exports = mongoose.model(
  'PrizeDecisionRecovery',
  recoverySchema
);
