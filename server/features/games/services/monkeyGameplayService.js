'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

const GameSession = require('../models/GameSession');
const PrizeAward = require('../../prizes/models/PrizeAward');
const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');
const {
  processQualifiedCompletion,
} = require('./gameCompletionDecisionService');

const RULES = Object.freeze({
  gridSize: 9,
  requiredHits: 7,
  maxRounds: 15,
  visibleMs: 1700,
  roundPauseMs: 250,
  minimumReactionMs: 90,
});

function error(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function tokenFor(session) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET required');
  }

  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(
      `${session._id}:${session.userId}:${session.campaignId}:${session.gameId}`
    )
    .digest('hex');
}

function validToken(input, expected) {
  if (
    typeof input !== 'string' ||
    !/^[a-f\d]{64}$/i.test(input)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(input.toLowerCase(), 'hex'),
    Buffer.from(expected, 'hex')
  );
}

async function load(userId, { sessionId, sessionToken } = {}) {
  if (!mongoose.isValidObjectId(sessionId)) {
    throw error(400, 'INVALID_SESSION', 'Invalid session ID');
  }

  const session = await GameSession.findOne({
    _id: sessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
  }).select('+sessionTokenHash');

  if (!session) {
    throw error(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  const expected = tokenFor(session);
  const digest = crypto
    .createHash('sha256')
    .update(expected)
    .digest('hex');

  if (
    !validToken(sessionToken, expected) ||
    session.sessionTokenHash !== digest
  ) {
    throw error(
      403,
      'INVALID_SESSION_TOKEN',
      'Invalid session credential'
    );
  }

  const existingAward = await PrizeAward.exists({
    userId: session.userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
  });

  if (existingAward) {
    throw error(
      409,
      'PRIZE_ALREADY_AWARDED',
      'Prize already awarded in this campaign. Both games are locked.'
    );
  }

  return session;
}

function chooseTarget(previousTargetIndex) {
  const hasPrevious =
    Number.isInteger(previousTargetIndex) &&
    previousTargetIndex >= 0 &&
    previousTargetIndex < RULES.gridSize;

  if (!hasPrevious) {
    return crypto.randomInt(RULES.gridSize);
  }

  const candidate = crypto.randomInt(RULES.gridSize - 1);
  return candidate >= previousTargetIndex ? candidate + 1 : candidate;
}

function isTargetVisible(gameState, now = Date.now()) {
  return (
    gameState?.phase === 'visible' &&
    gameState.visibleUntil != null &&
    new Date(gameState.visibleUntil).getTime() > now
  );
}

function view(session) {
  const gameState = session.gameState || {
    round: 0,
    hits: 0,
    misses: 0,
    phase: 'ready',
  };

  const visible =
    session.status === 'active' &&
    isTargetVisible(gameState);

  return {
    sessionId: String(session._id),
    status: session.status,
    outcome: session.outcome,
    score: session.score,

    round: gameState.round,
    hits: gameState.hits,
    misses: gameState.misses,

    maxRounds: RULES.maxRounds,
    requiredHits: RULES.requiredHits,

    phase:
      session.status === 'active'
        ? visible
          ? 'visible'
          : gameState.phase === 'visible'
            ? 'ready'
            : gameState.phase
        : gameState.phase,

    targetIndex: visible ? gameState.targetIndex : null,
    visibleUntil: visible ? gameState.visibleUntil : null,
    nextRoundAt: gameState.nextRoundAt || null,
    expiresAt: session.expiresAt,
  };
}

function requireActive(session) {
  if (session.status !== 'active') {
    throw error(
      409,
      'SESSION_NOT_ACTIVE',
      `Session is ${session.status}`
    );
  }
}

async function expireIfNeeded(session) {
  if (
    session.status === 'active' &&
    session.expiresAt.getTime() <= Date.now()
  ) {
    await GameSession.updateOne(
      {
        _id: session._id,
        status: 'active',
        expiresAt: { $lte: new Date() },
      },
      {
        $set: {
          status: 'expired',
          outcome: 'not-qualified',
        },
      }
    );

    throw error(409, 'SESSION_EXPIRED', 'Session expired');
  }
}

function resultOf(gameState) {
  return gameState.hits >= RULES.requiredHits
    ? 'qualified'
    : 'not-qualified';
}

function completedFields(gameState, now) {
  return {
    status: 'completed',
    outcome: resultOf(gameState),
    score: gameState.hits,
    completedAt: now,
  };
}

function statusGuard(session, gameState) {
  return {
    _id: session._id,
    status: 'active',
    expiresAt: { $gt: new Date() },
    'gameState.revision': gameState.revision,
  };
}

async function init(session) {
  if (session.gameState) {
    return session;
  }

  const state = {
    revision: 0,
    round: 0,
    hits: 0,
    misses: 0,
    phase: 'ready',
    nextRoundAt: session.startedAt,
    targetIndex: null,
    visibleFrom: null,
    visibleUntil: null,
  };

  const latest = await GameSession.findOneAndUpdate(
    {
      _id: session._id,
      status: 'active',
      expiresAt: { $gt: new Date() },
      gameState: null,
    },
    { $set: { gameState: state } },
    { new: true }
  );

  if (latest) {
    return latest;
  }

  const current = await GameSession.findById(session._id);

  if (!current) {
    throw error(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  return current;
}

async function nextRound(userId, body = {}) {
  let session = await load(userId, body);

  requireActive(session);
  await expireIfNeeded(session);

  session = await init(session);

  requireActive(session);
  await expireIfNeeded(session);

  let gameState = session.gameState;

  if (!gameState) {
    throw error(
      409,
      'ROUND_CONFLICT',
      'Unable to initialize game state; retry'
    );
  }

  let now = new Date();

  if (isTargetVisible(gameState, now.getTime())) {
    return view(session);
  }

  // Settle a target that expired without a tap.
  if (gameState.phase === 'visible') {
    const visibleUntil = new Date(gameState.visibleUntil);
    const settledState = {
      ...gameState,
      revision: gameState.revision + 1,
      phase: 'ready',
      misses: gameState.misses + 1,
      // Keep the last box through the pause. view() hides it in this phase.
      targetIndex: gameState.targetIndex,
      visibleFrom: null,
      visibleUntil: null,
      nextRoundAt: new Date(
        visibleUntil.getTime() + RULES.roundPauseMs
      ),
    };

    const finished =
      settledState.hits >= RULES.requiredHits ||
      settledState.round >= RULES.maxRounds;

    if (finished) {
      settledState.phase = 'finished';
      settledState.targetIndex = null;
    }

    const updated = await GameSession.findOneAndUpdate(
      {
        ...statusGuard(session, gameState),
        'gameState.phase': 'visible',
        'gameState.visibleUntil': { $lte: new Date() },
      },
      {
        $set: {
          gameState: settledState,
          ...(finished
            ? completedFields(settledState, new Date())
            : {}),
        },
      },
      { new: true }
    );

    if (!updated) {
      throw error(
        409,
        'ROUND_CONFLICT',
        'Round was already processed or session changed; retry'
      );
    }

    session = updated;
    gameState = updated.gameState;
    now = new Date();

    if (finished) {
      await processQualifiedCompletion(updated);
      return view(updated);
    }
  }

  if (gameState.phase === 'finished') {
    return view(session);
  }

  if (
    gameState.phase === 'ready' &&
    gameState.nextRoundAt &&
    now.getTime() < new Date(gameState.nextRoundAt).getTime()
  ) {
    return view(session);
  }

  if (
    gameState.hits >= RULES.requiredHits ||
    gameState.round >= RULES.maxRounds
  ) {
    const finishedState = {
      ...gameState,
      revision: gameState.revision + 1,
      phase: 'finished',
      targetIndex: null,
      visibleFrom: null,
      visibleUntil: null,
    };

    const updated = await GameSession.findOneAndUpdate(
      statusGuard(session, gameState),
      {
        $set: {
          gameState: finishedState,
          ...completedFields(finishedState, now),
        },
      },
      { new: true }
    );

    if (!updated) {
      throw error(409, 'ROUND_CONFLICT', 'Game changed; refresh session');
    }

    await processQualifiedCompletion(updated);
    return view(updated);
  }

  const roundStart = new Date();
  const nextState = {
    ...gameState,
    revision: gameState.revision + 1,
    phase: 'visible',
    round: gameState.round + 1,
    targetIndex: chooseTarget(gameState.targetIndex),
    visibleFrom: roundStart,
    visibleUntil: new Date(roundStart.getTime() + RULES.visibleMs),
    nextRoundAt: null,
  };

  const updated = await GameSession.findOneAndUpdate(
    statusGuard(session, gameState),
    { $set: { gameState: nextState } },
    { new: true }
  );

  if (!updated) {
    throw error(409, 'ROUND_CONFLICT', 'Round changed; retry');
  }

  return view(updated);
}

async function hit(userId, body = {}) {
  // Capture server-side hit arrival before the service's database operations.
  const now = new Date();
  const { round, targetIndex } = body;

  if (
    !Number.isInteger(round) ||
    round < 1 ||
    round > RULES.maxRounds ||
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= RULES.gridSize
  ) {
    throw error(400, 'INVALID_HIT', 'Valid round and targetIndex required');
  }

  const session = await load(userId, body);

  requireActive(session);
  await expireIfNeeded(session);

  const gameState = session.gameState;

  if (
    !gameState ||
    gameState.phase !== 'visible' ||
    gameState.round !== round
  ) {
    throw error(409, 'ROUND_NOT_ACTIVE', 'Round is not active');
  }

  const visibleFrom = new Date(gameState.visibleFrom);
  const visibleUntil = new Date(gameState.visibleUntil);

  if (now.getTime() < visibleFrom.getTime() + RULES.minimumReactionMs) {
    throw error(409, 'TOO_FAST', 'Tap arrived too quickly');
  }

  if (now.getTime() > visibleUntil.getTime()) {
    throw error(409, 'TOO_LATE', 'Target is no longer visible');
  }

  const success = targetIndex === gameState.targetIndex;

  const nextState = {
    ...gameState,
    revision: gameState.revision + 1,
    phase: 'ready',
    hits: gameState.hits + Number(success),
    misses: gameState.misses + Number(!success),
    targetIndex: null,
    visibleFrom: null,
    visibleUntil: null,
    nextRoundAt: new Date(now.getTime() + RULES.roundPauseMs),
  };

  // Check completion before opening another appearance.
  const finished =
    nextState.hits >= RULES.requiredHits ||
    nextState.round >= RULES.maxRounds;

  if (finished) {
    nextState.phase = 'finished';
  } else {
    const pauseRemainingMs = nextState.nextRoundAt.getTime() - Date.now();

    if (pauseRemainingMs > 0) {
      await new Promise(resolve => setTimeout(resolve, pauseRemainingMs));
    }

    const roundStart = new Date();

    nextState.phase = 'visible';
    nextState.round += 1;
    nextState.targetIndex = chooseTarget(gameState.targetIndex);
    nextState.visibleFrom = roundStart;
    nextState.visibleUntil = new Date(
      roundStart.getTime() + RULES.visibleMs
    );
    nextState.nextRoundAt = null;
  }

  // Save the tap and next appearance in the same guarded write.
  const updated = await GameSession.findOneAndUpdate(
    {
      ...statusGuard(session, gameState),
      'gameState.phase': 'visible',
      'gameState.visibleUntil': { $gte: now },
    },
    {
      $set: {
        gameState: nextState,
        ...(finished ? completedFields(nextState, now) : {}),
      },
      $push: {
        events: {
          type: 'tap',
          round,
          success,
          serverAt: now,
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    throw error(
      409,
      'ROUND_CONFLICT',
      'Tap already processed, timed out, or session changed'
    );
  }

  if (finished) {
    await processQualifiedCompletion(updated);
  }

  return {
    ...view(updated),
    hit: success,
  };
}

module.exports = {
  nextRound,
  hit,
  RULES,
};