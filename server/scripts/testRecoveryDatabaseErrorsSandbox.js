
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const Recovery = require('../features/prizes/models/PrizeDecisionRecovery');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const Spin = require('../features/games/models/Spin');

const {
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

const {
  recoverMissingPrizeDecisions,
} = require('../features/prizes/services/prizeDecisionRecoveryService');

const DB_NAME = 'hnc_step15q_sandbox';

const owned = {
  users: [],
  sessions: [],
};

let verified = false;
let passed = 0;

function newId() {
  return new mongoose.Types.ObjectId();
}

function injectedFailure() {
  const error = new Error('Simulated database failure');
  error.code = 'INJECTED_DB_FAILURE';
  return error;
}

function checkEnvironment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('Sandbox URI missing');
  }

  const parsed = new URL(uri);

  assert.ok(
    ['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)
  );

  assert.equal(
    decodeURIComponent(parsed.pathname),
    `/${DB_NAME}`
  );

  assert.equal(process.env.ALLOCATION_ENABLED, 'false');
  assert.notEqual(process.env.NODE_ENV, 'production');

  return uri;
}

async function verifyPermissions() {
  assert.equal(mongoose.connection.name, DB_NAME);

  const info = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    info.authInfo?.authenticatedUserRoles || [];

  const privileges =
    info.authInfo?.authenticatedUserPrivileges || [];

  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'readWrite');
  assert.equal(roles[0].db, DB_NAME);
  assert.ok(privileges.length > 0);

  for (const p of privileges) {
    assert.equal(p.resource?.db, DB_NAME);
    assert.equal(typeof p.resource?.collection, 'string');
    assert.notEqual(p.resource?.anyResource, true);
    assert.notEqual(p.resource?.cluster, true);
  }

  for (const [Model, name] of [
    [Recovery, 'unique_recovery_per_game_session'],
    [PrizeDecision, 'unique_prize_decision_per_session'],
  ]) {
    const indexes = await Model.collection.indexes();

    assert.ok(
      indexes.some(index =>
        index.name === name &&
        index.unique === true &&
        index.key?.gameSessionId === 1
      ),
      `Missing required index: ${name}`
    );
  }

  verified = true;

  console.log(
    'PASS: Restricted sandbox permissions and indexes verified'
  );
}

async function fixture() {
  const userId = newId();
  const sessionId = newId();

  // Record ownership before writing any fixtures.
  owned.users.push(userId);
  owned.sessions.push(sessionId);

  const user = await User.create({
    _id: userId,
    name: 'Recovery Database Error Test',
    email: `recovery-db-${userId}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    emailVerified: true,
    hasSpun: false,
  });

  const now = Date.now();

  const game = await GameSession.create({
    _id: sessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
    attemptNumber: 1,
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
    events: Array.from({ length: 7 }, (_, i) => ({
      type: 'tap',
      round: i + 1,
      success: true,
      serverAt: new Date(now - 25000 + i * 3000),
    })),
  });

  return { user, game };
}

async function runRecovery(f) {
  return recoverMissingPrizeDecisions({
    limit: 1,
    sessionIds: [String(f.game._id)],
  });
}

async function tracking(f) {
  return Recovery.findOne({
    gameSessionId: f.game._id,
  }).lean();
}

async function countDecisions(f) {
  return PrizeDecision.countDocuments({
    gameSessionId: f.game._id,
  });
}

async function test(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

// Temporarily replace a model method within the
// current test process. Always restore it.
//
// Do not run parallel tests while the method is
// replaced.
async function withInjectedMethod(
  model,
  methodName,
  replacement,
  action
) {
  const original = model[methodName];

  try {
    model[methodName] = replacement;
    return await action();
  } finally {
    model[methodName] = original;
  }
}

async function cleanup() {
  if (
    !verified ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  assert.equal(mongoose.connection.name, DB_NAME);

  if (
    owned.users.length === 0 ||
    owned.sessions.length === 0
  ) {
    return;
  }

  const filter = {
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  };

  // Stop cleanup if unexpected real awards or
  // legacy winning records were produced.
  assert.equal(
    await PrizeAward.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected real prize award'
  );

  assert.equal(
    await Spin.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected legacy spin'
  );

  await Recovery.deleteMany(filter);
  await PrizeDecision.deleteMany(filter);

  await GameSession.deleteMany({
    _id: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  await User.deleteMany({
    _id: { $in: owned.users },
  });

  const remaining = await Promise.all([
    Recovery.countDocuments(filter),
    PrizeDecision.countDocuments(filter),
    GameSession.countDocuments({
      _id: { $in: owned.sessions },
    }),
    User.countDocuments({
      _id: { $in: owned.users },
    }),
  ]);

  assert.ok(
    remaining.every(count => count === 0),
    'Fixture cleanup incomplete'
  );

  console.log(
    'PASS: Database error fixtures cleaned up'
  );
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

    // ============================================
    // TEST 1
    // Unexpected error during decision insert.
    // ============================================

    await test(
      'Decision insert error schedules retry',
      async () => {
        const f = await fixture();

        const result = await withInjectedMethod(
          PrizeDecision,
          'create',
          async () => {
            throw injectedFailure();
          },
          () => runRecovery(f)
        );

        assert.equal(result.created, 0);
        assert.equal(result.failed, 1);
        assert.equal(await countDecisions(f), 0);

        const record = await tracking(f);

        assert.equal(
          record.status,
          'retry_scheduled'
        );
        assert.equal(record.attempts, 1);
        assert.equal(
          record.lastErrorCode,
          'INJECTED_DB_FAILURE'
        );
        assert.ok(record.nextRetryAt > new Date());

        const premature = await runRecovery(f);

        assert.equal(premature.skipped, 1);
        assert.equal(premature.created, 0);
      }
    );

    // ============================================
    // TEST 2
    // Recovery works once a retry becomes due.
    // ============================================

    await test(
      'Recovery succeeds after transient error',
      async () => {
        const f = await fixture();

        await withInjectedMethod(
          PrizeDecision,
          'create',
          async () => {
            throw injectedFailure();
          },
          () => runRecovery(f)
        );

        // Advance only this test-owned retry time.
        const changed = await Recovery.updateOne(
          {
            gameSessionId: f.game._id,
            userId: f.user._id,
            status: 'retry_scheduled',
          },
          {
            $set: {
              nextRetryAt: new Date(Date.now() - 1000),
            },
          }
        );

        assert.equal(changed.matchedCount, 1);

        const result = await runRecovery(f);

        assert.equal(result.created, 1);
        assert.equal(result.failed, 0);
        assert.equal(await countDecisions(f), 1);

        const record = await tracking(f);

        assert.equal(record.status, 'completed');
        assert.equal(record.attempts, 2);
        assert.equal(record.nextRetryAt, null);
      }
    );

    // ============================================
    // TEST 3
    // Decision succeeds, tracking update fails.
    // ============================================

    await test(
      'Finalization failure preserves decision',
      async () => {
        const f = await fixture();

        const original = Recovery.findOneAndUpdate;

        const result = await withInjectedMethod(
          Recovery,
          'findOneAndUpdate',
          function (...args) {
            const update = args[1];

            // Inject only at the successful
            // completion transition, not at claim.
            if (
              update?.$set?.status === 'completed'
            ) {
              throw injectedFailure();
            }

            return original.apply(this, args);
          },
          () => runRecovery(f)
        );

        assert.equal(result.created, 0);
        assert.equal(result.failed, 1);
        assert.equal(await countDecisions(f), 1);

        const record = await tracking(f);

        assert.equal(record.status, 'processing');
        assert.equal(record.attempts, 1);
        assert.ok(record.leaseUntil > new Date());
      }
    );

    // ============================================
    // TEST 4
    // Next run reconciles the incomplete record.
    // ============================================

    await test(
      'Expired incomplete tracking reconciles',
      async () => {
        const f = await fixture();

        const original = Recovery.findOneAndUpdate;

        await withInjectedMethod(
          Recovery,
          'findOneAndUpdate',
          function (...args) {
            if (args[1]?.$set?.status === 'completed') {
              throw injectedFailure();
            }

            return original.apply(this, args);
          },
          () => runRecovery(f)
        );

        assert.equal(await countDecisions(f), 1);
        assert.equal((await tracking(f)).status, 'processing');

        // Simulate lease expiry for this record.
        const changed = await Recovery.updateOne(
          {
            gameSessionId: f.game._id,
            userId: f.user._id,
            status: 'processing',
          },
          {
            $set: {
              leaseUntil: new Date(Date.now() - 1000),
            },
          }
        );

        assert.equal(changed.matchedCount, 1);

        const reconciled = await runRecovery(f);

        assert.equal(reconciled.existing, 1);
        assert.equal(reconciled.created, 0);
        assert.equal(reconciled.failed, 0);
        assert.equal(await countDecisions(f), 1);

        const record = await tracking(f);

        assert.equal(record.status, 'completed');
        assert.equal(record.attempts, 1);
        assert.ok(record.completedAt);
      }
    );

    // ============================================
    // TEST 5
    // No prize allocation side effects.
    // ============================================

    await test(
      'Unexpected errors produce no real prizes',
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
    '\nDATABASE ERROR TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
