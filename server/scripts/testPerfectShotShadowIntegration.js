
'use strict';

/**
 * HNC Step 15H
 * Perfect Shot Shadow Scoring Integration Test
 *
 * Uses mocked database methods.
 *
 * - No MongoDB connection
 * - No real game attempts consumed
 * - No prizes awarded
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const GameSession = require('../features/games/models/GameSession');
const PrizeAward = require('../features/prizes/models/PrizeAward');

const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const game = require('../features/games/services/perfectShotGameplayService');

const originals = {
  findOne: GameSession.findOne,
  findOneAndUpdate: GameSession.findOneAndUpdate,
  exists: PrizeAward.exists,
  info: console.info,
  warn: console.warn,
  env: {
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    HNC_TEST_SHOT_COMPENSATION:
      process.env.HNC_TEST_SHOT_COMPENSATION,
    HNC_SHADOW_SCORING:
      process.env.HNC_SHADOW_SCORING,
  },
};

const sessions = new Map();

let changes = 0;

const logs = [];
const warnings = [];

const userId = new mongoose.Types.ObjectId();

const motion = {
  phaseX: 1.2,
  phaseY: 0.7,
  speedX: 2.1,
  speedY: 1.4,
  amplitudeX: 30,
  amplitudeY: 20,
};

function sessionFixture(lagMs, shotNumber = 1) {
  const now = Date.now();

  const started = now - 1400;
  const click = now - lagMs;

  const id = new mongoose.Types.ObjectId();

  const session = {
    _id: id,
    userId,

    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'perfect-shot',

    status: 'active',
    outcome: null,
    score: 0,

    startedAt: new Date(started - 200),
    expiresAt: new Date(now + 60000),

    gameState: {
      revision: 1,

      phase: 'aiming',
      shot: shotNumber,

      score: 0,
      hits: 0,
      perfects: 0,

      history: [],

      shotStartedAt: new Date(started),

      shotExpiresAt: new Date(
        started + 3500
      ),

      motion,
      nextShotAt: null,
    },
  };

  const token = crypto
    .createHmac(
      'sha256',
      process.env.JWT_SECRET
    )
    .update(
      `${id}:${userId}:${session.campaignId}:${session.gameId}`
    )
    .digest('hex');

  session.sessionTokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  sessions.set(String(id), session);

  const point = game.positionAt(
    click - started,
    shotNumber - 1,
    motion
  );

  return {
    credentials: {
      sessionId: String(id),
      sessionToken: token,

      shot: shotNumber,
      x: point.x,
      y: point.y,

      shotAt: click,
    },

    session,
  };
}

async function main() {
  process.env.JWT_SECRET =
    'isolated-step-15h-secret';

  process.env.NODE_ENV = 'development';

  process.env.HNC_TEST_SHOT_COMPENSATION =
    'true';

  process.env.HNC_SHADOW_SCORING =
    'true';

  // Mock GameSession lookup.
  GameSession.findOne = filter => ({
    select: async () =>
      sessions.get(String(filter._id)) ?? null,
  });

  // Simulate a customer who has not received a prize.
  PrizeAward.exists = async () => null;

  // Mock atomic session update.
  GameSession.findOneAndUpdate =
    async (filter, update) => {
      const session = sessions.get(
        String(filter._id)
      );

      if (
        !session ||
        session.status !== 'active' ||
        session.gameState.revision !==
          filter['gameState.revision']
      ) {
        return null;
      }

      changes++;

      Object.assign(
        session,
        update.$set
      );

      return session;
    };

  // Capture shadow diagnostic messages.
  console.info = (...args) => {
    if (
      args[0] === '[PERFECT_SHOT_SHADOW]'
    ) {
      logs.push(args[1]);
    }
  };

  console.warn = (...args) => {
    warnings.push(args);
  };

  let passed = 0;

  async function test(name, fn) {
    await fn();

    passed++;

    process.stdout.write(
      `PASS: ${name}\n`
    );
  }

  // ---------------------------------------
  // TEST 1
  // Normal shot
  // ---------------------------------------

  await test(
    'Normal shot: live score preserved; shadow agrees',
    async () => {
      const { credentials } =
        sessionFixture(400, 1);

      const response = await game.shoot(
        userId,
        credentials
      );

      assert.equal(
        response.result.points,
        100
      );

      assert.equal(
        response.score,
        100
      );

      const log = logs.at(-1);

      assert.equal(
        log.livePoints,
        100
      );

      assert.equal(
        log.shadowAccepted,
        true
      );

      assert.equal(
        log.shadowPoints,
        100
      );

      assert.equal(
        log.scoreMatches,
        true
      );

      assert.equal(
        log.reviewRequired,
        false
      );
    }
  );

  // ---------------------------------------
  // TEST 2
  // High latency
  // ---------------------------------------

  await test(
    'High latency: shadow flags review, live score unaffected',
    async () => {
      const { credentials } =
        sessionFixture(800, 2);

      const response = await game.shoot(
        userId,
        credentials
      );

      assert.equal(
        response.result.points,
        100
      );

      const log = logs.at(-1);

      assert.equal(
        log.shadowAccepted,
        true
      );

      assert.equal(
        log.reviewRequired,
        true
      );

      assert.ok(
        log.riskReasons.includes(
          'HIGH_CLAIMED_LATENCY'
        )
      );

      assert.equal(
        log.scoreMatches,
        true
      );
    }
  );

  // ---------------------------------------
  // TEST 3
  // Above shadow latency limit
  // ---------------------------------------

  await test(
    'Over shadow limit: shadow rejects, live still scores',
    async () => {
      const { credentials } =
        sessionFixture(1200, 3);

      const response = await game.shoot(
        userId,
        credentials
      );

      assert.equal(
        response.result.points,
        100
      );

      const log = logs.at(-1);

      assert.equal(
        log.shadowAccepted,
        false
      );

      assert.equal(
        log.shadowCode,
        'INVALID_LATENCY'
      );

      assert.equal(
        log.shadowPoints,
        null
      );
    }
  );

  // ---------------------------------------
  // TEST 4
  // Duplicate shot
  // ---------------------------------------

  await test(
    'Duplicate shot rejected by revision guard',
    async () => {
      const { credentials } =
        sessionFixture(400, 4);

      await game.shoot(
        userId,
        credentials
      );

      await assert.rejects(
        () =>
          game.shoot(
            userId,
            credentials
          ),
        err =>
          err.code === 'SHOT_NOT_ACTIVE' ||
          err.code === 'SHOT_CONFLICT'
      );
    }
  );

  assert.equal(
    changes,
    4,
    'Four mock session updates expected'
  );

  assert.equal(
    warnings.length,
    0,
    'No shadow errors expected'
  );

  process.stdout.write(
    `\nHNC STEP 15H: PASS (${passed} tests, ${changes} mocked updates)\n`
  );

  process.stdout.write(
    'No MongoDB connection, API calls, real attempts, or prizes.\n'
  );
}

main()
  .catch(err => {
    process.stderr.write(
      `HNC STEP 15H: FAIL: ${err.stack}\n`
    );

    process.exitCode = 1;
  })
  .finally(() => {
    GameSession.findOne =
      originals.findOne;

    GameSession.findOneAndUpdate =
      originals.findOneAndUpdate;

    PrizeAward.exists =
      originals.exists;

    console.info =
      originals.info;

    console.warn =
      originals.warn;

    for (
      const [key, value] of
      Object.entries(originals.env)
    ) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
