'use strict';

// Offline service test: synthetic sessions and mocked DB methods.
// Never calls mongoose.connect or starts the API.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const GameSession = require('../features/games/models/GameSession');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const envKeys = [
  'JWT_SECRET',
  'NODE_ENV',
  'HNC_TEST_SHOT_COMPENSATION',
  'HNC_SHADOW_SCORING',
  'ALLOCATION_ENABLED',
];

const originalEnv = Object.fromEntries(
  envKeys.map(key => [key, process.env[key]])
);

const RealDate = global.Date;
const originals = {
  findOne: GameSession.findOne,
  update: GameSession.findOneAndUpdate,
  exists: PrizeAward.exists,
};

let clock = RealDate.now();
let lookupDelay = 0;
let updates = 0;
let passed = 0;
const sessions = new Map();

class TestDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [clock]));
  }
  static now() {
    return clock;
  }
}

const userId = new mongoose.Types.ObjectId();
const motion = {
  phaseX: 1.2, phaseY: 0.7,
  speedX: 2.1, speedY: 1.4,
  amplitudeX: 30, amplitudeY: 20,
};

function fixture(game, elapsed = 1400) {
  const id = new mongoose.Types.ObjectId();
  const started = clock - elapsed;
  const session = {
    _id: id,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'perfect-shot',
    status: 'active',
    outcome: null,
    score: 0,
    startedAt: new Date(started - 200),
    expiresAt: new Date(clock + 60000),
    gameState: {
      revision: 1,
      phase: 'aiming',
      shot: 1,
      score: 0,
      hits: 0,
      perfects: 0,
      history: [],
      shotStartedAt: new Date(started),
      shotExpiresAt: new Date(started + 3500),
      motion,
      nextShotAt: null,
    },
  };

  const token = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${id}:${userId}:${session.campaignId}:${session.gameId}`)
    .digest('hex');

  session.sessionTokenHash = crypto.createHash('sha256')
    .update(token).digest('hex');

  sessions.set(String(id), session);
  const point = game.positionAt(elapsed, 0, motion);

  return {
    sessionId: String(id),
    sessionToken: token,
    shot: 1,
    x: point.x,
    y: point.y,
  };
}

async function main() {
  assert.equal(mongoose.connection.readyState, 0);

  process.env.JWT_SECRET = 'offline-server-timing-test-secret';
  process.env.NODE_ENV = 'development';
  process.env.HNC_TEST_SHOT_COMPENSATION = 'false';
  process.env.HNC_SHADOW_SCORING = 'false';
  process.env.ALLOCATION_ENABLED = 'false';

  const game = require('../features/games/services/perfectShotGameplayService');

  global.Date = TestDate;

  GameSession.findOne = filter => ({
    select: async () => {
      clock += lookupDelay;
      return sessions.get(String(filter._id)) ?? null;
    },
  });

  PrizeAward.exists = async () => null;

  GameSession.findOneAndUpdate = async (filter, update) => {
    const session = sessions.get(String(filter._id));
    if (
      !session ||
      session.status !== 'active' ||
      session.gameState.revision !== filter['gameState.revision'] ||
      session.gameState.phase !== filter['gameState.phase'] ||
      session.gameState.shot !== filter['gameState.shot'] ||
      session.expiresAt <= new Date()
    ) {
      return null;
    }
    updates++;
    Object.assign(session, update.$set);
    return session;
  };



  async function test(name, fn) {
    clock = RealDate.now();
    lookupDelay = 0;
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  }

  await test('Missing shotAt uses server time', async () => {
    const response = await game.shoot(userId, fixture(game));
    assert.equal(response.result.points, 100);
    assert.equal(response.result.debugTiming.scoredAtMs, clock);
    assert.equal(response.result.debugTiming.compensated, false);
  });

  await test('Forged timestamps cannot change live scoring', async () => {
    const fixedTime = clock;
    for (const claimed of [
      fixedTime - 800,
      fixedTime + 60000,
      0,
      'invalid',
      NaN,
    ]) {
      const response = await game.shoot(userId, {
        ...fixture(game),
        shotAt: claimed,
      });
      assert.equal(response.result.points, 100);
      assert.equal(response.result.debugTiming.scoredAtMs, fixedTime);
      assert.equal(response.result.debugTiming.compensated, false);
      assert.equal(response.result.debugTiming.captureLagMs, 0);
    }
  });

  await test('Database delay preserves service-entry scoring time', async () => {
    const body = fixture(game);
    const entryTime = clock;
    lookupDelay = 250;

    const response = await game.shoot(userId, body);
    const timing = response.result.debugTiming;

    assert.equal(response.result.points, 100);
    assert.equal(timing.receivedMs, entryTime);
    assert.equal(timing.scoredAtMs, entryTime);
    assert.equal(timing.dbProcessingMs, 250);
    assert.equal(timing.elapsedMs, 1400);
  });

  await test('Forged timestamp cannot bypass minimum reaction', async () => {
    const body = fixture(game, 50);
    const before = updates;
    await assert.rejects(
      () => game.shoot(userId, { ...body, shotAt: clock + 100 }),
      err => err.code === 'TOO_FAST'
    );
    assert.equal(updates, before);
  });

  await test('Backdated timestamp cannot rescue an expired shot', async () => {
    const body = fixture(game, 3600);
    const before = updates;
    await assert.rejects(
      () => game.shoot(userId, { ...body, shotAt: clock - 800 }),
      err => err.code === 'TOO_LATE'
    );
    assert.equal(updates, before);
  });

  await test('Production ignores compensation even when flag is true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.HNC_TEST_SHOT_COMPENSATION = 'true';

    try {
      const body = fixture(game);
      const expected = game.positionAt(1400, 0, motion);
      const response = await game.shoot(userId, {
        ...body,
        shotAt: clock - 800,
      });

      assert.equal(response.result.points, 100);
      assert.equal(response.result.targetX, expected.x);
      assert.equal(response.result.targetY, expected.y);
      assert.equal('debugTiming' in response.result, false);
    } finally {
      process.env.NODE_ENV = 'development';
      process.env.HNC_TEST_SHOT_COMPENSATION = 'false';
    }
  });

  assert.equal(updates, 8);
  assert.equal(mongoose.connection.readyState, 0);
  console.log(`\nSERVER TIMING: PASS (${passed} tests, ${updates} mocked updates)`);
}

main().catch(err => {
  console.error(err.stack);
  process.exitCode = 1;
}).finally(() => {
  global.Date = RealDate;
  GameSession.findOne = originals.findOne;
  GameSession.findOneAndUpdate = originals.update;
  PrizeAward.exists = originals.exists;

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

