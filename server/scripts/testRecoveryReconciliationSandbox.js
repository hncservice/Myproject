
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

  if (!uri) {
    throw new Error('Sandbox URI missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname) !== `/${DB_NAME}`
  ) {
    throw new Error('Unsafe sandbox URI');
  }

  assert.equal(process.env.ALLOCATION_ENABLED, 'false');
  assert.notEqual(process.env.NODE_ENV, 'production');

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
    assert.equal(privilege.resource?.db, DB_NAME);
    assert.equal(
      typeof privilege.resource?.collection,
      'string'
    );
    assert.notEqual(privilege.resource?.anyResource, true);
    assert.notEqual(privilege.resource?.cluster, true);
  }

  for (const [Model, indexName] of [
    [Recovery, 'unique_recovery_per_game_session'],
    [PrizeDecision, 'unique_prize_decision_per_session'],
  ]) {
    const indexes = await Model.collection.indexes();

    assert.ok(
      indexes.some(index =>
        index.name === indexName &&
        index.unique === true &&
        index.key?.gameSessionId === 1
      ),
      `Missing unique index: ${indexName}`
    );
  }

  authorized = true;

  console.log('PASS: Sandbox permissions and indexes verified');
}

async function makeFixture() {
  const userId = newId();
  const gameId = newId();

  owned.users.push(userId);
  owned.sessions.push(gameId);

  const user = await User.create({
    _id: userId,
    name: 'Reconciliation Sandbox Customer',
    email: `reconcile-${userId}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    emailVerified: true,
    hasSpun: false,
  });

  const now = Date.now();

  const game = await GameSession.create({
    _id: gameId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
    attemptNumber: 1,
    sessionTokenHash: crypto.randomBytes(32).toString('hex'),
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
    events: Array.from({ length: 7 }, (_, index) => ({
      type: 'tap',
      round: index + 1,
      success: true,
      serverAt: new Date(now - 25000 + index * 3000),
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

async function createDecision(fixture) {
  await createPrizeDecision({
    userId: fixture.user._id,
    gameSessionId: fixture.game._id,
  });
}

async function tracking(fixture) {
  return Recovery.findOne({
    gameSessionId: fixture.game._id,
  }).lean();
}

async function runRecovery(fixture) {
  return recoverMissingPrizeDecisions({
    limit: 1,
    sessionIds: [String(fixture.game._id)],
  });
}

async function test(label, action) {
  await action();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

async function cleanup() {
  if (!authorized || mongoose.connection.readyState !== 1) {
    return;
  }

  assert.equal(mongoose.connection.name, DB_NAME);

  const filter = {
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  };

  assert.equal(
    await PrizeAward.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected real award created'
  );

  assert.equal(
    await Spin.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected legacy spin created'
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
    'Sandbox cleanup incomplete'
  );

  console.log('PASS: Reconciliation fixtures cleaned up');
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

    await test(
      'Pending recovery reconciles an existing decision',
      async () => {
        const f = await makeFixture();

        await createDecision(f);

        await Recovery.create({
          ...f.identity,
          status: 'pending',
        });

        const result = await reconcileExistingDecision(f.identity);

        assert.equal(result.reconciled, true);
        assert.equal((await tracking(f)).status, 'completed');
      }
    );

    await test(
      'Expired processing lease reconciles successfully',
      async () => {
        const f = await makeFixture();

        await createDecision(f);

        const claim = await claimRecovery(f.identity);

        assert.equal(claim.claimed, true);

        // Simulate an abandoned claim on this test-owned record.
        await Recovery.updateOne(
          {
            gameSessionId: f.game._id,
            status: 'processing',
          },
          {
            $set: {
              leaseUntil: new Date(Date.now() - 1000),
            },
          }
        );

        const result = await reconcileExistingDecision(f.identity);

        assert.equal(result.reconciled, true);
        assert.equal((await tracking(f)).status, 'completed');

        await assert.rejects(
          () => finishRecovery({
            recoveryId: claim.recoveryId,
            token: claim.token,
          }),
          error => error.code === 'CLAIM_EXPIRED'
        );
      }
    );

    await test(
      'Active processing lease cannot be overridden',
      async () => {
        const f = await makeFixture();

        await createDecision(f);

        const claim = await claimRecovery(f.identity);

        assert.equal(claim.claimed, true);

        const result = await reconcileExistingDecision(f.identity);

        assert.equal(result.reconciled, false);
        assert.equal((await tracking(f)).status, 'processing');

        await finishRecovery({
          recoveryId: claim.recoveryId,
          token: claim.token,
        });
      }
    );

    await test(
      'Permanent hold remains unchanged',
      async () => {
        const f = await makeFixture();

        await createDecision(f);

        await Recovery.create({
          ...f.identity,
          status: 'held',
          attempts: 1,
          lastErrorCode: 'EMAIL_NOT_VERIFIED',
        });

        const result = await reconcileExistingDecision(f.identity);

        assert.equal(result.reconciled, false);

        const record = await tracking(f);

        assert.equal(record.status, 'held');
        assert.equal(record.lastErrorCode, 'EMAIL_NOT_VERIFIED');
      }
    );

    await test(
      'Completed recovery remains unchanged',
      async () => {
        const f = await makeFixture();

        await createDecision(f);

        const completedAt = new Date(Date.now() - 60000);

        await Recovery.create({
          ...f.identity,
          status: 'completed',
          attempts: 1,
          completedAt,
        });

        const result = await reconcileExistingDecision(f.identity);

        assert.equal(result.reconciled, false);

        const record = await tracking(f);

        assert.equal(record.status, 'completed');
        assert.equal(
          record.completedAt.getTime(),
          completedAt.getTime()
        );
      }
    );

    await test(
      'Missing decision cannot be reconciled',
      async () => {
        const f = await makeFixture();

        await Recovery.create({
          ...f.identity,
          status: 'pending',
        });

        const result = await reconcileExistingDecision(f.identity);

        assert.equal(result.reconciled, false);
        assert.equal(result.reason, 'DECISION_NOT_FOUND');
        assert.equal((await tracking(f)).status, 'pending');
      }
    );

    await test(
      'Recovery runner reconciles existing decision',
      async () => {
        const f = await makeFixture();

        await createDecision(f);

        await Recovery.create({
          ...f.identity,
          status: 'retry_scheduled',
          attempts: 1,
          lastErrorCode: 'TEMPORARY_ERROR',
          nextRetryAt: new Date(Date.now() + 3600000),
        });

        const result = await runRecovery(f);

        assert.equal(result.existing, 1);
        assert.equal(result.created, 0);
        assert.equal(result.failed, 0);

        assert.equal((await tracking(f)).status, 'completed');

        assert.equal(
          await PrizeDecision.countDocuments({
            gameSessionId: f.game._id,
          }),
          1
        );
      }
    );

    await test(
      'Recovery runner respects active worker ownership',
      async () => {
        const f = await makeFixture();

        await createDecision(f);

        const claim = await claimRecovery(f.identity);

        const result = await runRecovery(f);

        assert.equal(result.created, 0);
        assert.equal(result.existing, 0);
        assert.equal(result.skipped, 1);

        assert.equal((await tracking(f)).status, 'processing');

        await finishRecovery({
          recoveryId: claim.recoveryId,
          token: claim.token,
        });
      }
    );

    await test(
      'No real prize or legacy spin is created',
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

    console.log(`\nRESULT: ${passed}/9 TESTS PASSED`);
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
    '\nRECONCILIATION TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
