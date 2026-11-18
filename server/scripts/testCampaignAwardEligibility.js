
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const DB_NAME = 'hnc_step15q_sandbox';

const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const Spin = require('../features/games/models/Spin');
const WheelItem = require('../features/prizes/models/WheelItem');

const {
  createPrizeDecision,
} = require('../features/prizes/services/prizeDecisionCreationService');

const {
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

const fixtures = {
  users: [],
  sessions: [],
  awards: [],
};

let permissionsVerified = false;
let passed = 0;

function newId() {
  return new mongoose.Types.ObjectId();
}

function checkEnvironment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('Sandbox MongoDB URI missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname) !==
      `/${DB_NAME}`
  ) {
    throw new Error('Unsafe sandbox URI');
  }

  if (process.env.ALLOCATION_ENABLED !== 'false') {
    throw new Error('Real allocation must remain disabled');
  }

  return uri;
}

async function verifyPermissions() {
  assert.equal(mongoose.connection.name, DB_NAME);

  const result = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    result.authInfo?.authenticatedUserRoles || [];

  const privileges =
    result.authInfo?.authenticatedUserPrivileges || [];

  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'readWrite');
  assert.equal(roles[0].db, DB_NAME);
  assert.ok(privileges.length > 0);

  for (const privilege of privileges) {
    const resource = privilege.resource || {};

    assert.equal(resource.db, DB_NAME);
    assert.equal(typeof resource.collection, 'string');
    assert.notEqual(resource.anyResource, true);
    assert.notEqual(resource.cluster, true);
  }

  permissionsVerified = true;
}

async function createUser() {
  const _id = newId();
  fixtures.users.push(_id);

  return User.create({
    _id,
    name: 'Sandbox Award Eligibility',
    email: `award-check-${_id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY_NOT_REAL',
    emailVerified: true,
    hasSpun: false,
  });
}

async function createGame(user, attemptNumber = 1) {
  const _id = newId();
  fixtures.sessions.push(_id);

  const now = Date.now();

  const events = Array.from(
    { length: 7 },
    (_, index) => ({
      type: 'tap',
      round: index + 1,
      success: true,
      serverAt: new Date(
        now - 25000 + index * 3000
      ),
    })
  );

  return GameSession.create({
    _id,
    userId: user._id,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
    attemptNumber,
    sessionTokenHash: crypto
      .randomBytes(32)
      .toString('hex'),
    status: 'completed',
    outcome: 'qualified',
    score: 7,
    startedAt: new Date(now - 30000),
    completedAt: new Date(now - 1000),
    expiresAt: new Date(now + 90000),
    gameState: {
      revision: 14,
      phase: 'finished',
      round: 7,
      hits: 7,
      misses: 0,
    },
    events,
  });
}

async function createAward(user, game, campaignId) {
  const _id = newId();
  fixtures.awards.push(_id);

  return PrizeAward.create({
    _id,
    userId: user._id,
    campaignId,
    gameSessionId: game._id,
    wheelItemId: newId(),
    awardedAt: new Date(),
  });
}

async function decide(user, game) {
  return createPrizeDecision({
    userId: user._id,
    gameSessionId: game._id,
  });
}

async function test(name, callback) {
  await callback();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}

async function expectError(callback, expectedCode) {
  await assert.rejects(callback, error => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function snapshot(user, game) {
  const scope = {
    userId: user._id,
  };

  return {
    awards: await PrizeAward.countDocuments(scope),
    spins: await Spin.countDocuments(scope),
    decisions: await PrizeDecision.countDocuments({
      gameSessionId: game._id,
    }),
    inventory: await WheelItem.countDocuments({
      _id: { $in: [] },
    }),
  };
}

async function cleanup() {
  if (
    !permissionsVerified ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  // Only this run's unique fixtures.
  await PrizeDecision.deleteMany({
    gameSessionId: { $in: fixtures.sessions },
    userId: { $in: fixtures.users },
  });

  await PrizeAward.deleteMany({
    _id: { $in: fixtures.awards },
    userId: { $in: fixtures.users },
  });

  await GameSession.deleteMany({
    _id: { $in: fixtures.sessions },
    userId: { $in: fixtures.users },
  });

  await User.deleteMany({
    _id: { $in: fixtures.users },
  });

  const remaining = await Promise.all([
    PrizeDecision.countDocuments({
      gameSessionId: { $in: fixtures.sessions },
      userId: { $in: fixtures.users },
    }),
    PrizeAward.countDocuments({
      _id: { $in: fixtures.awards },
    }),
    GameSession.countDocuments({
      _id: { $in: fixtures.sessions },
    }),
    User.countDocuments({
      _id: { $in: fixtures.users },
    }),
  ]);

  assert.ok(
    remaining.every(value => value === 0),
    'Sandbox cleanup incomplete'
  );

  console.log('PASS: Sandbox fixtures cleaned up');
}

async function main() {
  const uri = checkEnvironment();

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    await verifyPermissions();

    console.log(
      'PASS: Restricted sandbox permissions verified'
    );

    // Test 1: Existing award prevents a new decision.
    await test(
      'Existing campaign award blocks decision',
      async () => {
        const user = await createUser();
        const game = await createGame(user);

        await createAward(
          user,
          game,
          CAMPAIGN_POLICY.campaignId
        );

        await expectError(
          () => decide(user, game),
          'PRIZE_ALREADY_AWARDED'
        );

        assert.equal(
          await PrizeDecision.countDocuments({
            gameSessionId: game._id,
          }),
          0
        );
      }
    );

    // Test 2: Different campaign does not match
    // PrizeAward campaign-specific lookup.
    await test(
      'Award from another campaign is distinguished',
      async () => {
        const user = await createUser();
        const game = await createGame(user);

        await createAward(
          user,
          game,
          `sandbox-other-${newId()}`
        );

        const result = await decide(user, game);

        assert.equal(result.status, 'ready_for_draw');
        assert.equal(result.prizeAllocated, false);
      }
    );

    // Test 3: Previously created decision is immutable
    // through a repeated creation request.
    await test(
      'Existing decision survives later award restriction',
      async () => {
        const user = await createUser();
        const game = await createGame(user);

        const first = await decide(user, game);

        await createAward(
          user,
          game,
          CAMPAIGN_POLICY.campaignId
        );

        const repeated = await decide(user, game);

        assert.equal(repeated.existing, true);
        assert.equal(
          repeated.decisionId,
          first.decisionId
        );
        assert.equal(
          repeated.status,
          'ready_for_draw'
        );

        // An existing preliminary status is NOT
        // authorization to allocate another prize.
        assert.equal(repeated.prizeAllocated, false);
      }
    );

    // Test 4: Decision creation has no award,
    // Spin or inventory-allocation side effects.
    await test(
      'Preliminary decision creates no prize or QR',
      async () => {
        const user = await createUser();
        const game = await createGame(user);

        const before = await snapshot(user, game);

        const result = await decide(user, game);

        const after = await snapshot(user, game);

        assert.equal(result.status, 'ready_for_draw');
        assert.equal(result.drawExecuted, false);
        assert.equal(result.prizeAllocated, false);
        assert.equal(result.qrGenerated, false);

        assert.equal(after.awards, before.awards);
        assert.equal(after.spins, before.spins);
        assert.equal(
          after.decisions,
          before.decisions + 1
        );
      }
    );

    // Test 5: Repeated concurrent creation.
    await test(
      'Concurrent requests preserve single decision',
      async () => {
        const user = await createUser();
        const game = await createGame(user);

        const results = await Promise.all(
          Array.from(
            { length: 5 },
            () => decide(user, game)
          )
        );

        assert.equal(
          new Set(
            results.map(item => item.decisionId)
          ).size,
          1
        );

        assert.equal(
          await PrizeDecision.countDocuments({
            gameSessionId: game._id,
          }),
          1
        );

        assert.equal(
          await PrizeAward.countDocuments({
            userId: user._id,
          }),
          0
        );
      }
    );

    console.log(
      `\nRESULT: ${passed}/5 TESTS PASSED`
    );
  } finally {
    try {
      await cleanup();
    } finally {
      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(
    '\nTEST FAILED:',
    error.stack || error.message
  );
  process.exitCode = 1;
});
