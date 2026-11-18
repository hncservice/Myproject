
'use strict';

const mongoose = require('mongoose');

const Recovery = require('../models/PrizeDecisionRecovery');
const PrizeDecision = require('../models/PrizeDecision');

const SANDBOX_DB = 'hnc_step15q_sandbox';

function fail(code, message) {
  return Object.assign(new Error(message), { code });
}

function assertSandbox() {
  if (
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !== SANDBOX_DB ||
    process.env.NODE_ENV === 'production' ||
    process.env.ALLOCATION_ENABLED !== 'false'
  ) {
    throw fail(
      'UNSAFE_RECOVERY_ENVIRONMENT',
      'Reconciliation is restricted to the sandbox'
    );
  }
}

function validateIdentity({
  gameSessionId,
  userId,
  campaignId,
}) {
  if (
    !mongoose.isObjectIdOrHexString(gameSessionId) ||
    !mongoose.isObjectIdOrHexString(userId) ||
    typeof campaignId !== 'string' ||
    !campaignId.trim()
  ) {
    throw fail(
      'INVALID_RECOVERY_IDENTITY',
      'Invalid reconciliation identity'
    );
  }
}

/**
 * Reconcile an incomplete recovery record only when:
 *
 * 1. A matching PrizeDecision already exists.
 * 2. The recovery record belongs to that same user
 *    and campaign.
 * 3. The record is pending, retry_scheduled, or
 *    processing with an expired lease.
 *
 * Never override:
 * - held records
 * - completed records
 * - active worker claims
 *
 * Never create:
 * - PrizeDecision
 * - PrizeAward
 * - Spin
 * - QR tokens
 */
async function reconcileExistingDecision(identity) {
  assertSandbox();
  validateIdentity(identity);

  const {
    gameSessionId,
    userId,
    campaignId,
  } = identity;

  const decision = await PrizeDecision.exists({
    gameSessionId,
    userId,
    campaignId,
  });

  if (!decision) {
    return {
      reconciled: false,
      reason: 'DECISION_NOT_FOUND',
    };
  }

  const now = new Date();

  const updated = await Recovery.findOneAndUpdate(
    {
      gameSessionId,
      userId,
      campaignId,

      $or: [
        {
          status: 'pending',
        },
        {
          status: 'retry_scheduled',
        },
        {
          status: 'processing',
          leaseUntil: { $lte: now },
        },
      ],
    },
    {
      $set: {
        status: 'completed',
        completedAt: now,
        lastErrorCode: null,
        nextRetryAt: null,
        leaseUntil: null,
        claimTokenHash: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updated) {
    return {
      reconciled: false,
      reason: 'NOT_RECONCILABLE',
    };
  }

  return {
    reconciled: true,
    status: updated.status,
    attempts: updated.attempts,
    completedAt: updated.completedAt,
  };
}

module.exports = {
  reconcileExistingDecision,
};
