'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../../authentication/models/User');
const GameSession = require('../models/GameSession');
const PrizeAward = require('../../prizes/models/PrizeAward');
const { loadCampaignStatus, readCampaignGame } = require('./managedCampaignStatus');

const {
  CAMPAIGN_POLICY,
  MANAGED_CAMPAIGN_ID,
  getGameConfig,
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
// SESSION TOKEN
// ================================================

// Session credential only.
// This token does not prove a game win.
function createSessionToken(session) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(
      `${session._id}:${session.userId}:${session.campaignId}:${session.gameId}`
    )
    .digest('hex');
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

// ================================================
// RESPONSE FORMAT
// ================================================

function formatSession(session, config, resumed, campaignAttemptsLeft = Infinity) {
  return {
    sessionId: String(session._id),
    sessionToken: createSessionToken(session),

    campaignId: session.campaignId,
    gameId: session.gameId,

    attemptNumber: session.attemptNumber,
    maxAttempts: config.maxAttempts,

    attemptsLeft: Math.max(
      0,
      Math.min(config.maxAttempts - session.attemptNumber, campaignAttemptsLeft)
    ),

    startedAt: session.startedAt,
    expiresAt: session.expiresAt,

    resumed: Boolean(resumed),
  };
}

// ================================================
// SHARED PRIZE ELIGIBILITY
// ================================================

async function checkCustomerEligibility(
  userObjectId,
  campaignId
) {
  const [user, existingAward] = await Promise.all([
    User.findById(userObjectId)
      .select('emailVerified hasSpun isActive')
      .lean(),

    PrizeAward.findOne({
      userId: userObjectId,
      campaignId,
    })
      .select('_id')
      .lean(),
  ]);

  if (!user) {
    throw httpError(
      404,
      'User not found',
      'USER_NOT_FOUND'
    );
  }

  if (!user.emailVerified) {
    throw httpError(
      403,
      'Verify your email first',
      'EMAIL_NOT_VERIFIED'
    );
  }
  if (user.isActive === false) throw httpError(403, 'Account is disabled', 'ACCOUNT_DISABLED');

  if (existingAward || user.hasSpun === true) {
    throw httpError(
      409,
      'Prize already awarded in this campaign. Both games are locked.',
      'PRIZE_ALREADY_AWARDED'
    );
  }
}

// ================================================
// EXPIRE OLD SESSION
// ================================================

async function expireOldSession(activeSession, now) {
  if (!activeSession) {
    return;
  }

  if (new Date(activeSession.expiresAt).getTime() > now.getTime()) {
    return;
  }

  await GameSession.updateOne(
    {
      _id: activeSession._id,
      status: 'active',
      expiresAt: { $lte: now },
    },
    {
      $set: {
        status: 'expired',
        outcome: 'not-qualified',
      },
    }
  );
}

// ================================================
// START OR RESUME GAME
// ================================================

async function startManagedGame(userId, config) {
  const now = new Date();
  const campaignId = MANAGED_CAMPAIGN_ID;
  const state = await loadCampaignStatus(userId, now.getTime());
  const { active, view } = readCampaignGame(state, config);

  if (view.locked) {
    const status = ['ACCOUNT_NOT_ELIGIBLE', 'ACCOUNT_TOO_NEW'].includes(view.lockReason) ? 403 : 409;
    throw httpError(status, 'Unable to start this campaign game', view.lockReason);
  }
  if (active) return formatSession(active, config, true, view.attemptsLeft);

  await GameSession.updateMany({
    userId,
    campaignId,
    status: 'active',
    expiresAt: { $lte: now },
  }, {
    $set: { status: 'expired', outcome: 'not-qualified' },
  });

  const session = new GameSession({
    userId,
    campaignId,
    gameId: config.id,
    attemptNumber: view.attemptsUsed + 1,
    campaignAttemptNumber: state.facts.sessionsUsed + 1,
    status: 'active',
    outcome: null,
    startedAt: now,
    expiresAt: new Date(now.getTime() + config.sessionTtlMs),
  });
  session.sessionTokenHash = hashToken(createSessionToken(session));

  try {
    await session.save();
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, 'Concurrent start detected. Refresh game status and retry.', 'START_CONFLICT');
    }
    throw error;
  }

  return formatSession(session, config, false, view.attemptsLeft - 1);
}

async function startGame(userId, gameId) {
  const config = getGameConfig(gameId);

  if (!config) {
    throw httpError(
      404,
      'Unknown game',
      'UNKNOWN_GAME'
    );
  }

  const userObjectId = normalizeUserId(userId);

  if (MANAGED_CAMPAIGN_ID) {
    return startManagedGame(userObjectId, config);
  }

  const campaignId = CAMPAIGN_POLICY.campaignId;

  const baseFilter = {
    userId: userObjectId,
    campaignId,
    gameId,
  };

  // 1. Check verified user and shared prize ownership.
  await checkCustomerEligibility(
    userObjectId,
    campaignId
  );

  // 2. Find an active session for this game.
  const now = new Date();

  const activeSession = await GameSession.findOne({
    ...baseFilter,
    status: 'active',
  });

  if (activeSession) {
    // Refresh/repeated Start should resume the same
    // session without consuming another attempt.
    if (
      new Date(activeSession.expiresAt).getTime() >
      now.getTime()
    ) {
      return formatSession(
        activeSession,
        config,
        true
      );
    }

    // Expire previous session if its TTL passed.
    await expireOldSession(activeSession, now);
  }

  // 3. Count all previous attempts for this game.
  // Completed, expired and cancelled attempts count.
  const attemptsUsed = await GameSession.countDocuments(
    baseFilter
  );

  if (attemptsUsed >= config.maxAttempts) {
    throw httpError(
      409,
      'No attempts left for this game',
      'NO_ATTEMPTS_LEFT'
    );
  }

  // 4. Create a new attempt.
  const startedAt = new Date();

  const session = new GameSession({
    ...baseFilter,

    attemptNumber: attemptsUsed + 1,

    status: 'active',
    outcome: null,

    startedAt,

    expiresAt: new Date(
      startedAt.getTime() + config.sessionTtlMs
    ),
  });

  const token = createSessionToken(session);

  session.sessionTokenHash = hashToken(token);

  // 5. Save the attempt.
  // GameSession's unique indexes protect simultaneous
  // requests from creating duplicate attempt numbers.
  try {
    await session.save();
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(
        409,
        'Concurrent start detected. Refresh game status and retry.',
        'START_CONFLICT'
      );
    }

    throw error;
  }

  return formatSession(
    session,
    config,
    false
  );
}

module.exports = {
  startGame,
  checkCustomerEligibility,
};
