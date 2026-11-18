
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

const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const {
  createPrizeDecision,
} = require('../features/prizes/services/prizeDecisionCreationService');

const {
  claimRecovery,
  finishRecovery,
} = require('../features/prizes/services/prizeRecoveryClaimService');

const {
  reconcileExistingDecision,
} = require('../features/prizes/services/prizeRecoveryReconciliationService');

const {
  recoverMissingPrizeDecisions,
} = require('../features/prizes/services/prizeDecisionRecoveryService');

const DB_NAME = 'hnc_step15q_sandbox';

const owned = {
  users: [],
  sessions: [],
};

let authorized = false;
let passed = 0;

function newId() {
  return new mongoose.Types.ObjectId();
}

function checkEnvironment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) throw new Error('Sandbox URI missing');

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

  for (const privilege of privileges) {
    assert.equal(privilege.resource?.db, DB_NAME);
    assert.equal(
      typeof privilege.resource?.collection,
      'string'
    );
    assert.notEqual(privilege.resource?.anyResource, true);
    assert.notEqual(privilege.resource?.cluster, true);
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
      `Missing unique index: ${name}`
    );
  }

  authorized = true;

  console.log(
    'PASS: Restricted sandbox permissions and indexes verified'
  );
}

async function fixture() {
  const userId = newId();
  const sessionId = newId();

  // Register ownership before any database writes.
  owned.users.push(userId);
  owned.sessions.push(sessionId);

  const user = await User.create({
    _id: userId,
    name: 'Recovery Fault Sandbox Customer',
    email: `recovery-fault-${userId}@sandbox.invalid`,
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

  return {
    user,
    game,
    identity: {
      gameSessionId: game._id,
      userId: user._id,
      campaignId: CAMPAIGN_POLICY.campaignId,
    },
  };
}

async function tracking(f) {
  return Recovery.findOne({
    gameSessionId: f.game._id,
  }).lean();
}

async function decisionCount(f) {
  return PrizeDecision.countDocuments({
    gameSessionId: f.game._id,
  });
}

async function runRecovery(f) {
  return recoverMissingPrizeDecisions({
    limit: 1,
    sessionIds: [String(f.game._id)],
  });
}

async function createDecision(f) {
  return createPrizeDecision({
    userId: f.user._id,
    gameSessionId: f.game._id,
  });
}

async function expireClaim(f) {
  const result = await Recovery.updateOne(
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

  assert.equal(result.matchedCount, 1);
}

async function test(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

async function cleanup() {
  if (
    !authorized ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  assert.equal(mongoose.connection.name, DB_NAME);

  if (!owned.sessions.length) return;

  const filter = {
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  };

  // Never silently remove evidence of an
  // unexpected actual prize or legacy spin.
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
    remaining.every(n => n === 0),
    'Sandbox cleanup incomplete'
  );

  console.log('PASS: Fault-injection fixtures cleaned up');
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

    // ------------------------------------------------
    // TEST 1: Crash after decision creation
    // ------------------------------------------------

    await test(
      'Existing decision survives unfinished worker claim',
      async () => {
        const f = await fixture();
        const claim = await claimRecovery(f.identity);

        assert.equal(claim.claimed, true);

        await createDecision(f);

        // Simulated process stop: intentionally omit
        // finishRecovery().
        assert.equal(await decisionCount(f), 1);
        assert.equal((await tracking(f)).status, 'processing');

        await expireClaim(f);

        const result = await runRecovery(f);

        assert.equal(result.existing, 1);
        assert.equal(result.failed, 0);
        assert.equal(await decisionCount(f), 1);

        const record = await tracking(f);

        assert.equal(record.status, 'completed');
        assert.equal(record.attempts, 1);
        assert.ok(record.completedAt);
      }
    );

    // ------------------------------------------------
    // TEST 2: Stale worker cannot finalize
    // ------------------------------------------------

    await test(
      'Expired worker cannot overwrite reconciled result',
      async () => {
        const f = await fixture();
        const claim = await claimRecovery(f.identity);

        await createDecision(f);
        await expireClaim(f);

        const reconciliation =
          await reconcileExistingDecision(f.identity);

        assert.equal(reconciliation.reconciled, true);

        await assert.rejects(
          () => finishRecovery({
            recoveryId: claim.recoveryId,
            token: claim.token,
            errorCode: 'TEMPORARY_ERROR',
          }),
          error => error.code === 'CLAIM_EXPIRED'
        );

        const record = await tracking(f);

        assert.equal(record.status, 'completed');
        assert.equal(record.attempts, 1);
        assert.equal(await decisionCount(f), 1);
      }
    );

    // ------------------------------------------------
    // TEST 3: Transient failure scheduling
    // ------------------------------------------------

    await test(
      'Reported transient failure schedules retry',
      async () => {
        const f = await fixture();
        const claim = await claimRecovery(f.identity);

        assert.equal(claim.claimed, true);

        // Inject a reported transient failure at
        // the claim-finalization boundary.
        const finished = await finishRecovery({
          recoveryId: claim.recoveryId,
          token: claim.token,
          errorCode: 'TEMPORARY_ERROR',
        });

        assert.equal(finished.status, 'retry_scheduled');
        assert.ok(finished.nextRetryAt > new Date());

        const premature = await runRecovery(f);

        assert.equal(premature.skipped, 1);
        assert.equal(premature.created, 0);
        assert.equal(await decisionCount(f), 0);

        const record = await tracking(f);

        assert.equal(record.attempts, 1);
        assert.equal(record.status, 'retry_scheduled');
      }
    );

    // ------------------------------------------------
    // TEST 4: Recovery after scheduled retry
    // ------------------------------------------------

    await test(
      'Due retry creates exactly one decision',
      async () => {
        const f = await fixture();
        const claim = await claimRecovery(f.identity);

        await finishRecovery({
          recoveryId: claim.recoveryId,
          token: claim.token,
          errorCode: 'TEMPORARY_ERROR',
        });

        // Advance only this test fixture's retry time.
        await Recovery.updateOne(
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

        const result = await runRecovery(f);

        assert.equal(result.created, 1);
        assert.equal(result.failed, 0);
        assert.equal(await decisionCount(f), 1);

        const record = await tracking(f);

        assert.equal(record.status, 'completed');
        assert.equal(record.attempts, 2);
      }
    );

    // ------------------------------------------------
    // TEST 5: New worker claim fences old worker
    // ------------------------------------------------

    await test(
      'New worker ownership rejects stale token',
      async () => {
        const f = await fixture();

        const oldClaim = await claimRecovery(f.identity);

        assert.equal(oldClaim.claimed, true);

        await expireClaim(f);

        const newClaim = await claimRecovery(f.identity);

        assert.equal(newClaim.claimed, true);
        assert.equal(newClaim.attempts, 2);

        await assert.rejects(
          () => finishRecovery({
            recoveryId: oldClaim.recoveryId,
            token: oldClaim.token,
          }),
          error => error.code === 'CLAIM_EXPIRED'
        );

        // New worker's lease remains valid.
        const completed = await finishRecovery({
          recoveryId: newClaim.recoveryId,
          token: newClaim.token,
        });

        assert.equal(completed.status, 'completed');
        assert.equal((await tracking(f)).attempts, 2);
      }
    );

    // ------------------------------------------------
    // TEST 6: Reconciliation cannot create decisions
    // ------------------------------------------------

    await test(
      'Reconciliation never invents missing decision',
      async () => {
        const f = await fixture();

        await Recovery.create({
          ...f.identity,
          status: 'pending',
        });

        const result =
          await reconcileExistingDecision(f.identity);

        assert.equal(result.reconciled, false);
        assert.equal(result.reason, 'DECISION_NOT_FOUND');
        assert.equal(await decisionCount(f), 0);
        assert.equal((await tracking(f)).status, 'pending');
      }
    );

    // ------------------------------------------------
    // TEST 7: No actual prizes
    // ------------------------------------------------

    await test(
      'Fault scenarios create no real prizes',
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
      `\nRESULT: ${passed}/7 TESTS PASSED`
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
    '\nFAULT-INJECTION TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
