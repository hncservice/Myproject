
'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');

const Recovery = require('../models/PrizeDecisionRecovery');

const {
  classifyRecoveryFailure,
} = require('./prizeRecoveryFailureClassifier');

const SANDBOX_DB = 'hnc_step15q_sandbox';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 120000;

const RETRY_DELAYS_MS = Object.freeze([
  60000,
  300000,
  900000,
  3600000,
]);

function fail(code, message) {
  return Object.assign(
    new Error(message),
    { code }
  );
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
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
      'Recovery claims are restricted to the sandbox'
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
      'Invalid recovery identity'
    );
  }
}

// =====================================================
// CREATE OR LOAD TRACKING RECORD
// =====================================================

async function ensureRecoveryRecord({
  gameSessionId,
  userId,
  campaignId,
}) {
  assertSandbox();

  validateIdentity({
    gameSessionId,
    userId,
    campaignId,
  });

  const identity = {
    gameSessionId: new mongoose.Types.ObjectId(
      gameSessionId
    ),
  };

  try {
    await Recovery.updateOne(
      identity,
      {
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(userId),
          campaignId,
          status: 'pending',
          attempts: 0,
        },
      },
      {
        upsert: true,
        runValidators: true,
      }
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }

  const record = await Recovery.findOne(identity);

  if (
    !record ||
    String(record.userId) !== String(userId) ||
    record.campaignId !== campaignId
  ) {
    throw fail(
      'RECOVERY_IDENTITY_CONFLICT',
      'Recovery identity mismatch'
    );
  }

  return record;
}

// =====================================================
// ATOMIC CLAIM
// =====================================================

async function claimRecovery({
  gameSessionId,
  userId,
  campaignId,
}) {
  assertSandbox();

  await ensureRecoveryRecord({
    gameSessionId,
    userId,
    campaignId,
  });

  const token = crypto
    .randomBytes(32)
    .toString('hex');

  const now = new Date();

  const claimed = await Recovery.findOneAndUpdate(
    {
      gameSessionId,
      userId,
      campaignId,

      attempts: {
        $lt: MAX_ATTEMPTS,
      },

      $or: [
        {
          status: 'pending',
        },
        {
          status: 'retry_scheduled',
          nextRetryAt: {
            $lte: now,
          },
        },
        {
          status: 'processing',
          leaseUntil: {
            $lte: now,
          },
        },
      ],
    },
    {
      $set: {
        status: 'processing',
        leaseUntil: new Date(
          now.getTime() + LEASE_MS
        ),
        claimTokenHash: hashToken(token),
        lastAttemptAt: now,
        nextRetryAt: null,
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!claimed) {
    return {
      claimed: false,
      reason: 'NOT_DUE_OR_HELD',
    };
  }

  return {
    claimed: true,
    token,
    recoveryId: String(claimed._id),
    attempts: claimed.attempts,
    leaseUntil: claimed.leaseUntil,
  };
}

// =====================================================
// FINALIZE CLAIM
// =====================================================

async function finishRecovery({
  recoveryId,
  token,
  errorCode = null,
}) {
  assertSandbox();

  if (
    !mongoose.isObjectIdOrHexString(recoveryId) ||
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    throw fail(
      'INVALID_CLAIM',
      'Invalid recovery claim'
    );
  }

  // Classify before modifying the database.
  // null is success; every supplied error
  // code represents a failed attempt.
  const failure = errorCode === null
    ? null
    : classifyRecoveryFailure(errorCode);

  const current = await Recovery.findOne({
    _id: recoveryId,
    status: 'processing',
    claimTokenHash: hashToken(token),
    leaseUntil: {
      $gt: new Date(),
    },
  }).select('+claimTokenHash');

  if (!current) {
    throw fail(
      'CLAIM_EXPIRED',
      'Recovery claim expired or changed'
    );
  }

  const now = new Date();

  const exhausted =
    current.attempts >= MAX_ATTEMPTS;

  let status;
  let nextRetryAt = null;
  let completedAt = null;

  if (!failure) {
    status = 'completed';
    completedAt = now;
  } else if (
    !failure.retryable ||
    exhausted
  ) {
    status = 'held';
  } else {
    status = 'retry_scheduled';

    const delayIndex = Math.min(
      Math.max(current.attempts - 1, 0),
      RETRY_DELAYS_MS.length - 1
    );

    nextRetryAt = new Date(
      now.getTime() +
      RETRY_DELAYS_MS[delayIndex]
    );
  }

  // Claim-token and lease predicates fence out
  // expired or replaced workers.
  const updated = await Recovery.findOneAndUpdate(
    {
      _id: current._id,
      status: 'processing',
      claimTokenHash: hashToken(token),
      leaseUntil: {
        $gt: now,
      },
      attempts: current.attempts,
    },
    {
      $set: {
        status,
        lastErrorCode: failure
          ? failure.code
          : null,
        nextRetryAt,
        completedAt,
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
    throw fail(
      'CLAIM_CONFLICT',
      'Recovery claim changed concurrently'
    );
  }

  return {
    status: updated.status,
    attempts: updated.attempts,
    nextRetryAt: updated.nextRetryAt,
    lastErrorCode: updated.lastErrorCode,
    failureCategory: failure
      ? failure.category
      : null,
    exhausted: Boolean(failure && exhausted),
  };
}

module.exports = {
  ensureRecoveryRecord,
  claimRecovery,
  finishRecovery,
};
