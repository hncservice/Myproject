
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const Spin = require('../features/games/models/Spin');
const Recovery = require('../features/prizes/models/PrizeDecisionRecovery');

const {
  recoverMissingPrizeDecisions,
} = require('../features/prizes/services/prizeDecisionRecoveryService');

const {
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

// =====================================================
// SANDBOX CONFIGURATION
// =====================================================

const DB_NAME = 'hnc_step15q_sandbox';

const owned = {
  users: [],
  sessions: [],
};

let permissionsVerified = false;
let passed = 0;

function newId() {
  return new mongoose.Types.ObjectId();
}

function checkEnvironment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('HNC_SANDBOX_MONGO_URI is missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(
      parsed.protocol
    ) ||
    decodeURIComponent(parsed.pathname) !==
      `/${DB_NAME}`
  ) {
    throw new Error('Unsafe sandbox database URI');
  }

  assert.equal(
    process.env.ALLOCATION_ENABLED,
    'false'
  );

  assert.notEqual(
    process.env.NODE_ENV,
    'production'
  );

  return uri;
}

async function verifyPermissions() {
  assert.equal(
    mongoose.connection.name,
    DB_NAME
  );

  const status = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    status.authInfo?.authenticatedUserRoles || [];

  const privileges =
    status.authInfo?.authenticatedUserPrivileges || [];

  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'readWrite');
  assert.equal(roles[0].db, DB_NAME);
  assert.ok(privileges.length > 0);

  for (const privilege of privileges) {
    assert.equal(
      privilege.resource?.db,
      DB_NAME
    );

    assert.equal(
      typeof privilege.resource?.collection,
      'string'
    );

    assert.notEqual(
      privilege.resource?.anyResource,
      true
    );

    assert.notEqual(
      privilege.resource?.cluster,
      true
    );
  }

  const indexes = await Recovery.collection.indexes();

  assert.ok(
    indexes.some(index =>
      index.name ===
        'unique_recovery_per_game_session' &&
      index.unique === true &&
      index.key?.gameSessionId === 1
    ),
    'Required unique recovery index missing'
  );

  const decisionIndexes =
    await PrizeDecision.collection.indexes();

  assert.ok(
    decisionIndexes.some(index =>
      index.name ===
        'unique_prize_decision_per_session' &&
      index.unique === true &&
      index.key?.gameSessionId === 1
    ),
    'Required unique decision index missing'
  );

  permissionsVerified = true;

  console.log(
    'PASS: Restricted sandbox permissions and indexes verified'
  );
}

// =====================================================
// TEST FIXTURE HELPERS
// =====================================================

async function makeUser(verified = true) {
  const _id = newId();

  owned.users.push(_id);

  return User.create({
    _id,
    name: 'Recovery Integration Sandbox Customer',
    email: `recovery-integration-${_id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    emailVerified: verified,
    hasSpun: false,
  });
}

async function makeGame(
  user,
  outcome = 'qualified'
) {
  const _id = newId();

  owned.sessions.push(_id);

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
    attemptNumber: 1,
    sessionTokenHash: crypto
      .randomBytes(32)
      .toString('hex'),
    status: 'completed',
    outcome,
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

async function runRecovery(game) {
  return recoverMissingPrizeDecisions({
    limit: 1,
    sessionIds: [String(game._id)],
  });
}

async function recoveryFor(game) {
  return Recovery.findOne({
    gameSessionId: game._id,
  }).lean();
}

async function decisionCount(game) {
  return PrizeDecision.countDocuments({
    gameSessionId: game._id,
  });
}

async function test(label, action) {
  await action();
  passed++;

  console.log(`PASS ${passed}: ${label}`);
}

// =====================================================
// CLEANUP
// =====================================================

async function cleanup() {
  if (
    !permissionsVerified ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  assert.equal(
    mongoose.connection.name,
    DB_NAME
  );

  if (
    owned.users.length === 0 ||
    owned.sessions.length === 0
  ) {
    return;
  }

  const fixtureFilter = {
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  };

  // Verify no real award or legacy spin was created
  // before deleting the test fixtures.
  assert.equal(
    await PrizeAward.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected PrizeAward created'
  );

  assert.equal(
    await Spin.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected Spin created'
  );

  await Recovery.deleteMany(fixtureFilter);

  await PrizeDecision.deleteMany(fixtureFilter);

  await GameSession.deleteMany({
    _id: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  await User.deleteMany({
    _id: { $in: owned.users },
  });

  const remaining = await Promise.all([
    Recovery.countDocuments(fixtureFilter),

    PrizeDecision.countDocuments(fixtureFilter),

    GameSession.countDocuments({
      _id: { $in: owned.sessions },
    }),

    User.countDocuments({
      _id: { $in: owned.users },
    }),
  ]);

  assert.ok(
    remaining.every(count => count === 0),
    'Sandbox fixture cleanup incomplete'
  );

  console.log(
    'PASS: Integration sandbox fixtures cleaned up'
  );
}

// =====================================================
// TESTS
// =====================================================

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

    // -------------------------------------------------
    // TEST 1: Successful recovery tracking
    // -------------------------------------------------

    await test(
      'Qualified recovery creates decision and completed tracking',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        const result = await runRecovery(game);

        assert.equal(result.created, 1);
        assert.equal(result.failed, 0);

        assert.equal(
          await decisionCount(game),
          1
        );

        const tracking = await recoveryFor(game);

        assert.ok(tracking);
        assert.equal(tracking.status, 'completed');
        assert.equal(tracking.attempts, 1);
        assert.ok(tracking.completedAt);
        assert.equal(tracking.leaseUntil, null);

        assert.equal(result.prizeAllocated, false);
        assert.equal(result.drawExecuted, false);
        assert.equal(result.qrGenerated, false);
      }
    );

    // -------------------------------------------------
    // TEST 2: Repeat run does not duplicate records
    // -------------------------------------------------

    await test(
      'Repeated successful recovery creates no duplicates',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        await runRecovery(game);

        const first = await recoveryFor(game);

        const again = await runRecovery(game);

        const second = await recoveryFor(game);

        assert.equal(again.created, 0);
        assert.equal(again.failed, 0);

        assert.equal(
          await decisionCount(game),
          1
        );

        assert.equal(
          String(first._id),
          String(second._id)
        );

        assert.equal(second.attempts, 1);
        assert.equal(second.status, 'completed');
      }
    );

    // -------------------------------------------------
    // TEST 3: Unverified customer permanent hold
    // -------------------------------------------------

    await test(
      'Unverified customer is held without decision',
      async () => {
        const user = await makeUser(false);
        const game = await makeGame(user);

        const result = await runRecovery(game);

        assert.equal(result.created, 0);
        assert.equal(result.failed, 1);

        assert.equal(
          await decisionCount(game),
          0
        );

        const tracking = await recoveryFor(game);

        assert.ok(tracking);
        assert.equal(tracking.status, 'held');
        assert.equal(tracking.attempts, 1);
        assert.equal(
          tracking.lastErrorCode,
          'EMAIL_NOT_VERIFIED'
        );
      }
    );

    // -------------------------------------------------
    // TEST 4: Permanent hold cannot be retried
    // -------------------------------------------------

    await test(
      'Held recovery is skipped on subsequent run',
      async () => {
        const user = await makeUser(false);
        const game = await makeGame(user);

        await runRecovery(game);

        const result = await runRecovery(game);

        const tracking = await recoveryFor(game);

        assert.equal(result.created, 0);
        assert.equal(result.skipped, 1);
        assert.equal(result.failed, 0);

        assert.equal(tracking.status, 'held');
        assert.equal(tracking.attempts, 1);

        assert.equal(
          await decisionCount(game),
          0
        );
      }
    );

    // -------------------------------------------------
    // TEST 5: Scheduled retry not due
    // -------------------------------------------------

    await test(
      'Recovery respects future retry schedule',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        await Recovery.create({
          gameSessionId: game._id,
          userId: user._id,
          campaignId: CAMPAIGN_POLICY.campaignId,
          status: 'retry_scheduled',
          attempts: 1,
          lastErrorCode: 'TEMPORARY_ERROR',
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(
            Date.now() + 3600000
          ),
        });

        const result = await runRecovery(game);

        assert.equal(result.created, 0);
        assert.equal(result.skipped, 1);

        assert.equal(
          await decisionCount(game),
          0
        );

        const tracking = await recoveryFor(game);

        assert.equal(tracking.attempts, 1);
        assert.equal(
          tracking.status,
          'retry_scheduled'
        );
      }
    );

    // -------------------------------------------------
    // TEST 6: Due retry can complete
    // -------------------------------------------------

    await test(
      'Due scheduled retry creates decision',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        await Recovery.create({
          gameSessionId: game._id,
          userId: user._id,
          campaignId: CAMPAIGN_POLICY.campaignId,
          status: 'retry_scheduled',
          attempts: 1,
          lastErrorCode: 'TEMPORARY_ERROR',
          nextRetryAt: new Date(
            Date.now() - 60000
          ),
        });

        const result = await runRecovery(game);

        assert.equal(result.created, 1);
        assert.equal(result.failed, 0);

        assert.equal(
          await decisionCount(game),
          1
        );

        const tracking = await recoveryFor(game);

        assert.equal(tracking.status, 'completed');
        assert.equal(tracking.attempts, 2);
        assert.equal(tracking.nextRetryAt, null);
      }
    );

    // -------------------------------------------------
    // TEST 7: Concurrent integrated recovery
    // -------------------------------------------------

    await test(
      'Concurrent recovery creates only one decision',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        const results = await Promise.all([
          runRecovery(game),
          runRecovery(game),
          runRecovery(game),
          runRecovery(game),
          runRecovery(game),
        ]);

        assert.equal(
          await decisionCount(game),
          1
        );

        assert.equal(
          await Recovery.countDocuments({
            gameSessionId: game._id,
          }),
          1
        );

        const tracking = await recoveryFor(game);

        assert.equal(tracking.status, 'completed');
        assert.equal(tracking.attempts, 1);

        assert.equal(
          results.reduce(
            (sum, result) => sum + result.created,
            0
          ),
          1
        );

        assert.ok(
          results.every(result =>
            result.failed === 0
          )
        );
      }
    );

    // -------------------------------------------------
    // TEST 8: Maximum five attempts
    // -------------------------------------------------

    await test(
      'Exhausted recovery cannot create decision',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        await Recovery.create({
          gameSessionId: game._id,
          userId: user._id,
          campaignId: CAMPAIGN_POLICY.campaignId,
          status: 'held',
          attempts: 5,
          lastErrorCode: 'MAX_ATTEMPTS_REACHED',
        });

        const result = await runRecovery(game);

        assert.equal(result.created, 0);
        assert.equal(result.skipped, 1);

        assert.equal(
          await decisionCount(game),
          0
        );

        const tracking = await recoveryFor(game);

        assert.equal(tracking.status, 'held');
        assert.equal(tracking.attempts, 5);
      }
    );

    // -------------------------------------------------
    // TEST 9: Unqualified gameplay never tracked
    // -------------------------------------------------

    await test(
      'Unqualified game creates no recovery task',
      async () => {
        const user = await makeUser();

        const game = await makeGame(
          user,
          'not-qualified'
        );

        const result = await runRecovery(game);

        assert.equal(result.scanned, 0);
        assert.equal(result.created, 0);

        assert.equal(
          await decisionCount(game),
          0
        );

        assert.equal(
          await Recovery.countDocuments({
            gameSessionId: game._id,
          }),
          0
        );
      }
    );

    // -------------------------------------------------
    // TEST 10: No real awards, spins or QR tokens
    // -------------------------------------------------

    await test(
      'Recovery creates no real prizes or spins',
      async () => {
        assert.equal(
          await PrizeAward.countDocuments({
            userId: { $in: owned.users },
          }),
          0
        );

        assert.equal(
          await Spin.countDocuments({
            userId: { $in: owned.users },
          }),
          0
        );
      }
    );

    console.log(
      `\nRESULT: ${passed}/10 TESTS PASSED`
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
    '\nINTEGRATION TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
