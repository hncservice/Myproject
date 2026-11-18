
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

const monkey = require('../features/games/services/monkeyGameplayService');
const perfectShot = require('../features/games/services/perfectShotGameplayService');

const {
  processQualifiedCompletion,
} = require('../features/games/services/gameCompletionDecisionService');

const {
  createPrizeDecision,
} = require('../features/prizes/services/prizeDecisionCreationService');

const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const DB_NAME = 'hnc_step15q_sandbox';

const owned = {
  users: [],
  sessions: [],
};

let authorized = false;
let passed = 0;

function objectId() {
  return new mongoose.Types.ObjectId();
}

function assertEnvironment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('Sandbox URI is missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname) !== '/' + DB_NAME
  ) {
    throw new Error('Refusing unsafe MongoDB URI');
  }

  assert.equal(
    process.env.ALLOCATION_ENABLED,
    'false',
    'Real allocation must be disabled'
  );

  return uri;
}

async function checkPermissions() {
  assert.equal(mongoose.connection.name, DB_NAME);

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

  for (const p of privileges) {
    assert.equal(p.resource?.db, DB_NAME);
    assert.equal(typeof p.resource?.collection, 'string');
    assert.notEqual(p.resource?.anyResource, true);
    assert.notEqual(p.resource?.cluster, true);
  }

  authorized = true;
}

async function createUser(emailVerified = true) {
  const _id = objectId();
  owned.users.push(_id);

  return User.create({
    _id,
    name: 'Completion Recovery Sandbox',
    email: `recovery-${_id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    emailVerified,
    hasSpun: false,
  });
}

function credentials(base) {
  const sessionToken = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(
      `${base._id}:${base.userId}:${base.campaignId}:${base.gameId}`
    )
    .digest('hex');

  const sessionTokenHash = crypto
    .createHash('sha256')
    .update(sessionToken)
    .digest('hex');

  return { sessionToken, sessionTokenHash };
}

async function createGame(user, gameId, fields) {
  const _id = objectId();
  owned.sessions.push(_id);

  const base = {
    _id,
    userId: user._id,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId,
  };

  const credential = credentials(base);

  const game = await GameSession.create({
    ...base,
    attemptNumber: 1,
    sessionTokenHash: credential.sessionTokenHash,
    ...fields,
  });

  return {
    game,
    sessionToken: credential.sessionToken,
  };
}

async function countDecisions(game) {
  return PrizeDecision.countDocuments({
    gameSessionId: game._id,
  });
}

async function test(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

async function runTests() {
  // ===================================================
  // TEST 1: Monkey timeout at the 20-round limit
  // ===================================================

  await test(
    'Monkey timeout completes without a prize decision',
    async () => {
      const user = await createUser();
      const now = Date.now();

      const { game, sessionToken } = await createGame(
        user,
        'monkey',
        {
          status: 'active',
          outcome: null,
          score: 0,
          startedAt: new Date(now - 90000),
          expiresAt: new Date(now + 120000),
          gameState: {
            revision: 40,
            round: 20,
            hits: 0,
            misses: 19,
            phase: 'visible',
            targetIndex: 2,
            visibleFrom: new Date(now - 10000),
            visibleUntil: new Date(now - 7000),
            nextRoundAt: null,
          },
          events: [],
        }
      );

      const result = await monkey.nextRound(
        user._id,
        {
          sessionId: String(game._id),
          sessionToken,
        }
      );

      assert.equal(result.status, 'completed');
      assert.equal(result.outcome, 'not-qualified');
      assert.equal(await countDecisions(game), 0);
    }
  );

  // ===================================================
  // TEST 2: Perfect Shot final shot times out
  // ===================================================

  await test(
    'Qualified Perfect Shot final timeout triggers decision',
    async () => {
      const user = await createUser();
      const now = Date.now();

      const history = Array.from(
        { length: 4 },
        (_, index) => ({
          shot: index + 1,
          points: 100,
          category: 'perfect',
          label: 'PERFECT!',
          x: 50,
          y: 45,
          targetX: 50,
          targetY: 45,
          distance: 0,
          timedOut: false,
          serverAt: new Date(
            now - 32000 + index * 6000
          ),
        })
      );

      const events = history.map(h => ({
        type: 'shot',
        shot: h.shot,
        points: h.points,
        category: h.category,
        serverAt: h.serverAt,
      }));

      const { game, sessionToken } = await createGame(
        user,
        'perfect-shot',
        {
          status: 'active',
          outcome: null,
          score: 0,
          startedAt: new Date(now - 50000),
          expiresAt: new Date(now + 120000),
          gameState: {
            revision: 9,
            phase: 'aiming',
            shot: 5,
            score: 400,
            hits: 4,
            perfects: 4,
            history,
            shotStartedAt: new Date(now - 10000),
            shotExpiresAt: new Date(now - 6000),
            nextShotAt: null,
            motion: {
              phaseX: 1.2,
              phaseY: 2.1,
              speedX: 1.9,
              speedY: 1.3,
              amplitudeX: 30,
              amplitudeY: 18,
            },
          },
          events,
        }
      );

      const result = await perfectShot.nextShot(
        user._id,
        {
          sessionId: String(game._id),
          sessionToken,
        }
      );

      assert.equal(result.status, 'completed');
      assert.equal(result.outcome, 'qualified');
      assert.equal(result.score, 400);
      assert.equal(await countDecisions(game), 1);

      const decision = await PrizeDecision.findOne({
        gameSessionId: game._id,
      }).lean();

      assert.ok(decision);
      assert.ok(
        ['pending_review', 'ready_for_draw']
          .includes(decision.status)
      );
    }
  );

  // ===================================================
  // TEST 3: Decision creation fails, game stays complete
  //
  // Simulate an eligibility failure with a deliberately
  // unverified sandbox customer. No production failures
  // or database outages are induced.
  // ===================================================

  let recoveryUser;
  let recoveryGame;

  await test(
    'Failed decision creation preserves completed game',
    async () => {
      recoveryUser = await createUser(false);
      const now = Date.now();

      const events = Array.from(
        { length: 7 },
        (_, index) => ({
          type: 'tap',
          round: index + 1,
          success: true,
          serverAt: new Date(
            now - 24000 + index * 3000
          ),
        })
      );

      const result = await createGame(
        recoveryUser,
        'monkey',
        {
          status: 'completed',
          outcome: 'qualified',
          score: 7,
          startedAt: new Date(now - 30000),
          expiresAt: new Date(now + 90000),
          completedAt: new Date(now - 1000),
          gameState: {
            revision: 14,
            phase: 'finished',
            round: 7,
            hits: 7,
            misses: 0,
          },
          events,
        }
      );

      recoveryGame = result.game;

      const completion =
        await processQualifiedCompletion(recoveryGame);

      assert.equal(completion.attempted, true);
      assert.equal(completion.failed, true);
      assert.equal(
        completion.errorCode,
        'EMAIL_NOT_VERIFIED'
      );

      const persisted = await GameSession.findById(
        recoveryGame._id
      );

      assert.equal(persisted.status, 'completed');
      assert.equal(persisted.outcome, 'qualified');
      assert.equal(await countDecisions(recoveryGame), 0);
    }
  );

  // ===================================================
  // TEST 4: Retry after customer verification
  // ===================================================

  await test(
    'Retry creates missing decision after eligibility restored',
    async () => {
      await User.updateOne(
        { _id: recoveryUser._id },
        { $set: { emailVerified: true } }
      );

      const result = await createPrizeDecision({
        userId: recoveryUser._id,
        gameSessionId: recoveryGame._id,
      });

      assert.equal(result.existing, false);
      assert.equal(await countDecisions(recoveryGame), 1);

      const persisted = await GameSession.findById(
        recoveryGame._id
      );

      assert.equal(persisted.status, 'completed');
      assert.equal(persisted.outcome, 'qualified');
    }
  );

  // ===================================================
  // TEST 5: Repeated retries do not duplicate decisions
  // ===================================================

  await test(
    'Concurrent retries return the same decision',
    async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          createPrizeDecision({
            userId: recoveryUser._id,
            gameSessionId: recoveryGame._id,
          })
        )
      );

      assert.equal(
        new Set(results.map(r => r.decisionId)).size,
        1
      );

      assert.equal(await countDecisions(recoveryGame), 1);
    }
  );

  // ===================================================
  // TEST 6: No real award or Spin
  // ===================================================

  await test(
    'No PrizeAward or Spin created',
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
}

async function cleanup() {
  if (
    !authorized ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  // Cleanup is restricted to IDs generated in this run.
  await PrizeDecision.deleteMany({
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  await GameSession.deleteMany({
    _id: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  await User.deleteMany({
    _id: { $in: owned.users },
  });

  const remaining = await Promise.all([
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
    remaining.every(value => value === 0),
    'Fixture cleanup incomplete'
  );

  console.log('PASS: Sandbox fixtures cleaned up');
}

async function main() {
  const uri = assertEnvironment();

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    await checkPermissions();

    const indexes =
      await PrizeDecision.collection.indexes();

    assert.ok(indexes.some(i =>
      i.name === 'unique_prize_decision_per_session' &&
      i.unique === true &&
      i.key?.gameSessionId === 1
    ));

    console.log('PASS: Sandbox permissions and index verified');

    await runTests();

    console.log(
      `\nRESULT: ${passed}/6 TESTS PASSED`
    );
  } finally {
    try {
      await cleanup();
    } finally {
      await mongoose.disconnect();
    }
  }
}

main().catch(err => {
  console.error(
    '\nRECOVERY TEST FAILED:',
    err.stack || err.message
  );
  process.exitCode = 1;
});
