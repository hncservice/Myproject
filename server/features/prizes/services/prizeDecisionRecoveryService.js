
'use strict';

const mongoose = require('mongoose');

const GameSession = require('../../games/models/GameSession');
const PrizeDecision = require('../models/PrizeDecision');
const Recovery = require('../models/PrizeDecisionRecovery');
const {
  normalizeRecoveryError,
} = require('./prizeRecoveryErrorNormalizer');
const {
  CAMPAIGN_POLICY,
  GAMES,
} = require('../../../config/gameConfig');

const {
  createPrizeDecision,
} = require('./prizeDecisionCreationService');

const {
  claimRecovery,
  finishRecovery,
} = require('./prizeRecoveryClaimService');

const {
  reconcileExistingDecision,
} = require('./prizeRecoveryReconciliationService');

const SANDBOX_DB = 'hnc_step15q_sandbox';

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;



function validateLimit(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_BATCH_SIZE
  ) {
    throw new Error(
      'Recovery limit must be an integer between 1 and 25'
    );
  }

  return value;
}

function validateSessionIds(sessionIds) {
  if (
    !Array.isArray(sessionIds) ||
    sessionIds.length < 1 ||
    sessionIds.length > MAX_BATCH_SIZE ||
    !sessionIds.every(value =>
      mongoose.isObjectIdOrHexString(value)
    )
  ) {
    throw new Error('Invalid sandbox session filter');
  }

  const normalized = sessionIds.map(
    value => String(value).toLowerCase()
  );

  if (new Set(normalized).size !== normalized.length) {
    throw new Error(
      'Duplicate session IDs are not allowed'
    );
  }

  return normalized.map(
    value => new mongoose.Types.ObjectId(value)
  );
}

function verifyEnvironment() {
  if (
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !== SANDBOX_DB ||
    process.env.NODE_ENV === 'production' ||
    process.env.ALLOCATION_ENABLED !== 'false'
  ) {
    throw new Error(
      'Recovery is restricted to the disabled-allocation sandbox'
    );
  }
}

function safeErrorCode(error) {
  return normalizeRecoveryError(error);
}

async function processRecoverySession(session) {
  const identity = {
    gameSessionId: session._id,
    userId: session.userId,
    campaignId: session.campaignId,
  };

  // A preliminary decision may have been created
  // before the original worker crashed or lost
  // its claim.
  const existing = await PrizeDecision.exists({
    gameSessionId: session._id,
    userId: session.userId,
    campaignId: session.campaignId,
  });

  if (existing) {
    const reconciled =
      await reconcileExistingDecision(identity);

    return reconciled.reconciled
      ? { outcome: 'existing' }
      : {
          outcome: 'skipped',
          reason: reconciled.reason,
        };
  }

  // No preliminary decision: use the normal
  // atomic claim and creation workflow.
  const claim = await claimRecovery(identity);

  if (!claim.claimed) {
    return {
      outcome: 'skipped',
      reason: claim.reason || 'NOT_DUE_OR_HELD',
    };
  }

  let decision;
  let creationError = null;

  try {
    // Another request could have created the
    // decision after the initial existence check.
    const concurrentDecision =
      await PrizeDecision.exists({
        gameSessionId: session._id,
      });

    if (concurrentDecision) {
      await finishRecovery({
        recoveryId: claim.recoveryId,
        token: claim.token,
      });

      return {
        outcome: 'existing',
      };
    }

    decision = await createPrizeDecision({
      userId: session.userId,
      gameSessionId: session._id,
    });
  } catch (error) {
    creationError = error;
  }

  if (creationError) {
    const code = safeErrorCode(creationError);

    try {
      const finished = await finishRecovery({
        recoveryId: claim.recoveryId,
        token: claim.token,
        errorCode: code,
      });

      return {
        outcome: 'failed',
        code,
        recoveryStatus: finished.status,
        nextRetryAt: finished.nextRetryAt,
      };
    } catch (finalizationError) {
      return {
        outcome: 'failed',
        code: safeErrorCode(finalizationError),
        recoveryStatus: 'UNKNOWN',
      };
    }
  }

  try {
    await finishRecovery({
      recoveryId: claim.recoveryId,
      token: claim.token,
    });
  } catch (error) {
    return {
      outcome: 'failed',
      code: safeErrorCode(error),
      recoveryStatus: 'UNKNOWN',
    };
  }

  return {
    outcome: decision.existing
      ? 'existing'
      : 'created',
    status: decision.status,
  };
}

async function recoverMissingPrizeDecisions({
  limit = DEFAULT_BATCH_SIZE,
  sessionIds = null,
} = {}) {
  const batchSize = validateLimit(limit);

  verifyEnvironment();

  // Explicit sandbox fixture IDs remain mandatory.
  const safeIds = validateSessionIds(sessionIds);

  const campaignId = CAMPAIGN_POLICY.campaignId;

  const sessions = await GameSession.aggregate([
    {
      $match: {
        _id: {
          $in: safeIds,
        },

        campaignId,

        gameId: {
          $in: Object.keys(GAMES),
        },

        status: 'completed',
        outcome: 'qualified',
      },
    },

    // Detect existing preliminary decisions.
    {
      $lookup: {
        from: PrizeDecision.collection.name,
        localField: '_id',
        foreignField: 'gameSessionId',
        as: 'existingDecisions',
      },
    },

    // Also inspect recovery tracking status.
    {
      $lookup: {
        from: Recovery.collection.name,
        localField: '_id',
        foreignField: 'gameSessionId',
        as: 'recoveryRecords',
      },
    },

    // Include:
    // 1. Missing decisions requiring recovery.
    // 2. Existing decisions with unfinished
    //    recovery tracking.
    //
    // Final ownership checks occur later.
    {
      $match: {
        $or: [
          {
            existingDecisions: {
              $size: 0,
            },
          },
          {
            recoveryRecords: {
              $elemMatch: {
                status: {
                  $in: [
                    'pending',
                    'retry_scheduled',
                    'processing',
                  ],
                },
              },
            },
          },
        ],
      },
    },

    {
      $sort: {
        completedAt: 1,
        _id: 1,
      },
    },

    {
      $limit: batchSize,
    },

    {
      $project: {
        _id: 1,
        userId: 1,
        campaignId: 1,
        gameId: 1,
        completedAt: 1,
      },
    },
  ]);

  const result = {
    campaignId,

    scanned: sessions.length,
    created: 0,
    existing: 0,
    skipped: 0,
    failed: 0,

    failures: [],

    drawExecuted: false,
    prizeAllocated: false,
    qrGenerated: false,
  };

  // Process sequentially to limit Atlas M0 load.
  for (const session of sessions) {
    try {
      const processed =
        await processRecoverySession(session);

      if (processed.outcome === 'created') {
        result.created++;
      } else if (processed.outcome === 'existing') {
        result.existing++;
      } else if (processed.outcome === 'skipped') {
        result.skipped++;
      } else {
        result.failed++;

        result.failures.push({
          gameSessionId: String(session._id),
          code: processed.code || 'RECOVERY_FAILED',
          recoveryStatus:
            processed.recoveryStatus || 'UNKNOWN',
        });
      }
    } catch (error) {
      result.failed++;

      result.failures.push({
        gameSessionId: String(session._id),
        code: safeErrorCode(error),
        recoveryStatus: 'UNKNOWN',
      });
    }
  }

  return result;
}

module.exports = {
  recoverMissingPrizeDecisions,
};
