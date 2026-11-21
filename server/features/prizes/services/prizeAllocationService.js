
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const WheelItem = require('../models/WheelItem');
const GameSession = require('../../games/models/GameSession');
const PrizeAward = require('../models/PrizeAward');
const Spin = require('../../games/models/Spin');
const User = require('../../authentication/models/User');
const PrizeDecision = require('../models/PrizeDecision');

const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');

// =====================================================
// CONFIGURATION
// =====================================================

// Relative weight for receiving no prize.
const NO_PRIZE_WEIGHT = 40;

// SECURITY: Keep false until anti-cheat, migration,
// index verification and concurrency tests are complete.
// const ALLOCATION_ENABLED = false;
const ALLOCATION_ENABLED = process.env.ALLOCATION_ENABLED === 'true';

const VALID_GAMES = ['monkey', 'perfect-shot', 'burger-run'];

const MAX_RANDOM_RANGE = 281474976710655;

// =====================================================
// HELPERS
// =====================================================

function allocationError(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

function toUnits(weight) {
  const value = Number(weight);

  if (!Number.isFinite(value) || value < 0) {
    throw allocationError(
      400,
      'INVALID_WEIGHT',
      'Invalid prize probability weight'
    );
  }

  const units = Math.round(value * 1000);

  if (!Number.isSafeInteger(units)) {
    throw allocationError(
      400,
      'INVALID_WEIGHT',
      'Prize probability weight is too large'
    );
  }

  return units;
}

function weightedSelect(items, noPrizeWeight = NO_PRIZE_WEIGHT) {
  const choices = items
    .map((item) => ({
      item,
      weight: toUnits(item.probabilityWeight),
    }))
    .filter((entry) => entry.weight > 0);

  choices.push({
    item: null,
    weight: toUnits(noPrizeWeight),
  });

  const totalWeight = choices.reduce(
    (sum, entry) => sum + entry.weight,
    0
  );

  if (
    !Number.isSafeInteger(totalWeight) ||
    totalWeight <= 0 ||
    totalWeight > MAX_RANDOM_RANGE
  ) {
    throw allocationError(
      400,
      'INVALID_TOTAL_WEIGHT',
      'Invalid total probability weight'
    );
  }

  const selectedNumber = crypto.randomInt(totalWeight);

  let cumulative = 0;

  for (const choice of choices) {
    cumulative += choice.weight;

    if (selectedNumber < cumulative) {
      return choice.item;
    }
  }

  throw new Error('Prize selection failed');
}

function hasAvailableStock(item) {
  if (!item || !item.isActive) {
    return false;
  }

  const allocated = item.quantityAllocated ?? 0;

  if (!Number.isInteger(allocated) || allocated < 0) {
    return false;
  }

  if (item.quantityTotal == null) {
    return true;
  }

  return (
    Number.isInteger(item.quantityTotal) &&
    allocated < item.quantityTotal
  );
}

function validateIds(userId, gameSessionId) {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(gameSessionId)
  ) {
    throw allocationError(
      400,
      'INVALID_IDENTIFIERS',
      'Invalid user or game session ID'
    );
  }
}

// =====================================================
// INVENTORY
// =====================================================

async function getAvailablePrizeItems(session = null) {
  const query = WheelItem.find({
    isActive: true,
    probabilityWeight: { $gt: 0 },
  }).lean();

  if (session) {
    query.session(session);
  }

  const items = await query;

  return items.filter(hasAvailableStock);
}

// =====================================================
// READ-ONLY SIMULATION
// =====================================================

async function simulatePrizeAllocation({
  userId,
  gameSessionId,
}) {
  validateIds(userId, gameSessionId);

  const gameSession = await GameSession.findOne({
    _id: gameSessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: { $in: VALID_GAMES },
    status: 'completed',
    outcome: 'qualified',
  }).lean();

  if (!gameSession) {
    return {
      eligible: false,
      reason: 'GAME_NOT_QUALIFIED',
      simulated: true,
    };
  }

  const existingAward = await PrizeAward.findOne({
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
  }).lean();

  if (existingAward) {
    return {
      eligible: false,
      reason: 'ALREADY_AWARDED',
      simulated: true,
    };
  }

  // A previously resolved game session cannot be rerolled.
  if (gameSession.gameState?.prizeDecision) {
    return {
      eligible: false,
      reason: 'SESSION_ALREADY_RESOLVED',
      simulated: true,
    };
  }

  const items = await getAvailablePrizeItems();

  const selected = weightedSelect(items);

  return {
    eligible: true,
    simulated: true,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: gameSession.gameId,
    result: selected ? 'SIMULATED_PRIZE' : 'NO_PRIZE',
    selectedPrize: selected
      ? {
          id: String(selected._id),
          title: selected.title,
        }
      : null,
    awardCreated: false,
    inventoryChanged: false,
  };
}

// =====================================================
// REAL TRANSACTION - DISABLED BY DEFAULT
// =====================================================

// This function is intentionally private.
// It must never be exposed directly through a user API.
//
// Prerequisites before activation:
// - Verified PrizeAward unique indexes
// - Reconciled WheelItem inventory
// - Secure, tamper-resistant gameplay validation
// - Transaction-capable MongoDB deployment
// - Tested retry / duplicate request handling
// - Safe QR redemption flow

async function performAllocationTransaction({
  userId,
  gameSessionId,
}) {
  

  return mongoose.connection.transaction(
    async (session) => {
      // -----------------------------------------------
      // 1. Verify user
      // -----------------------------------------------
      const user = await User.findById(userId)
        .session(session);

      if (!user) {
        throw allocationError(
          404,
          'USER_NOT_FOUND',
          'Customer not found'
        );
      }

      if (!user.emailVerified) {
        throw allocationError(
          403,
          'EMAIL_NOT_VERIFIED',
          'Customer email is not verified'
        );
      }

      // -----------------------------------------------
      // 2. Serialize prize decisions per customer
      // -----------------------------------------------
      // Force a REAL write on the User document inside this
      // transaction. Two transactions for different qualified
      // game sessions of the same customer cannot both commit
      // against the same stale snapshot: one encounters a write
      // conflict and MongoDB transaction retry rechecks awards.
      //
      // Use the native collection method deliberately: Mongoose
      // strict update mode may discard unmodelled $inc paths.
      // prizeAllocationFence is internal bookkeeping only.
      const fence = await User.collection.updateOne(
        { _id: user._id },
        { $inc: { prizeAllocationFence: 1 } },
        { session }
      );

      if (fence.matchedCount !== 1 || fence.modifiedCount !== 1) {
        throw allocationError(
          409,
          'ALLOCATION_FENCE_FAILED',
          'Could not acquire customer allocation fence'
        );
      }

      // -----------------------------------------------
      // 3. Verify completed qualified game
      // -----------------------------------------------
      const game = await GameSession.findOne({
        _id: gameSessionId,
        userId,
        campaignId: CAMPAIGN_POLICY.campaignId,
        gameId: { $in: VALID_GAMES },
        status: 'completed',
        outcome: 'qualified',
      })
        .session(session);

      if (!game) {
        throw allocationError(
          403,
          'GAME_NOT_QUALIFIED',
          'No eligible completed game session found'
        );
      }

      // Prevent rerolling the same session.
      if (game.gameState?.prizeDecision) {
        return {
          status: 'ALREADY_RESOLVED',
          decision: game.gameState.prizeDecision,
          awardCreated: false,
        };

      }

      // Require the persisted server-owned review decision.
      const prizeDecision = await PrizeDecision.findOne({
        gameSessionId: game._id,
        userId: game.userId,
        campaignId: game.campaignId,
        gameId: game.gameId,
      }).session(session);

      if (!prizeDecision) {
        throw allocationError(
          409,
          'PRIZE_DECISION_REQUIRED',
          'A preliminary prize decision is required'
        );
      }

      if (
        !['ready_for_draw', 'approved'].includes(prizeDecision.status)
      ) {
        throw allocationError(
          409,
          'PRIZE_DECISION_NOT_DRAWABLE',
          'Prize decision is not eligible for allocation'
        );
      }

      // Run document validation, including review metadata
      // and the clean-assessment rule for ready_for_draw.
      try {
        await prizeDecision.validate();
      } catch (error) {
        if (error.name !== 'ValidationError') throw error;
        throw allocationError(
          409,
          'INVALID_PRIZE_DECISION',
          'Prize decision requires administrator review'
        );
      }

      // -----------------------------------------------
      // 4. Check shared one-prize rule
      // -----------------------------------------------
      const existingAward = await PrizeAward.findOne({
        userId,
        campaignId: CAMPAIGN_POLICY.campaignId,
      }).session(session);

      if (existingAward) {
        return {
          status: 'ALREADY_AWARDED',
          awardId: String(existingAward._id),
          awardCreated: false,
        };

      }

      // -----------------------------------------------
      // 5. Select prize based on probability
      // -----------------------------------------------
      const availableItems =
        await getAvailablePrizeItems(session);

      const selectedPrize = weightedSelect(
        availableItems,
        NO_PRIZE_WEIGHT
      );

      const decidedAt = new Date();

      // -----------------------------------------------
      // 6. No Prize outcome
      // -----------------------------------------------
      if (!selectedPrize) {
        // Persist decision to prevent repeated draws
        // for the same completed game session.
        const decisionUpdate = await GameSession.updateOne(
          {
            _id: game._id,
            status: 'completed',
            outcome: 'qualified',
            'gameState.prizeDecision': { $exists: false },
          },
          {
            $set: {
              'gameState.prizeDecision': {
                result: 'NO_PRIZE',
                decidedAt,
              },
            },
          },
          { session }
        );

        if (decisionUpdate.modifiedCount !== 1) {
          throw allocationError(
            409,
            'DECISION_CONFLICT',
            'Prize decision was already processed'
          );
        }

        prizeDecision.set({
          status: 'no_prize',
          decision: 'NO_PRIZE',
          prizeAwardId: null,
          decidedAt,
        });
        await prizeDecision.save({ session });

        return {
          status: 'NO_PRIZE',
          campaignId: CAMPAIGN_POLICY.campaignId,
          gameId: game.gameId,
          awardCreated: false,
        };

      }

      // -----------------------------------------------
      // 7. Atomically reserve inventory
      // -----------------------------------------------

      // The $expr condition compares allocated stock
      // with total capacity inside MongoDB.
      const inventoryUpdate =
        await WheelItem.updateOne(
          {
            _id: selectedPrize._id,
            isActive: true,
            $expr: {
              $or: [
                { $eq: ['$quantityTotal', null] },
                {
                  $lt: [
                    { $ifNull: ['$quantityAllocated', 0] },
                    '$quantityTotal',
                  ],
                },
              ],
            },
          },
          {
            $inc: {
              quantityAllocated: 1,
            },
          },
          { session }
        );

      if (inventoryUpdate.modifiedCount !== 1) {
        throw allocationError(
          409,
          'STOCK_CONFLICT',
          'Selected prize is no longer available'
        );
      }

      // -----------------------------------------------
      // 8. Generate unique redemption token
      // -----------------------------------------------
      const qrToken = crypto
        .randomBytes(32)
        .toString('hex');

      // Create Spin for compatibility with the
      // existing vendor QR redemption system.
      const [spin] = await Spin.create(
        [
          {
            userId,
            wheelItemId: selectedPrize._id,
            status: 'won',
            qrToken,
            qrExpiry: null,
            redemptionStatus: 'pending',
            emailSent: false,
          },
        ],
        { session }
      );

      // -----------------------------------------------
      // 9. Create shared award ownership record
      // -----------------------------------------------

      // Prerequisite:
      // PrizeAward schema must support a gameSessionId
      // and a nullable spinId, or a compatible source
      // representation. See notes below.
      const [award] = await PrizeAward.create(
        [
          {
            userId,
            campaignId: CAMPAIGN_POLICY.campaignId,
            gameSessionId: game._id,
            redemptionSpinId: spin._id,
            wheelItemId: selectedPrize._id,
            awardedAt: decidedAt,
          },
        ],
        { session }
      );

      // -----------------------------------------------
      // 10. Mark decision on the game session
      // -----------------------------------------------
      const decisionUpdate = await GameSession.updateOne(
        {
          _id: game._id,
          status: 'completed',
          outcome: 'qualified',
          'gameState.prizeDecision': { $exists: false },
        },
        {
          $set: {
            'gameState.prizeDecision': {
              result: 'PRIZE_AWARDED',
              awardId: award._id,
              decidedAt,
            },
          },
        },
        { session }
      );

      if (decisionUpdate.modifiedCount !== 1) {
        throw allocationError(
          409,
          'DECISION_CONFLICT',
          'Prize decision was already processed'
        );
      }

      // -----------------------------------------------
      // 11. Legacy user lock compatibility
      // -----------------------------------------------
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            hasSpun: true,
          },
        },
        { session }
      );

      prizeDecision.set({
        status: 'prize_awarded',
        decision: 'PRIZE_AWARDED',
        prizeAwardId: award._id,
        decidedAt,
      });
      await prizeDecision.save({ session });

      return {
        status: 'PRIZE_AWARDED',
        campaignId: CAMPAIGN_POLICY.campaignId,
        gameId: game.gameId,
        awardId: String(award._id),
        spinId: String(spin._id),
        prizeId: String(selectedPrize._id),
        prizeTitle: selectedPrize.title,
        awardCreated: true,

        // Never log or expose this token publicly.
        // The authenticated prize-display/redemption
        // workflow will handle QR presentation.
        qrToken,
      };
    },
    {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    }
  );

  
}

// =====================================================
// PUBLIC SERVICE ENTRY POINT
// =====================================================

async function allocatePrize({
  userId,
  gameSessionId,
}) {
  // Fail closed before any database write.
  if (!ALLOCATION_ENABLED) {
    throw allocationError(
      503,
      'PRIZE_ALLOCATION_DISABLED',
      'Real prize allocation is disabled pending security validation'
    );
  }

  validateIds(userId, gameSessionId);

  return performAllocationTransaction({
    userId,
    gameSessionId,
  });
}

module.exports = {
  weightedSelect,
  hasAvailableStock,
  getAvailablePrizeItems,
  simulatePrizeAllocation,
  allocatePrize,
};




