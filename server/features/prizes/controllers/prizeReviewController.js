
'use strict';

const mongoose = require('mongoose');

const PrizeDecision = require('../models/PrizeDecision');
const GameSession = require('../../games/models/GameSession');
const { reviewEvidence } = require('../services/prizeReviewEvidenceService');

const {
  reviewPrizeDecision,
} = require('../services/prizeReviewService');

const {
  CAMPAIGN_POLICY,
} = require('../../../config/gameConfig');

const ALLOWED_STATUSES = new Set([
  'pending_review',
  'approved',
  'rejected',
  'no_prize',
  'prize_awarded',
]);

function fail(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

function validId(value) {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{24}$/i.test(value) &&
    mongoose.isValidObjectId(value)
  );
}

function positiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;

  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw fail(
      400,
      'INVALID_PAGINATION',
      'Invalid pagination parameter'
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed > maximum
  ) {
    throw fail(
      400,
      'INVALID_PAGINATION',
      'Pagination value is out of range'
    );
  }

  return parsed;
}

function publicDecision(item) {
  return {
    id: String(item._id),
    userId: String(item.userId),
    gameSessionId: String(item.gameSessionId),
    campaignId: item.campaignId,
    gameId: item.gameId,
    status: item.status,
    riskReasons: item.riskReasons || [],
    assessmentVersion: item.assessmentVersion,
    reviewedAt: item.reviewedAt || null,
    reviewedByAdminId: item.reviewedByAdminId
      ? String(item.reviewedByAdminId)
      : null,
    decision: item.decision || null,
    decidedAt: item.decidedAt || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// =====================================================
// GET /api/admin/prize-reviews
// =====================================================

exports.listPrizeReviews = async (req, res, next) => {
  try {
    const page = positiveInteger(
      req.query.page, 1, 100000
    );

    const limit = positiveInteger(
      req.query.limit, 20, 50
    );

    const status =
      req.query.status === undefined
        ? 'pending_review'
        : req.query.status;

    if (
      typeof status !== 'string' ||
      !ALLOWED_STATUSES.has(status)
    ) {
      throw fail(
        400,
        'INVALID_REVIEW_STATUS',
        'Invalid prize review status'
      );
    }

    const filter = {
      campaignId: CAMPAIGN_POLICY.campaignId,
      status,
    };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      PrizeDecision.find(filter)
        .select(
          'userId campaignId gameSessionId gameId ' +
          'status riskReasons assessmentVersion ' +
          'reviewedAt reviewedByAdminId decision ' +
          'decidedAt createdAt updatedAt'
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      PrizeDecision.countDocuments(filter),
    ]);

    res.set('Cache-Control', 'no-store');

    return res.json({
      campaignId: CAMPAIGN_POLICY.campaignId,
      status,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: items.map(publicDecision),
    });
  } catch (error) {
    return next(error);
  }
};

// =====================================================
// GET /api/admin/prize-reviews/:id
// =====================================================

exports.getPrizeReview = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      throw fail(
        400,
        'INVALID_DECISION_ID',
        'Invalid prize review ID'
      );
    }

    const decision = await PrizeDecision.findOne({
      _id: req.params.id,
      campaignId: CAMPAIGN_POLICY.campaignId,
    }).lean();

    if (!decision) {
      throw fail(
        404,
        'REVIEW_NOT_FOUND',
        'Prize review not found'
      );
    }

    const game = await GameSession.findOne({
      _id: decision.gameSessionId,
      userId: decision.userId,
      campaignId: decision.campaignId,
      gameId: decision.gameId,
    })
      .select(
        'userId campaignId gameId attemptNumber status outcome score ' +
        'startedAt expiresAt completedAt gameState events'
      )
      .lean();

    // Do not return sessionTokenHash, JWTs,
    // customer contact data, or prize QR tokens.
    //
    // Restrict evidence to fields useful for review.
    // Raw gameState may contain internal motion/debug
    // data and must not be returned wholesale.

    const gameplay = game
      ? {
          gameId: game.gameId,
          attemptNumber: game.attemptNumber,
          status: game.status,
          outcome: game.outcome,
          score: game.score,
          startedAt: game.startedAt,
          expiresAt: game.expiresAt,
          completedAt: game.completedAt,
          progress: {
            round: game.gameState?.round ?? null,
            shot: game.gameState?.shot ?? null,
            hits: game.gameState?.hits ?? null,
            misses: game.gameState?.misses ?? null,
            perfects: game.gameState?.perfects ?? null,
            phase: game.gameState?.phase ?? null,
          },
          eventCount: Array.isArray(game.events)
            ? game.events.length
            : null,
          historyCount: Array.isArray(
            game.gameState?.history
          )
            ? game.gameState.history.length
            : null,
        }
      : null;

    res.set('Cache-Control', 'no-store');

    return res.json({
      review: publicDecision(decision),
      gameplay,
      gameplayMissing: !game,
      assessments: reviewEvidence(game),
    });
  } catch (error) {
    return next(error);
  }
};

// =====================================================
// POST /api/admin/prize-reviews/:id/approve
// =====================================================

exports.approvePrizeReview = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      throw fail(
        400,
        'INVALID_DECISION_ID',
        'Invalid prize review ID'
      );
    }

    const result = await reviewPrizeDecision({
      decisionId: req.params.id,
      adminId: req.admin._id,
      adminTokenVersion: req.adminTokenVersion,
      action: 'approve',
    });

    res.set('Cache-Control', 'no-store');

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

// =====================================================
// POST /api/admin/prize-reviews/:id/reject
// =====================================================

exports.rejectPrizeReview = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      throw fail(
        400,
        'INVALID_DECISION_ID',
        'Invalid prize review ID'
      );
    }

    const result = await reviewPrizeDecision({
      decisionId: req.params.id,
      adminId: req.admin._id,
      adminTokenVersion: req.adminTokenVersion,
      action: 'reject',
    });

    res.set('Cache-Control', 'no-store');

    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
