'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const envKeys = [
  'JWT_SECRET', 'NODE_ENV', 'ALLOCATION_ENABLED',
  'HNC_TEST_SHOT_COMPENSATION', 'HNC_SHADOW_SCORING',
];
const savedEnv = Object.fromEntries(
  envKeys.map(key => [key, process.env[key]])
);

let originals;
let session;
let awarded = false;
let writes = 0;
let passed = 0;

const owner = new mongoose.Types.ObjectId();
const stranger = new mongoose.Types.ObjectId();

async function main() {
  process.env.JWT_SECRET = 'isolated-session-access-test-secret';
  process.env.NODE_ENV = 'test';
  process.env.ALLOCATION_ENABLED = 'false';
  process.env.HNC_TEST_SHOT_COMPENSATION = 'false';
  process.env.HNC_SHADOW_SCORING = 'false';

  const GameSession = require('../features/games/models/GameSession');
  const PrizeAward = require('../features/prizes/models/PrizeAward');
  const { CAMPAIGN_POLICY } = require('../config/gameConfig');
  const game = require('../features/games/services/perfectShotGameplayService');

  assert.equal(mongoose.connection.readyState, 0);

  originals = {
    GameSession, PrizeAward,
    findOne: GameSession.findOne,
    findOneAndUpdate: GameSession.findOneAndUpdate,
    updateOne: GameSession.updateOne,
    exists: PrizeAward.exists,
  };

  GameSession.findOne = filter => ({
    select: async selection => {
      assert.equal(selection, '+sessionTokenHash');
      assert.deepEqual(Object.keys(filter).sort(), [
        '_id', 'campaignId', 'gameId', 'userId',
      ]);
      assert.equal(filter.campaignId, CAMPAIGN_POLICY.campaignId);
      assert.equal(filter.gameId, 'perfect-shot');

      return (
        String(filter._id) === String(session._id) &&
        String(filter.userId) === String(session.userId) &&
        filter.campaignId === session.campaignId &&
        filter.gameId === session.gameId
      ) ? session : null;
    },
  });

  PrizeAward.exists = async filter => {
    assert.equal(String(filter.userId), String(owner));
    assert.equal(filter.campaignId, CAMPAIGN_POLICY.campaignId);
    return awarded ? { _id: new mongoose.Types.ObjectId() } : null;
  };

  GameSession.updateOne = async (filter, update) => {
    assert.equal(String(filter._id), String(session._id));
    assert.equal(filter.status, 'active');
    assert.ok(filter.expiresAt.$lte instanceof Date);
    assert.ok(session.expiresAt <= filter.expiresAt.$lte);
    assert.deepEqual(update.$set, {
      status: 'expired',
      outcome: 'not-qualified',
    });
    writes++;
    Object.assign(session, update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  };

  GameSession.findOneAndUpdate = async (filter, update) => {
    assert.equal(String(filter._id), String(session._id));
    assert.equal(String(filter.userId), String(owner));
    assert.equal(filter.campaignId, CAMPAIGN_POLICY.campaignId);
    assert.equal(filter.gameId, 'perfect-shot');
    assert.equal(filter.status, 'active');
    assert.equal(filter['gameState.revision'], session.gameState.revision);
    assert.equal(filter['gameState.phase'], 'aiming');
    assert.equal(filter['gameState.shot'], 1);
    assert.ok(session.expiresAt > filter.expiresAt.$gt);
    writes++;
    Object.assign(session, update.$set);
    return session;
  };

  function fixture() {
    awarded = false;
    const now = Date.now();
    session = {
      _id: new mongoose.Types.ObjectId(),
      userId: owner,
      campaignId: CAMPAIGN_POLICY.campaignId,
      gameId: 'perfect-shot',
      status: 'active',
      outcome: null,
      score: 0,
      startedAt: new Date(now - 1600),
      expiresAt: new Date(now + 60000),
      gameState: {
        revision: 1, phase: 'aiming', shot: 1,
        score: 0, hits: 0, perfects: 0, history: [],
        shotStartedAt: new Date(now - 1400),
        shotExpiresAt: new Date(now + 10000),
        nextShotAt: null,
        motion: {
          phaseX: 1.2, phaseY: 0.7,
          speedX: 2.1, speedY: 1.4,
          amplitudeX: 30, amplitudeY: 20,
        },
      },
    };

    const token = crypto.createHmac('sha256', process.env.JWT_SECRET)
      .update(`${session._id}:${owner}:${session.campaignId}:${session.gameId}`)
      .digest('hex');

    session.sessionTokenHash = crypto.createHash('sha256')
      .update(token).digest('hex');

    return {
      sessionId: String(session._id),
      sessionToken: token,
      shot: 1, x: 50, y: 50,
    };
  }

  const scenarios = [
    {
      name: 'Another customer, even with the correct session token',
      actor: stranger,
      code: 'SESSION_NOT_FOUND',
    },
    {
      name: 'Wrong campaign',
      change: () => { session.campaignId = 'different-campaign'; },
      code: 'SESSION_NOT_FOUND',
    },
    {
      name: 'Wrong game',
      change: () => { session.gameId = 'monkey'; },
      code: 'SESSION_NOT_FOUND',
    },
    {
      name: 'Missing session token',
      change: body => { delete body.sessionToken; },
      code: 'INVALID_SESSION_TOKEN',
    },
    {
      name: 'Incorrect session token',
      change: body => { body.sessionToken = 'incorrect-test-token'; },
      code: 'INVALID_SESSION_TOKEN',
    },
    {
      name: 'Stored token hash mismatch',
      change: () => { session.sessionTokenHash = '0'.repeat(64); },
      code: 'INVALID_SESSION_TOKEN',
    },
    {
      name: 'Existing campaign prize',
      change: () => { awarded = true; },
      code: 'PRIZE_ALREADY_AWARDED',
    },
    {
      name: 'Malformed session ID',
      change: body => { body.sessionId = 'invalid-id'; },
      code: 'INVALID_SESSION',
    },
  ];

  for (const method of ['nextShot', 'shoot']) {
    for (const scenario of scenarios) {
      const body = fixture();
      scenario.change?.(body);
      const before = writes;

      await assert.rejects(
        () => game[method](scenario.actor || owner, body),
        err => err.code === scenario.code,
        `${method}: ${scenario.name}`
      );

      assert.equal(writes, before, 'Rejected access caused a write');
      passed++;
      console.log(`PASS: ${method}: ${scenario.name}`);
    }
  }

  let body = fixture();
  session.status = 'completed';
  let before = writes;

  await assert.rejects(
    () => game.shoot(owner, body),
    err => err.code === 'SESSION_NOT_ACTIVE'
  );
  assert.equal(writes, before);
  passed++;
  console.log('PASS: Completed session cannot accept a shot');

  body = fixture();
  session.expiresAt = new Date(Date.now() - 1000);
  before = writes;

  await assert.rejects(
    () => game.shoot(owner, body),
    err => err.code === 'SESSION_EXPIRED'
  );
  assert.equal(writes, before + 1);
  assert.equal(session.status, 'expired');
  passed++;
  console.log('PASS: Expired session receives only a mocked expiry update');

  body = fixture();
  before = writes;
  const response = await game.shoot(owner, body);
  assert.equal(response.result.shot, 1);
  assert.equal(writes, before + 1);
  passed++;
  console.log('PASS: Valid owner can submit a shot');

  assert.equal(writes, 2);
  assert.equal(mongoose.connection.readyState, 0);
  console.log(`\nSESSION ACCESS: PASS (${passed} tests, ${writes} mocked writes)`);
}

main().catch(err => {
  console.error(err.stack);
  process.exitCode = 1;
}).finally(() => {
  if (originals) {
    originals.GameSession.findOne = originals.findOne;
    originals.GameSession.findOneAndUpdate = originals.findOneAndUpdate;
    originals.GameSession.updateOne = originals.updateOne;
    originals.PrizeAward.exists = originals.exists;
  }

  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
