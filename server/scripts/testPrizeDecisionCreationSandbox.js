
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../features/authentication/models/User');
const Spin = require('../features/games/models/Spin');
const GameSession = require('../features/games/models/GameSession');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');

const {
  createPrizeDecision,
} = require('../features/prizes/services/prizeDecisionCreationService');

const {
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

const DB_NAME = 'hnc_step15q_sandbox';

const fixtures = {
  users: [],
  sessions: [],
  decisions: [],
  spins: [],
};

let passed = 0;
let permissionsVerified = false;

function newId() {
  return new mongoose.Types.ObjectId();
}

function checkEnvironment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('HNC_SANDBOX_MONGO_URI missing');
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
    throw new Error('Allocation must remain disabled');
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

async function createUser(overrides = {}) {
  const id = newId();
  fixtures.users.push(id);

  return User.create({
    _id: id,
    name: 'Sandbox Prize Customer',
    email: `decision-${id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_NOT_REAL_PASSWORD',
    emailVerified: true,
    hasSpun: false,
    ...overrides,
  });
}

async function createGame(
  user,
  gameId = 'monkey',
  options = {}
) {
  const id = newId();
  fixtures.sessions.push(id);

  const base = Date.now();
  const startedAt = new Date(base - 30000);
  const completedAt = new Date(base - 1000);
  const expiresAt = new Date(base + 90000);

  let score;
  let gameState;
  let events;

  if (gameId === 'monkey') {
    score = 7;

    gameState = {
      revision: 14,
      phase: 'finished',
      round: 7,
      hits: 7,
      misses: 0,
    };

    events = Array.from({ length: 7 }, (_, index) => ({
      type: 'tap',
      round: index + 1,
      success: true,
      serverAt: new Date(base - 25000 + index * 3000),
    }));
  } else {
    const scores = [100, 70, 100, 70, 100];

    const history = scores.map((points, index) => {
      const offset = points === 100 ? 0 : 4;

      return {
        shot: index + 1,
        points,
        category: points === 100 ? 'perfect' : 'great',
        x: 50 + offset,
        y: 50,
        targetX: 50,
        targetY: 50,
        distance: offset * 5,
        timedOut: false,
        serverAt: new Date(
          base - 25000 + index * 4000
        ),
      };
    });

    score = 440;

    gameState = {
      revision: 12,
      phase: 'finished',
      shot: 5,
      score,
      hits: 5,
      perfects: 3,
      history,
    };

    events = history.map((entry) => ({
      type: 'shot',
      shot: entry.shot,
      points: entry.points,
      category: entry.category,
      serverAt: entry.serverAt,
    }));
  }

  return GameSession.create({
    _id: id,
    userId: user._id,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId,
    attemptNumber: 1,
    sessionTokenHash: crypto
      .randomBytes(32)
      .toString('hex'),
    status: 'completed',
    outcome: options.outcome || 'qualified',
    score,
    startedAt,
    completedAt,
    expiresAt,
    gameState,
    events,
  });
}

async function createLegacyWin(user) {
  const id = newId();
  fixtures.spins.push(id);

  return Spin.create({
    _id: id,
    userId: user._id,
    status: 'won',
    redemptionStatus: 'pending',
    qrToken: crypto.randomBytes(32).toString('hex'),
  });
}

async function execute(user, game) {
  return createPrizeDecision({
    userId: user._id,
    gameSessionId: game._id,
  });
}

async function expectError(operation, code) {
  await assert.rejects(operation, error => {
    assert.equal(error.code, code);
    return true;
  });
}

async function test(name, callback) {
  await callback();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}

async function cleanup() {
  if (
    !permissionsVerified ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  // Delete only objects created by this script.
  await PrizeDecision.deleteMany({
    gameSessionId: { $in: fixtures.sessions },
    userId: { $in: fixtures.users },
  });

  await Spin.deleteMany({
    _id: { $in: fixtures.spins },
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
    Spin.countDocuments({
      _id: { $in: fixtures.spins },
    }),
    GameSession.countDocuments({
      _id: { $in: fixtures.sessions },
    }),
    User.countDocuments({
      _id: { $in: fixtures.users },
    }),
  ]);

  assert.ok(
    remaining.every(count => count === 0),
    'Fixture cleanup incomplete'
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

    const indexes =
      await PrizeDecision.collection.indexes();

    assert.ok(indexes.some(index =>
      index.name ===
        'unique_prize_decision_per_session' &&
      index.unique === true &&
      index.key?.gameSessionId === 1
    ));

    console.log(
      'PASS: Unique decision index verified'
    );

    await test('Clean Monkey ready for draw', async () => {
      const user = await createUser();
      const game = await createGame(user);

      const result = await execute(user, game);

      assert.equal(result.status, 'ready_for_draw');
      assert.equal(result.existing, false);
      assert.equal(result.drawExecuted, false);
      assert.equal(result.prizeAllocated, false);
      assert.equal(result.qrGenerated, false);
    });

    await test('Clean Perfect Shot ready for draw', async () => {
      const user = await createUser();
      const game = await createGame(
        user, 'perfect-shot'
      );

      const result = await execute(user, game);

      assert.equal(result.status, 'ready_for_draw');
      assert.deepEqual(result.riskReasons, []);
    });

    await test('Manipulated score held for review', async () => {
      const user = await createUser();
      const game = await createGame(user);

      await GameSession.updateOne(
        { _id: game._id },
        { $set: { score: 99 } }
      );

      const result = await execute(user, game);

      assert.equal(result.status, 'pending_review');
      assert.ok(result.riskReasons.includes(
        'MONKEY_SCORE_MISMATCH'
      ));
    });

    await test('Duplicate request returns existing', async () => {
      const user = await createUser();
      const game = await createGame(user);

      const first = await execute(user, game);
      const second = await execute(user, game);

      assert.equal(first.decisionId, second.decisionId);
      assert.equal(second.existing, true);

      assert.equal(
        await PrizeDecision.countDocuments({
          gameSessionId: game._id,
        }),
        1
      );
    });

    await test('Concurrent requests create one decision', async () => {
      const user = await createUser();
      const game = await createGame(user);

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          execute(user, game)
        )
      );

      const ids = new Set(
        results.map(result => result.decisionId)
      );

      assert.equal(ids.size, 1);

      assert.equal(
        await PrizeDecision.countDocuments({
          gameSessionId: game._id,
        }),
        1
      );
    });

    await test('Unverified customer rejected', async () => {
      const user = await createUser({
        emailVerified: false,
      });

      const game = await createGame(user);

      await expectError(
        () => execute(user, game),
        'EMAIL_NOT_VERIFIED'
      );
    });

    await test('Legacy hasSpun restriction preserved', async () => {
      const user = await createUser({
        hasSpun: true,
      });

      const game = await createGame(user);

      await expectError(
        () => execute(user, game),
        'PRIZE_ALREADY_AWARDED'
      );
    });

    await test('Legacy winning Spin blocks new decision', async () => {
      const user = await createUser();
      const game = await createGame(user);

      await createLegacyWin(user);

      await expectError(
        () => execute(user, game),
        'LEGACY_PRIZE_EXISTS'
      );
    });

    await test('Unqualified game is rejected', async () => {
      const user = await createUser();
      const game = await createGame(
        user,
        'monkey',
        { outcome: 'not-qualified' }
      );

      await expectError(
        () => execute(user, game),
        'GAME_NOT_QUALIFIED'
      );
    });

    await test('Approved decision is not reset', async () => {
      const user = await createUser();
      const game = await createGame(user);

      const first = await execute(user, game);

      const adminId = newId();

      await PrizeDecision.updateOne(
        { _id: first.decisionId },
        {
          $set: {
            status: 'approved',
            reviewedByAdminId: adminId,
            reviewedAt: new Date(),
          },
        }
      );

      const second = await execute(user, game);

      assert.equal(second.existing, true);
      assert.equal(second.status, 'approved');
    });

    await test('Rejected decision is not reset', async () => {
      const user = await createUser();
      const game = await createGame(user);

      const first = await execute(user, game);

      await PrizeDecision.updateOne(
        { _id: first.decisionId },
        {
          $set: {
            status: 'rejected',
            reviewedByAdminId: newId(),
            reviewedAt: new Date(),
          },
        }
      );

      const second = await execute(user, game);

      assert.equal(second.existing, true);
      assert.equal(second.status, 'rejected');
    });

    console.log(
      `\nRESULT: ${passed}/11 TESTS PASSED`
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
