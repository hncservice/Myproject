
'use strict';

const mongoose = require('mongoose');

const User = require('../../authentication/models/User');
const Spin = require('../../games/models/Spin');
const GameSession = require('../../games/models/GameSession');
const PrizeAward = require('../models/PrizeAward');
const PrizeDecision = require('../models/PrizeDecision');

const {
  CAMPAIGN_POLICY,
  GAMES,
} = require('../../../config/gameConfig');

const {
  assessPrizeRisk,
  ASSESSMENT_VERSION,
} = require('../../games/engine/registeredGameAssessments');

// =====================================================
// ERRORS
// =====================================================

function fail(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

function validId(value) {
  return mongoose.isObjectIdOrHexString(value);
}

// =====================================================
// SAFE OUTPUT
// =====================================================

function publicDecision(document, existing = false) {
  return {
    decisionId: String(document._id),
    gameSessionId: String(document.gameSessionId),
    campaignId: document.campaignId,
    gameId: document.gameId,
    status: document.status,

    riskReasons: document.riskReasons || [],
    assessmentVersion: document.assessmentVersion,

    existing,
    drawExecuted: false,
    prizeAllocated: false,
    qrGenerated: false,
  };
}

// =====================================================
// CUSTOMER ELIGIBILITY
// =====================================================

async function verifyCustomerEligibility(userId) {
  const user = await User.findById(userId)
    .select('emailVerified hasSpun')
    .lean();

  if (!user) {
    throw fail(
      404,
      'USER_NOT_FOUND',
      'Customer not found'
    );
  }

  if (!user.emailVerified) {
    throw fail(
      403,
      'EMAIL_NOT_VERIFIED',
      'Customer email is not verified'
    );
  }

  if (user.hasSpun === true) {
    throw fail(
      409,
      'PRIZE_ALREADY_AWARDED',
      'Customer already has a legacy prize restriction'
    );
  }

  const existingAward = await PrizeAward.exists({
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
  });

  if (existingAward) {
    throw fail(
      409,
      'PRIZE_ALREADY_AWARDED',
      'Customer already received a campaign prize'
    );
  }

  const legacyWin = await Spin.exists({
    userId,
    status: 'won',
  });

  if (legacyWin) {
    throw fail(
      409,
      'LEGACY_PRIZE_EXISTS',
      'Customer already has a winning Spin'
    );
  }
}

// =====================================================
// LOAD QUALIFIED GAME
// =====================================================

async function loadQualifiedGame(userId, gameSessionId) {
  const game = await GameSession.findOne({
    _id: gameSessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: { $in: Object.keys(GAMES) },
    status: 'completed',
    outcome: 'qualified',
  }).lean();

  if (!game) {
    throw fail(
      403,
      'GAME_NOT_QUALIFIED',
      'No eligible completed game session found'
    );
  }

  return game;
}

// =====================================================
// CREATE OR RETURN EXISTING DECISION
// =====================================================

async function createPrizeDecision({
  userId,
  gameSessionId,
}) {
  // ---------------------------------------------------
  // 1. Validate identifiers
  // ---------------------------------------------------

  if (!validId(userId) || !validId(gameSessionId)) {
    throw fail(
      400,
      'INVALID_IDENTIFIERS',
      'Invalid customer or game session ID'
    );
  }

  // ---------------------------------------------------
  // 2. Verify game ownership and qualification
  // ---------------------------------------------------

  const game = await loadQualifiedGame(
    userId,
    gameSessionId
  );

  // ---------------------------------------------------
  // 3. Return previously recorded decision
  //
  // An existing decision is never rerolled,
  // reassessed or reset by repeated requests.
  // ---------------------------------------------------

  const existing = await PrizeDecision.findOne({
    gameSessionId: game._id,
    userId: game.userId,
    campaignId: game.campaignId,
    gameId: game.gameId,
  }).lean();

  if (existing) {
    return publicDecision(existing, true);
  }

  // ---------------------------------------------------
  // 4. Verify customer eligibility
  // ---------------------------------------------------

  await verifyCustomerEligibility(userId);

  // ---------------------------------------------------
  // 5. Assess persisted server-owned gameplay
  //
  // Never accept client-submitted risk assessment,
  // score, outcome or decision status.
  // ---------------------------------------------------

  const assessment = assessPrizeRisk(game);

  // Defensive fail-closed validation.
  if (
    !assessment ||
    typeof assessment.reviewRequired !== 'boolean' ||
    !Array.isArray(assessment.riskReasons) ||
    !Number.isSafeInteger(
      assessment.assessmentVersion
    ) ||
    assessment.assessmentVersion !==
      ASSESSMENT_VERSION
  ) {
    throw fail(
      503,
      'ASSESSMENT_UNAVAILABLE',
      'Gameplay security assessment unavailable'
    );
  }

  // No detected consistency anomaly means only
  // preliminary readiness, NOT proven human play.
  //
  // The future allocation boundary must enforce
  // additional abuse and account-level controls.
  const status =
    assessment.reviewRequired
      ? 'pending_review'
      : 'ready_for_draw';

  // Never allow a contradictory assessment to
  // produce a ready-for-draw document.
  const riskReasons =
    assessment.riskReasons.length > 0
      ? assessment.riskReasons
      : assessment.reviewRequired
        ? ['ASSESSMENT_REQUIRES_REVIEW']
        : [];

  const safeStatus =
    status === 'ready_for_draw' &&
    riskReasons.length > 0
      ? 'pending_review'
      : status;

  // ---------------------------------------------------
  // 6. Create the decision
  //
  // The unique MongoDB index on gameSessionId
  // provides protection against duplicates.
  // ---------------------------------------------------

  try {
    const created = await PrizeDecision.create({
      userId: game.userId,
      campaignId: game.campaignId,
      gameSessionId: game._id,
      gameId: game.gameId,

      status: safeStatus,
      riskReasons,
      assessmentVersion: ASSESSMENT_VERSION,

      decision: null,
      prizeAwardId: null,
      decidedAt: null,
      reviewedByAdminId: null,
      reviewedAt: null,
    });

    return publicDecision(created, false);
  } catch (error) {
    // -------------------------------------------------
    // 7. Concurrent duplicate request
    //
    // If another request inserted the same decision,
    // return that record without changing its state.
    // -------------------------------------------------

    if (error.code === 11000) {
      const winner = await PrizeDecision.findOne({
        gameSessionId: game._id,
        userId: game.userId,
        campaignId: game.campaignId,
        gameId: game.gameId,
      }).lean();

      if (winner) {
        return publicDecision(winner, true);
      }

      throw fail(
        409,
        'DECISION_CONFLICT',
        'Prize decision changed concurrently'
      );
    }

    throw error;
  }
}

module.exports = {
  createPrizeDecision,
};
