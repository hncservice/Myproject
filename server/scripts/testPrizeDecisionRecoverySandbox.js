
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Recovery = require('../features/prizes/models/PrizeDecisionRecovery');

const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const Spin = require('../features/games/models/Spin');

const {
  createPrizeDecision,
} = require('../features/prizes/services/prizeDecisionCreationService');

const {
  recoverMissingPrizeDecisions,
} = require('../features/prizes/services/prizeDecisionRecoveryService');

const {
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

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
    throw new Error('Sandbox URI missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname) !==
      `/${DB_NAME}`
  ) {
    throw new Error('Unsafe MongoDB URI');
  }

  assert.equal(
    process.env.ALLOCATION_ENABLED,
    'false'
  );

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

  permissionsVerified = true;
}

async function makeUser(verified = true) {
  const _id = newId();
  owned.users.push(_id);

  return User.create({
    _id,
    name: 'Recovery Sandbox Customer',
    email: `recovery-queue-${_id}@sandbox.invalid`,
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

async function decisionCount(game) {
  return PrizeDecision.countDocuments({
    gameSessionId: game._id,
  });
}

async function test(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}


async function cleanup() {
  if (
    !permissionsVerified ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  // Safety: cleanup must never operate outside
  // the designated sandbox database.
  assert.equal(
    mongoose.connection.name,
    'hnc_step15q_sandbox'
  );

  // Nothing to clean if no fixture IDs were registered.
  if (
    owned.users.length === 0 ||
    owned.sessions.length === 0
  ) {
    return;
  }

  // Remove only recovery records belonging
  // to this test run.
  await Recovery.deleteMany({
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  // Remove preliminary decisions created by the test.
  await PrizeDecision.deleteMany({
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  // Remove test-owned gameplay sessions.
  await GameSession.deleteMany({
    _id: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  // Remove test-owned customer accounts.
  await User.deleteMany({
    _id: { $in: owned.users },
  });

  // Confirm every test-owned fixture was deleted.
  const remaining = await Promise.all([
    Recovery.countDocuments({
      gameSessionId: { $in: owned.sessions },
      userId: { $in: owned.users },
    }),

    PrizeDecision.countDocuments({
      gameSessionId: { $in: owned.sessions },
      userId: { $in: owned.users },
    }),

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

    const indexes =
      await PrizeDecision.collection.indexes();

    assert.ok(indexes.some(index =>
      index.name ===
        'unique_prize_decision_per_session' &&
      index.unique === true &&
      index.key?.gameSessionId === 1
    ));

    console.log(
      'PASS: Restricted sandbox permissions and index verified'
    );

    // ---------------------------------------------
    // Create isolated test fixtures.
    // ---------------------------------------------

    const existingUser = await makeUser();
    const firstUser = await makeUser();
    const secondUser = await makeUser();
    const unqualifiedUser = await makeUser();
    const unverifiedUser = await makeUser(false);

    const existingGame = await makeGame(existingUser);
    const firstGame = await makeGame(firstUser);
    const secondGame = await makeGame(secondUser);

    const unqualifiedGame = await makeGame(
      unqualifiedUser,
      'not-qualified'
    );

    const unverifiedGame = await makeGame(
      unverifiedUser
    );

    const existingDecision =
      await createPrizeDecision({
        userId: existingUser._id,
        gameSessionId: existingGame._id,
      });

    const eligibleIds = [
      existingGame._id,
      firstGame._id,
      secondGame._id,
      unqualifiedGame._id,
    ].map(String);

    // ---------------------------------------------
    // TEST 1: Recover first missing decision.
    // ---------------------------------------------

    await test(
      'Recovery creates one missing decision',
      async () => {
        const result =
          await recoverMissingPrizeDecisions({
            limit: 1,
            sessionIds: eligibleIds,
          });
          console.log('TEST 3 RECOVERY RESULT:', {
  scanned: result.scanned,
  created: result.created,
  existing: result.existing,
  failed: result.failed,
  failures: result.failures,
});

        assert.equal(result.scanned, 1);
        assert.equal(result.created, 1);
        assert.equal(result.failed, 0);

        assert.equal(
          result.prizeAllocated,
          false
        );

        assert.equal(
          result.drawExecuted,
          false
        );

        const total =
          await PrizeDecision.countDocuments({
            gameSessionId: {
              $in: [
                firstGame._id,
                secondGame._id,
              ],
            },
          });

        assert.equal(total, 1);
      }
    );

    // ---------------------------------------------
    // TEST 2: Next batch moves forward.
    // ---------------------------------------------

    await test(
      'Recovery advances past existing decisions',
      async () => {
        const result =
          await recoverMissingPrizeDecisions({
            limit: 1,
            sessionIds: eligibleIds,
          });

        assert.equal(result.scanned, 1);
        assert.equal(result.created, 1);
        assert.equal(result.failed, 0);

        assert.equal(
          await decisionCount(firstGame),
          1
        );

        assert.equal(
          await decisionCount(secondGame),
          1
        );
      }
    );

    // ---------------------------------------------
    // TEST 3: Repeated recovery is idempotent.
    // ---------------------------------------------

    await test(
      'Repeated recovery creates no duplicates',
      async () => {
        const result =
          await recoverMissingPrizeDecisions({
            limit: 10,
            sessionIds: eligibleIds,
          });

        assert.equal(result.scanned, 0);
        assert.equal(result.created, 0);
        assert.equal(result.failed, 0);

        assert.equal(
          await decisionCount(existingGame),
          1
        );

        assert.equal(
          await decisionCount(firstGame),
          1
        );

        assert.equal(
          await decisionCount(secondGame),
          1
        );
      }
    );

    // ---------------------------------------------
    // TEST 4: Existing decision is unchanged.
    // ---------------------------------------------

    await test(
      'Existing preliminary decision is preserved',
      async () => {
        const persisted =
          await PrizeDecision.findOne({
            gameSessionId: existingGame._id,
          }).lean();

        assert.equal(
          String(persisted._id),
          existingDecision.decisionId
        );
      }
    );

    // ---------------------------------------------
    // TEST 5: Unqualified game is ignored.
    // ---------------------------------------------

    await test(
      'Unqualified game is not recovered',
      async () => {
        assert.equal(
          await decisionCount(unqualifiedGame),
          0
        );
      }
    );

    // ---------------------------------------------
    // TEST 6: Ineligible customer fails closed.
    // ---------------------------------------------

    await test(
      'Unverified customer is not auto-approved',
      async () => {
        const result =
          await recoverMissingPrizeDecisions({
            limit: 1,
            sessionIds: [
              String(unverifiedGame._id),
            ],
          });

        assert.equal(result.scanned, 1);
        assert.equal(result.created, 0);
        assert.equal(result.failed, 1);

        assert.equal(
          result.failures[0].code,
          'EMAIL_NOT_VERIFIED'
        );

        assert.equal(
          await decisionCount(unverifiedGame),
          0
        );
      }
    );

    // ---------------------------------------------
    // TEST 7: No award or Spin created.
    // ---------------------------------------------

    await test(
      'Recovery does not create real prizes',
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

    // ---------------------------------------------
    // TEST 8: Invalid batch size is rejected.
    // ---------------------------------------------

    await test(
      'Recovery batch limits are enforced',
      async () => {
        await assert.rejects(
          () => recoverMissingPrizeDecisions({
            limit: 26,
            sessionIds: eligibleIds,
          }),
          /Recovery limit/
        );
      }
    );

    // ---------------------------------------------
    // TEST 9: Invalid sandbox filter is rejected.
    // ---------------------------------------------

    await test(
      'Invalid session IDs are rejected',
      async () => {
        await assert.rejects(
          () => recoverMissingPrizeDecisions({
            limit: 1,
            sessionIds: ['not-an-object-id'],
          }),
          /Invalid sandbox session filter/
        );
      }
    );

    console.log(
      `\nRESULT: ${passed}/9 TESTS PASSED`
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
    '\nRECOVERY TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
