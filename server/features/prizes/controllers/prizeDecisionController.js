'use strict';

const mongoose = require('mongoose');

const {
  createPrizeDecision,
} = require('../services/prizeDecisionCreationService');

const {
  getPrizeDecisionStatus,
} = require('../services/prizeDecisionStatusService');

function fail(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

// POST /api/games/prize-decision
exports.create = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  try {
    const body = req.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(
        body,
        'gameSessionId'
      ) ||
      typeof body.gameSessionId !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(body.gameSessionId) ||
      !mongoose.isValidObjectId(body.gameSessionId)
    ) {
      throw fail(
        400,
        'INVALID_REQUEST',
        'Only a valid gameSessionId is accepted'
      );
    }

    const result = await createPrizeDecision({
      userId: req.user._id,
      gameSessionId: body.gameSessionId,
    });

    return res.status(
      result.existing ? 200 : 201
    ).json(result);
  } catch (error) {
    return next(error);
  }
};

// GET /api/games/prize-decision/:gameSessionId
exports.getStatus = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  try {
    const result = await getPrizeDecisionStatus({
      userId: req.user._id,
      gameSessionId: req.params.gameSessionId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

// GET /api/games/prize-decision/:gameSessionId/prize
exports.getPrize = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  try {
    const {
      getPrizeDecisionPrize,
    } = require('../services/prizeDecisionPrizeService');

    const result = await getPrizeDecisionPrize({
      userId: req.user._id,
      gameSessionId: req.params.gameSessionId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

// POST /api/games/prize-decision/:gameSessionId/draw
exports.draw = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  try {
    const gameSessionId = req.params.gameSessionId;
    const body = req.body;

    if (
      typeof gameSessionId !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(gameSessionId) ||
      (
        body !== undefined &&
        (
          body === null ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).length !== 0
        )
      )
    ) {
      throw fail(
        400,
        'INVALID_REQUEST',
        'A valid game session ID and an empty request body are required'
      );
    }

    // Allocation enforces its disabled gate, ownership,
    // review eligibility and transactional draw.
    const {
      allocatePrize,
    } = require('../services/prizeAllocationService');

    const allocation = await allocatePrize({
      userId: req.user._id,
      gameSessionId,
    });

    // Return persisted customer status without exposing
    // the allocator's internal result or raw QR token.
    const status = await getPrizeDecisionStatus({
      userId: req.user._id,
      gameSessionId,
    });

    return res.status(200).json({
      ...status,
      allocationStatus: allocation.status,
    });
  } catch (error) {
    return next(error);
  }
};