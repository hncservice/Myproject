'use strict';

const mongoose = require('mongoose');

const User = require('../../authentication/models/User');
const GameSession = require('../models/GameSession');
const PrizeAward = require('../../prizes/models/PrizeAward');
const { loadCampaignStatus, readCampaignGame } = require('./managedCampaignStatus');

const {
  CAMPAIGN_POLICY,
  MANAGED_CAMPAIGN_ID,
  GAMES,
} = require('../../../config/gameConfig');

// ================================================
// ERROR HELPER
// ================================================

function httpError(status, message, code) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

// ================================================
// USER ID VALIDATION
// ================================================

function normalizeUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw httpError(
      401,
      'Invalid authenticated user',
      'INVALID_USER'
    );
  }

  return new mongoose.Types.ObjectId(String(userId));
}

// ================================================
// GET ALL GAME STATUS
// ================================================

async function managedGameStatus(userId) {
  const state = await loadCampaignStatus(userId, Date.now());
  const { facts, definition } = state;

  return {
    campaignId: definition.campaignId,
    hasPrize: facts.hasPrize,
    gamesLockedAfterPrize: facts.hasPrize,
    emailVerified: facts.emailVerified,
    games: Object.values(GAMES).map(config => readCampaignGame(state, config).view),
  };
}

async function getGameStatus(userId) {
  const userObjectId = normalizeUserId(userId);

  if (MANAGED_CAMPAIGN_ID) {
    return managedGameStatus(userObjectId);
  }

  const campaignId = CAMPAIGN_POLICY.campaignId;

  // Get account, shared prize ownership and attempts.
  const [user, existingAward, attemptCounts] =
    await Promise.all([
      User.findById(userObjectId)
        .select('emailVerified hasSpun isActive')
        .lean(),

      PrizeAward.findOne({
        userId: userObjectId,
        campaignId,
      })
        .select('_id')
        .lean(),

      GameSession.aggregate([
        {
          $match: {
            userId: userObjectId,
            campaignId,
          },
        },
        {
          $group: {
            _id: '$gameId',
            used: { $sum: 1 },
          },
        },
      ]),
    ]);

  if (!user) {
    throw httpError(
      404,
      'User not found',
      'USER_NOT_FOUND'
    );
  }

  if (user.isActive === false) throw httpError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
  const hasPrize = Boolean(existingAward) || user.hasSpun === true;

  const emailVerified = Boolean(
    user.emailVerified
  );

  const usedByGame = new Map(
    attemptCounts.map(({ _id, used }) => [
      _id,
      used,
    ])
  );

  // Independent attempts for Monkey / Perfect Shot.
  const games = Object.values(GAMES).map(
    (config) => {
      const attemptsUsed =
        usedByGame.get(config.id) || 0;

      const attemptsLeft = Math.max(
        0,
        config.maxAttempts - attemptsUsed
      );

      // Shared prize award locks both games.
      const locked =
        hasPrize ||
        !emailVerified ||
        attemptsLeft === 0;

      let lockReason = null;

      if (hasPrize) {
        lockReason = 'PRIZE_ALREADY_AWARDED';
      } else if (!emailVerified) {
        lockReason = 'EMAIL_NOT_VERIFIED';
      } else if (attemptsLeft === 0) {
        lockReason = 'NO_ATTEMPTS_LEFT';
      }

      return {
        id: config.id,
        label: config.label,

        maxAttempts: config.maxAttempts,
        attemptsUsed,
        attemptsLeft,

        locked,
        lockReason,
      };
    }
  );

  return {
    campaignId,

    hasPrize,

    gamesLockedAfterPrize: hasPrize,

    emailVerified,

    games,
  };
}

module.exports = {
  getGameStatus,
};
