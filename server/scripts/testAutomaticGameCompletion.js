
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
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

const DB_NAME = 'hnc_step15q_sandbox';

const fixtures = {
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
    decodeURIComponent(parsed.pathname) !== `/${DB_NAME}`
  ) {
    throw new Error('Unsafe sandbox URI');
  }

  assert.equal(process.env.ALLOCATION_ENABLED, 'false');

  // Development-only synthetic test data.
  // Never enable real prize allocation here.
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

  permissionsVerified = true;
}

function sessionCredentials(session) {
  const sessionToken = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(
      `${session._id}:${session.userId}:${session.campaignId}:${session.gameId}`
    )
    .digest('hex');

  const sessionTokenHash = crypto
    .createHash('sha256')
    .update(sessionToken)
    .digest('hex');

  return { sessionToken, sessionTokenHash };
}

async function makeUser() {
  const _id = newId();
  fixtures.users.push(_id);

  return User.create({
    _id,
    name: 'Automatic Completion Sandbox',
    email: `auto-game-${_id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    emailVerified: true,
    hasSpun: false,
  });
}

async function makeMonkey(user, hits = 6) {
  const _id = newId();
  fixtures.sessions.push(_id);

  const now = Date.now();

  const base = {
    _id,
    userId: user._id,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
  };

  const credentials = sessionCredentials(base);

  const events = Array.from(
    { length: hits },
    (_, index) => ({
      type: 'tap',
      round: index + 1,
      success: true,
      serverAt: new Date(now - 30000 + index * 3000),
    })
  );

  const game = await GameSession.create({
    ...base,
    sessionTokenHash: credentials.sessionTokenHash,
    attemptNumber: 1,
    status: 'active',
    outcome: null,
    score: 0,
    startedAt: new Date(now - 45000),
    expiresAt: new Date(now + 120000),
    gameState: {
      revision: hits * 2 + 1,
      round: hits + 1,
      hits,
      misses: 0,
      phase: 'visible',
      targetIndex: 3,
      visibleFrom: new Date(now - 500),
      visibleUntil: new Date(now + 30000),
      nextRoundAt: null,
    },
    events,
  });

  return {
    game,
    sessionToken: credentials.sessionToken,
  };
}

async function makePerfectShot(user, score = 400) {
  const _id = newId();
  fixtures.sessions.push(_id);

  const now = Date.now();

  const base = {
    _id,
    userId: user._id,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'perfect-shot',
  };

  const credentials = sessionCredentials(base);

  const priorPoints = score === 400
    ? [100, 100, 100, 100]
    : [0, 0, 0, 0];

  const history = priorPoints.map((points, index) => ({
    shot: index + 1,
    points,
    label: points ? 'PERFECT!' : 'MISSED!',
    category: points ? 'perfect' : 'miss',
    x: points ? 50 : 0,
    y: points ? 45 : 0,
    targetX: 50,
    targetY: 45,
    distance: points ? 0 : 300,
    timedOut: false,
    serverAt: new Date(now - 35000 + index * 5000),
  }));

  const events = history.map(entry => ({
    type: 'shot',
    shot: entry.shot,
    points: entry.points,
    category: entry.category,
    serverAt: entry.serverAt,
  }));

  const game = await GameSession.create({
    ...base,
    sessionTokenHash: credentials.sessionTokenHash,
    attemptNumber: 1,
    status: 'active',
    outcome: null,
    score: 0,
    startedAt: new Date(now - 60000),
    expiresAt: new Date(now + 120000),
    gameState: {
      revision: 9,
      phase: 'aiming',
      shot: 5,
      score,
      hits: priorPoints.filter(p => p > 0).length,
      perfects: priorPoints.filter(p => p === 100).length,
      history,
      shotStartedAt: new Date(now - 500),
      shotExpiresAt: new Date(now + 30000),
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
  });

  return {
    game,
    sessionToken: credentials.sessionToken,
  };
}

async function decisionCount(game) {
  return PrizeDecision.countDocuments({
    gameSessionId: game._id,
  });
}

async function test(name, action) {
  await action();
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

  await PrizeDecision.deleteMany({
    gameSessionId: { $in: fixtures.sessions },
    userId: { $in: fixtures.users },
  });

  await GameSession.deleteMany({
    _id: { $in: fixtures.sessions },
    userId: { $in: fixtures.users },
  });

  await User.deleteMany({
    _id: { $in: fixtures.users },
  });

  const counts = await Promise.all([
    PrizeDecision.countDocuments({
      gameSessionId: { $in: fixtures.sessions },
      userId: { $in: fixtures.users },
    }),
    GameSession.countDocuments({
      _id: { $in: fixtures.sessions },
    }),
    User.countDocuments({
      _id: { $in: fixtures.users },
    }),
  ]);

  assert.ok(
    counts.every(value => value === 0),
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

    const indexes =
      await PrizeDecision.collection.indexes();

    assert.ok(indexes.some(index =>
      index.name === 'unique_prize_decision_per_session' &&
      index.unique === true &&
      index.key?.gameSessionId === 1
    ));

    console.log('PASS: Sandbox and index verified');

    await test(
      'Monkey seventh hit creates preliminary decision',
      async () => {
        const user = await makeUser();
        const { game, sessionToken } = await makeMonkey(user);

        const result = await monkey.hit(user._id, {
          sessionId: String(game._id),
          sessionToken,
          round: 7,
          targetIndex: 3,
        });

        assert.equal(result.status, 'completed');
        assert.equal(result.outcome, 'qualified');
        assert.equal(await decisionCount(game), 1);
      }
    );

    await test(
      'Perfect Shot fifth submitted shot creates decision',
      async () => {
        const user = await makeUser();

        const { game, sessionToken } =
          await makePerfectShot(user);

        // Use the actual server scoring function to
        // calculate where the target is right now.
        //
        // The movement remains server-validated.
        const elapsed = Date.now() -
          new Date(game.gameState.shotStartedAt).getTime();

        const target = perfectShot.positionAt(
  elapsed,
  4,
  game.gameState.motion
);

        const result = await perfectShot.shoot(user._id, {
  sessionId: String(game._id),
  sessionToken,
  shot: 5,
  x: target.x,
  y: target.y,

  // Required only for development test compensation.
  shotAt: Date.now(),
});

        assert.equal(result.status, 'completed');
        assert.equal(result.outcome, 'qualified');
        assert.equal(await decisionCount(game), 1);
      }
    );

    await test(
      'Unqualified Monkey completion makes no decision',
      async () => {
        const user = await makeUser();

        const { game, sessionToken } =
          await makeMonkey(user, 0);

        await GameSession.updateOne(
          { _id: game._id },
          {
            $set: {
              'gameState.round': 20,
              'gameState.revision': 39,
            },
          }
        );

        const result = await monkey.hit(user._id, {
          sessionId: String(game._id),
          sessionToken,
          round: 20,
          targetIndex: 0,
        });

        assert.equal(result.status, 'completed');
        assert.equal(result.outcome, 'not-qualified');
        assert.equal(await decisionCount(game), 0);
      }
    );

    await test(
      'Repeated completion processing creates no duplicates',
      async () => {
        const game = await GameSession.findOne({
          _id: fixtures.sessions[0],
        });

        assert.ok(game);

        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            processQualifiedCompletion(game)
          )
        );

        assert.equal(results.length, 5);
        assert.equal(await decisionCount(game), 1);
      }
    );

    await test(
      'No awards or Spins created for test users',
      async () => {
        assert.equal(
          await PrizeAward.countDocuments({
            userId: { $in: fixtures.users },
          }),
          0
        );

        assert.equal(
          await Spin.countDocuments({
            userId: { $in: fixtures.users },
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
    '\nAUTOMATIC COMPLETION TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
