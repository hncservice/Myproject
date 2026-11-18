'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const GameSession = require('../models/GameSession');
const PrizeAward = require('../../prizes/models/PrizeAward');
const { validateAndScoreShot } = require('./perfectShotScoringValidator');

const {
  CAMPAIGN_POLICY,
  GAMES,
} = require('../../../config/gameConfig');

const {
  processQualifiedCompletion,
} = require('./gameCompletionDecisionService');

const CONFIG = GAMES['perfect-shot'];

const RULES = Object.freeze({
  totalShots: CONFIG.totalShots,
  shotTimeMs: CONFIG.perShotTimeMs,
  scoreToQualify: CONFIG.scoreToQualify,
  shotPauseMs: 850,
  minimumReactionMs: 90,
  referenceSize: 500,
  targetRadius: 38,
  difficulty: [0.82, 1, 1.15, 1.28, 1.4],
});

// =====================================================
// ERROR HELPER
// =====================================================

function gameError(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

// =====================================================
// SESSION TOKEN
// =====================================================

function sessionTokenFor(session) {
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

function validToken(actual, expected) {
  if (
    typeof actual !== 'string' ||
    !/^[a-f\d]{64}$/i.test(actual)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(actual.toLowerCase(), 'hex'),
    Buffer.from(expected, 'hex')
  );
}

// =====================================================
// LOAD SESSION
// =====================================================

async function loadSession(userId, body = {}) {
  if (!mongoose.isValidObjectId(body.sessionId)) {
    throw gameError(
      400,
      'INVALID_SESSION',
      'Invalid session ID'
    );
  }

  const session = await GameSession.findOne({
    _id: body.sessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'perfect-shot',
  }).select('+sessionTokenHash');

  if (!session) {
    throw gameError(
      404,
      'SESSION_NOT_FOUND',
      'Perfect Shot session not found'
    );
  }

  const expected = sessionTokenFor(session);

  const hash = crypto
    .createHash('sha256')
    .update(expected)
    .digest('hex');

  if (
    !validToken(body.sessionToken, expected) ||
    session.sessionTokenHash !== hash
  ) {
    throw gameError(
      403,
      'INVALID_SESSION_TOKEN',
      'Invalid session credentials'
    );
  }

  // Shared campaign lock applies to active
  // sessions after page refresh too.
  const existingAward = await PrizeAward.exists({
    userId: session.userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
  });

  if (existingAward) {
    throw gameError(
      409,
      'PRIZE_ALREADY_AWARDED',
      'Prize already awarded in this campaign. Both games are locked.'
    );
  }

  return session;
}

// =====================================================
// SESSION STATUS
// =====================================================

async function requireActive(session) {
  if (session.status !== 'active') {
    throw gameError(
      409,
      'SESSION_NOT_ACTIVE',
      `Session is ${session.status}`
    );
  }

  if (
    new Date(session.expiresAt).getTime() <=
    Date.now()
  ) {
    await GameSession.updateOne(
      {
        _id: session._id,
        status: 'active',
        expiresAt: {
          $lte: new Date(),
        },
      },
      {
        $set: {
          status: 'expired',
          outcome: 'not-qualified',
        },
      }
    );

    throw gameError(
      409,
      'SESSION_EXPIRED',
      'Perfect Shot session expired'
    );
  }
}

// =====================================================
// TARGET MOTION
// =====================================================

// Each shot receives different server-generated
// movement parameters.
//
// These parameters are sent to the browser
// so it can render the same target.
//
// This is not reliable bot prevention.

function createMotion() {
  const randomFloat = (min, max) =>
    min +
    (crypto.randomInt(1000000) / 1000000) *
      (max - min);

  return {
    phaseX: randomFloat(0, Math.PI * 2),
    phaseY: randomFloat(0, Math.PI * 2),

    speedX: randomFloat(1.45, 2.65),
    speedY: randomFloat(0.95, 1.85),

    amplitudeX: randomFloat(25, 35),
    amplitudeY: randomFloat(14, 22),
  };
}

// Legacy sessions have no motion field.
// Preserve their existing movement.

function positionAt(
  elapsedMs,
  shotIndex,
  motion = null
) {
  const seconds =
    Math.max(0, elapsedMs) / 1000;

  if (
    motion &&
    Number.isFinite(motion.phaseX) &&
    Number.isFinite(motion.speedX)
  ) {
    return {
      x:
        50 +
        Math.sin(
          seconds * motion.speedX +
            motion.phaseX
        ) * motion.amplitudeX,

      y:
        45 +
        Math.sin(
          seconds * motion.speedY +
            motion.phaseY
        ) * motion.amplitudeY,
    };
  }

  const speed =
    RULES.difficulty[
      Math.min(
        shotIndex,
        RULES.difficulty.length - 1
      )
    ];

  return {
    x:
      50 +
      Math.sin(
        seconds * 2.25 * speed +
          shotIndex * 1.12
      ) * 35,

    y:
      45 +
      Math.sin(
        seconds * 1.38 * speed +
          shotIndex * 0.89
      ) * 22,
  };
}

// =====================================================
// SCORING
// =====================================================

function ratingForDistance(distance) {
  if (distance <= 11) {
    return {
      points: 100,
      category: 'perfect',
      label: 'PERFECT!',
    };
  }

  if (distance <= 23) {
    return {
      points: 70,
      category: 'great',
      label: 'GREAT SHOT!',
    };
  }

  if (distance <= RULES.targetRadius) {
    return {
      points: 40,
      category: 'hit',
      label: 'NICE HIT!',
    };
  }

  return {
    points: 0,
    category: 'miss',
    label: 'MISSED!',
  };
}

// =====================================================
// INITIAL GAME STATE
// =====================================================

function initialState(session) {
  return {
    revision: 0,
    phase: 'ready',

    shot: 0,
    score: 0,
    hits: 0,
    perfects: 0,

    history: [],

    shotStartedAt: null,
    shotExpiresAt: null,
    nextShotAt: session.startedAt,

    motion: null,
  };
}

function stateGuard(session, state) {
  return {
    _id: session._id,
    userId: session.userId,
    campaignId: session.campaignId,
    gameId: 'perfect-shot',

    status: 'active',

    expiresAt: {
      $gt: new Date(),
    },

    'gameState.revision': state.revision,
  };
}

// =====================================================
// INITIALIZE SESSION
// =====================================================

async function initialize(session) {
  if (session.gameState) {
    return session;
  }

  const updated =
    await GameSession.findOneAndUpdate(
      {
        _id: session._id,
        status: 'active',

        expiresAt: {
          $gt: new Date(),
        },

        gameState: null,
      },
      {
        $set: {
          gameState: initialState(session),
        },
      },
      {
        new: true,
      }
    );

  if (updated) {
    return updated;
  }

  const latest = await GameSession.findById(
    session._id
  );

  if (!latest) {
    throw gameError(
      404,
      'SESSION_NOT_FOUND',
      'Session not found'
    );
  }

  return latest;
}

// =====================================================
// RESPONSE VIEW
// =====================================================

// Session token is never included in gameplay responses.

function view(session) {
  const state =
    session.gameState ||
    initialState(session);

  const shotVisible =
    session.status === 'active' &&
    state.phase === 'aiming' &&
    state.shotExpiresAt &&
    new Date(
      state.shotExpiresAt
    ).getTime() > Date.now();

  return {
    serverNow: Date.now(),

    sessionId: String(session._id),
    gameId: 'perfect-shot',
    campaignId: session.campaignId,

    status: session.status,
    outcome: session.outcome,

    phase:
      session.status !== 'active'
        ? state.phase
        : shotVisible
          ? 'aiming'
          : state.phase === 'aiming'
            ? 'ready'
            : state.phase,

    shot: state.shot,
    totalShots: RULES.totalShots,

    score: state.score,
    hits: state.hits,
    perfects: state.perfects,

    maxScore:
      RULES.totalShots * 100,

    scoreToQualify:
      RULES.scoreToQualify,

    shotTimeMs:
      RULES.shotTimeMs,

    motion: shotVisible
      ? state.motion || null
      : null,

    shotStartedAt: shotVisible
      ? state.shotStartedAt
      : null,

    shotExpiresAt: shotVisible
      ? state.shotExpiresAt
      : null,

    nextShotAt:
      state.nextShotAt || null,

    history:
      state.history || [],

    expiresAt: session.expiresAt,
    completedAt: session.completedAt,
  };
}

// =====================================================
// COMPLETION
// =====================================================

function completionFields(state, now) {
  return {
    status: 'completed',

    outcome:
      state.score >= RULES.scoreToQualify
        ? 'qualified'
        : 'not-qualified',

    score: state.score,
    completedAt: now,
  };
}

function addShotResult(
  state,
  result,
  now
) {
  const history = [
    ...(state.history || []),
    result,
  ];

  const finished =
    history.length >= RULES.totalShots;

  return {
    ...state,

    revision:
      state.revision + 1,

    phase: finished
      ? 'finished'
      : 'ready',

    score:
      state.score + result.points,

    hits:
      state.hits +
      Number(result.points > 0),

    perfects:
      state.perfects +
      Number(
        result.category === 'perfect'
      ),

    history,

    shotStartedAt: null,
    shotExpiresAt: null,
    motion: null,

    nextShotAt: finished
      ? null
      : new Date(
          now.getTime() +
            RULES.shotPauseMs
        ),
  };
}

// =====================================================
// SETTLE EXPIRED SHOT
// =====================================================

// An expired shot must be recorded exactly once.

async function settleExpiredShot(session) {
  const state = session.gameState;

  if (
    !state ||
    state.phase !== 'aiming' ||
    new Date(
      state.shotExpiresAt
    ).getTime() > Date.now()
  ) {
    return session;
  }

  const now = new Date();

  const result = {
    shot: state.shot,
    points: 0,
    label: 'TIME UP!',
    category: 'miss',
    timedOut: true,
    serverAt: now,
  };

  const nextState = addShotResult(
    state,
    result,
    now
  );

  const finished =
    nextState.phase === 'finished';

  const updated =
    await GameSession.findOneAndUpdate(
      {
        ...stateGuard(
          session,
          state
        ),

        'gameState.phase':
          'aiming',

        'gameState.shotExpiresAt': {
          $lte: now,
        },
      },
      {
        $set: {
          gameState: nextState,

          ...(finished
            ? completionFields(
                nextState,
                now
              )
            : {}),
        },

        $push: {
          events: {
            type: 'shot-timeout',
            shot: state.shot,
            serverAt: now,
          },
        },
      },
      {
        new: true,
      }
    );

  if (!updated) {
    throw gameError(
      409,
      'SHOT_CONFLICT',
      'Shot changed; retry'
    );
  }

  // Automatic preliminary prize decision.
  if (finished) {
    await processQualifiedCompletion(
      updated
    );
  }

  return updated;
}

// =====================================================
// NEXT SHOT
// =====================================================

// POST /api/games/perfect-shot/next

async function nextShot(userId, body = {}) {
  let session = await loadSession(
    userId,
    body
  );

  await requireActive(session);

  session = await initialize(session);

  await requireActive(session);

  let state = session.gameState;

  if (!state) {
    throw gameError(
      409,
      'SHOT_CONFLICT',
      'Unable to initialize gameplay; retry'
    );
  }

  // Repeated /next must not restart
  // an already active shot.

  if (
    state.phase === 'aiming' &&
    new Date(
      state.shotExpiresAt
    ).getTime() > Date.now()
  ) {
    return view(session);
  }

  // Automatically record an expired shot.

  if (state.phase === 'aiming') {
    session =
      await settleExpiredShot(
        session
      );

    state = session.gameState;

    if (
      session.status !== 'active'
    ) {
      return view(session);
    }
  }

  if (
    state.phase === 'finished'
  ) {
    return view(session);
  }

  if (
    state.phase !== 'ready'
  ) {
    throw gameError(
      409,
      'INVALID_PHASE',
      'Cannot start shot in this phase'
    );
  }

  const now = new Date();

  // Enforce pause between shots.

  if (
    state.nextShotAt &&
    now < new Date(
      state.nextShotAt
    )
  ) {
    return view(session);
  }

  if (
    state.shot >=
    RULES.totalShots
  ) {
    throw gameError(
      409,
      'SHOT_LIMIT_REACHED',
      'All shots have been consumed'
    );
  }

  const nextState = {
    ...state,

    revision:
      state.revision + 1,

    phase: 'aiming',

    shot:
      state.shot + 1,

    shotStartedAt: now,

    shotExpiresAt: new Date(
      now.getTime() +
        RULES.shotTimeMs
    ),

    nextShotAt: null,

    motion: createMotion(),
  };

  const updated =
    await GameSession.findOneAndUpdate(
      stateGuard(
        session,
        state
      ),
      {
        $set: {
          gameState: nextState,
        },
      },
      {
        new: true,
      }
    );

  if (!updated) {
    throw gameError(
      409,
      'SHOT_CONFLICT',
      'Shot was already started; retry'
    );
  }

  return view(updated);
}

// =====================================================
// SHOOT
// =====================================================

// POST /api/games/perfect-shot/shoot

async function shoot(userId, body = {}, receivedMs = Date.now()) {
  // HTTP calls pass the server timestamp captured before authentication.
  // Direct service calls default to the time they enter this function.
  const receivedAt = new Date(receivedMs);

  const {
    shot,
    x,
    y,
  } = body;

  if (
    !Number.isInteger(shot) ||
    shot < 1 ||
    shot > RULES.totalShots ||

    typeof x !== 'number' ||
    typeof y !== 'number' ||

    !Number.isFinite(x) ||
    !Number.isFinite(y) ||

    x < 0 ||
    x > 100 ||

    y < 0 ||
    y > 100
  ) {
    throw gameError(
      400,
      'INVALID_SHOT',
      'Valid shot number and x/y percentages are required'
    );
  }

  const session = await loadSession(
    userId,
    body
  );

  await requireActive(session);

  const state = session.gameState;

  if (
    !state ||
    state.phase !== 'aiming' ||
    state.shot !== shot
  ) {
    throw gameError(
      409,
      'SHOT_NOT_ACTIVE',
      'Shot is not active'
    );
  }

  // ===================================================
  // TIMING VALIDATION
  // ===================================================

  const dbProcessingMs =
    Date.now() - receivedMs;

  const startedAt =
    new Date(
      state.shotStartedAt
    ).getTime();

  const expiresAt =
    new Date(
      state.shotExpiresAt
    ).getTime();

  const testCompensationEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.HNC_TEST_SHOT_COMPENSATION ===
      'true';

  const MAX_TEST_LAG_MS = 2000;

  const claimedShotAt =
    body.shotAt;

  const validTestTimestamp =
    testCompensationEnabled &&
    typeof claimedShotAt === 'number' &&
    Number.isFinite(claimedShotAt) &&
    claimedShotAt >=
      startedAt +
        RULES.minimumReactionMs &&
    claimedShotAt < expiresAt &&
    claimedShotAt <=
      receivedMs + 75 &&
    claimedShotAt >=
      receivedMs -
        MAX_TEST_LAG_MS;

  if (
    testCompensationEnabled &&
    !validTestTimestamp
  ) {
    throw gameError(
      409,
      'INVALID_CAPTURE_TIME',
      'Invalid development capture timestamp'
    );
  }

  const captureMs =
    validTestTimestamp
      ? claimedShotAt
      : receivedMs;

  const elapsedMs =
    captureMs - startedAt;

  if (
    elapsedMs <
    RULES.minimumReactionMs
  ) {
    throw gameError(
      409,
      'TOO_FAST',
      'Shot arrived too quickly'
    );
  }

  if (
    captureMs >= expiresAt
  ) {
    throw gameError(
      409,
      'TOO_LATE',
      'Shot time has expired'
    );
  }

  // ===================================================
  // SERVER SCORING
  // ===================================================

  const target = positionAt(
    elapsedMs,
    shot - 1,
    state.motion
  );

  const distance = Math.hypot(
    ((x - target.x) / 100) *
      RULES.referenceSize,

    ((y - target.y) / 100) *
      RULES.referenceSize
  );

  const rating =
    ratingForDistance(
      distance
    );

  const result = {
    shot,

    points:
      rating.points,

    label:
      rating.label,

    category:
      rating.category,

    x,
    y,

    targetX: target.x,
    targetY: target.y,

    distance:
      Number(
        distance.toFixed(2)
      ),

    timedOut: false,
    serverAt: receivedAt,

    ...(process.env.NODE_ENV !== 'production'
      ? {
          debugTiming: {
            shotStartedMs:
              startedAt,

            receivedMs,
            dbProcessingMs,

            claimedShotAt:
              typeof claimedShotAt === 'number'
                ? claimedShotAt
                : null,

            scoredAtMs:
              captureMs,

            elapsedMs,

            compensated:
              validTestTimestamp,

            captureLagMs:
              receivedMs -
              captureMs,

            motion:
              state.motion ||
              null,
          },
        }
      : {}),
  };

  // ===================================================
  // SHADOW VALIDATOR — OBSERVATIONAL ONLY
  // ===================================================

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.HNC_SHADOW_SCORING ===
      'true'
  ) {
    try {
      const shadow =
        validateAndScoreShot({
          shot,
          x,
          y,

          shotAt:
            body.shotAt,

          receivedAt:
            receivedMs,

          shotStartedAt:
            startedAt,

          shotExpiresAt:
            expiresAt,

          motion:
            state.motion,

          positionAt,
          ratingForDistance,
        });

      const comparison = {
        sessionId:
          String(session._id),

        shot,

        livePoints:
          rating.points,

        liveDistance:
          Number(
            distance.toFixed(2)
          ),

        shadowAccepted:
          shadow.accepted,

        shadowCode:
          shadow.code,

        shadowPoints:
          shadow.score?.points ??
          null,

        scoreMatches:
          shadow.accepted
            ? shadow.score.points ===
              rating.points
            : null,

        reviewRequired:
          shadow.risk?.reviewRequired ??
          false,

        riskReasons:
          shadow.risk?.reasons ||
          [],

        claimedLatencyMs:
          shadow.timing?.claimedLatencyMs ??
          null,

        testCompensationEnabled,
      };

      console.info(
        '[PERFECT_SHOT_SHADOW]',
        comparison
      );
    } catch (shadowError) {
      console.warn(
        '[PERFECT_SHOT_SHADOW_ERROR]',
        shadowError.message
      );
    }
  }

  // ===================================================
  // UPDATE GAME
  // ===================================================

  const nextState =
    addShotResult(
      state,
      result,
      receivedAt
    );

  const finished =
    nextState.phase ===
    'finished';

  const updated =
    await GameSession.findOneAndUpdate(
      {
        ...stateGuard(
          session,
          state
        ),

        'gameState.phase':
          'aiming',

        'gameState.shot':
          shot,

        'gameState.shotExpiresAt': {
          $gt: new Date(
            captureMs
          ),
        },
      },
      {
        $set: {
          gameState: nextState,

          ...(finished
            ? completionFields(
                nextState,
                receivedAt
              )
            : {}),
        },

        $push: {
          events: {
            type: 'shot',
            shot,

            points:
              rating.points,

            category:
              rating.category,

            serverAt:
              receivedAt,
          },
        },
      },
      {
        new: true,
      }
    );

  if (!updated) {
    throw gameError(
      409,
      'SHOT_CONFLICT',
      'Shot already processed or session changed'
    );
  }

  // ===================================================
  // NEW — AUTOMATIC PRIZE DECISION PROCESSING
  // ===================================================

  // The game completion was committed successfully.
  // A preliminary decision is created only when the
  // saved game session is qualified.
  //
  // No real prize allocation occurs here.

  if (finished) {
    await processQualifiedCompletion(
      updated
    );
  }

  return {
    ...view(updated),
    result,
  };
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  nextShot,
  shoot,
  positionAt,
  ratingForDistance,
  RULES,
};