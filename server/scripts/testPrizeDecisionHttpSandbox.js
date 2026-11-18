
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');

const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const Spin = require('../features/games/models/Spin');
const WheelItem = require('../features/prizes/models/WheelItem');

const { signToken } = require('../config/jwt');
const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const gameRoutes = require('../features/games/routes/gameRoutes');

const DB_NAME = 'hnc_step15q_sandbox';

const fixtures = {
  users: [],
  sessions: [],
};

let permissionChecked = false;
let server = null;
let baseUrl = null;
let passed = 0;

function id() {
  return new mongoose.Types.ObjectId();
}

function validateEnvironment() {
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
    throw new Error('Refusing non-sandbox MongoDB URI');
  }

  if (process.env.ALLOCATION_ENABLED !== 'false') {
    throw new Error('ALLOCATION_ENABLED must be false');
  }

  return uri;
}

async function verifyPermissions() {
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

  for (const privilege of privileges) {
    assert.equal(privilege.resource?.db, DB_NAME);
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

  permissionChecked = true;
}

async function verifyIndexes() {
  const indexes = await PrizeDecision.collection.indexes();

  const required = indexes.find(
    item =>
      item.name ===
        'unique_prize_decision_per_session'
  );

  assert.ok(required);
  assert.equal(required.unique, true);
  assert.equal(required.key.gameSessionId, 1);
}

async function makeUser(options = {}) {
  const _id = id();
  fixtures.users.push(_id);

  return User.create({
    _id,
    name: 'HTTP Sandbox Customer',
    email: `http-decision-${_id}@sandbox.invalid`,
    passwordHash: 'NOT_A_REAL_PASSWORD',
    emailVerified: true,
    hasSpun: false,
    ...options,
  });
}

async function makeGame(user, options = {}) {
  const _id = id();
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
    attemptNumber: 1,
    sessionTokenHash: crypto
      .randomBytes(32)
      .toString('hex'),
    status: 'completed',
    outcome: options.outcome || 'qualified',
    score: options.score ?? 7,
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

function tokenFor(user) {
  return signToken({
    id: String(user._id),
    type: 'user',
  });
}

async function request({
  token,
  body,
  rawAuthorization,
} = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (rawAuthorization) {
    headers.Authorization = rawAuthorization;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${baseUrl}/api/games/prize-decision`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(45000),
    }
  );

  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

async function test(name, callback) {
  await callback();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

function expectNoAllocation(body) {
  assert.equal(body.drawExecuted, false);
  assert.equal(body.prizeAllocated, false);
  assert.equal(body.qrGenerated, false);
}

async function startHttpServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/games', gameRoutes);

  // Test-only error handler; does not modify server.js.
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const status =
      Number.isInteger(error.status)
        ? error.status
        : Number.isInteger(error.statusCode)
          ? error.statusCode
          : 500;

    res.status(
      status >= 400 && status <= 599 ? status : 500
    ).json({
      code: error.code || 'INTERNAL_ERROR',
      message:
        status === 500
          ? 'Internal server error'
          : error.message,
    });
  });

  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });

    server.once('error', reject);
  });

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopHttpServer() {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });

  server = null;
}

async function cleanup() {
  if (
    !permissionChecked ||
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

  assert.equal(
    await PrizeDecision.countDocuments({
      gameSessionId: { $in: fixtures.sessions },
      userId: { $in: fixtures.users },
    }),
    0
  );

  assert.equal(
    await GameSession.countDocuments({
      _id: { $in: fixtures.sessions },
    }),
    0
  );

  assert.equal(
    await User.countDocuments({
      _id: { $in: fixtures.users },
    }),
    0
  );

  console.log('PASS: Sandbox fixtures cleaned up');
}

async function main() {
  const uri = validateEnvironment();

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    await verifyPermissions();
    await verifyIndexes();

    console.log(
      'PASS: Restricted sandbox and unique index verified'
    );

    await startHttpServer();

    await test(
      'Authenticated customer creates preliminary decision',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        const result = await request({
          token: tokenFor(user),
          body: {
            gameSessionId: String(game._id),
          },
        });

        assert.equal(result.status, 201);
        assert.equal(
          result.body.status,
          'ready_for_draw'
        );
        assert.equal(result.body.existing, false);
        expectNoAllocation(result.body);

        assert.equal(
          result.headers.get('cache-control'),
          'no-store'
        );
      }
    );

    await test(
      'Missing JWT is rejected',
      async () => {
        const response = await request({
          body: {
            gameSessionId: String(id()),
          },
        });

        assert.equal(response.status, 401);
      }
    );

    await test(
      'Invalid JWT is rejected',
      async () => {
        const response = await request({
          rawAuthorization:
            'Bearer invalid.jwt.signature',
          body: {
            gameSessionId: String(id()),
          },
        });

        assert.equal(response.status, 401);
      }
    );

    await test(
      'Admin-type JWT cannot act as customer',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        const adminTypeToken = signToken({
          id: String(user._id),
          type: 'admin',
        });

        const response = await request({
          token: adminTypeToken,
          body: {
            gameSessionId: String(game._id),
          },
        });

        assert.equal(response.status, 401);
      }
    );

    await test(
      'Customer cannot access another customer session',
      async () => {
        const owner = await makeUser();
        const other = await makeUser();

        const game = await makeGame(owner);

        const result = await request({
          token: tokenFor(other),
          body: {
            gameSessionId: String(game._id),
          },
        });

        assert.equal(result.status, 403);
        assert.equal(
          result.body.code,
          'GAME_NOT_QUALIFIED'
        );

        assert.equal(
          await PrizeDecision.countDocuments({
            gameSessionId: game._id,
          }),
          0
        );
      }
    );

    await test(
      'Unqualified game rejected',
      async () => {
        const user = await makeUser();

        const game = await makeGame(user, {
          outcome: 'not-qualified',
        });

        const result = await request({
          token: tokenFor(user),
          body: {
            gameSessionId: String(game._id),
          },
        });

        assert.equal(result.status, 403);
        assert.equal(
          result.body.code,
          'GAME_NOT_QUALIFIED'
        );
      }
    );

    await test(
      'Manipulated score enters administrator review queue',
      async () => {
        const user = await makeUser();

        const game = await makeGame(user, {
          score: 99,
        });

        const result = await request({
          token: tokenFor(user),
          body: {
            gameSessionId: String(game._id),
          },
        });

        assert.equal(result.status, 201);
        assert.equal(
          result.body.status,
          'pending_review'
        );

        expectNoAllocation(result.body);

        assert.ok(
          result.body.riskReasons.length > 0
        );
      }
    );

    await test(
      'Invalid and extra request fields rejected',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);
        const token = tokenFor(user);

        const invalid = await request({
          token,
          body: {
            gameSessionId: 'invalid',
          },
        });

        assert.equal(invalid.status, 400);

        const extra = await request({
          token,
          body: {
            gameSessionId: String(game._id),
            userId: String(id()),
          },
        });

        assert.equal(extra.status, 400);

        const clientScore = await request({
          token,
          body: {
            gameSessionId: String(game._id),
            score: 100,
          },
        });

        assert.equal(clientScore.status, 400);
      }
    );

    await test(
      'Repeated HTTP request returns same decision',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);
        const token = tokenFor(user);
        const body = {
          gameSessionId: String(game._id),
        };

        const first = await request({ token, body });
        const second = await request({ token, body });

        assert.equal(first.status, 201);
        assert.equal(second.status, 200);
        assert.equal(second.body.existing, true);

        assert.equal(
          first.body.decisionId,
          second.body.decisionId
        );
      }
    );

    await test(
      'Concurrent HTTP requests create one decision',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        const token = tokenFor(user);
        const body = {
          gameSessionId: String(game._id),
        };

        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            request({ token, body })
          )
        );

        assert.ok(
          results.every(result =>
            [200, 201].includes(result.status)
          )
        );

        assert.equal(
          new Set(
            results.map(
              result => result.body.decisionId
            )
          ).size,
          1
        );

        assert.equal(
          await PrizeDecision.countDocuments({
            gameSessionId: game._id,
          }),
          1
        );
      }
    );

    await test(
      'HTTP decisions do not create awards or Spins',
      async () => {
        const user = await makeUser();
        const game = await makeGame(user);

        const beforeAwards =
          await PrizeAward.countDocuments({
            userId: user._id,
          });

        const beforeSpins =
          await Spin.countDocuments({
            userId: user._id,
          });

        const result = await request({
          token: tokenFor(user),
          body: {
            gameSessionId: String(game._id),
          },
        });

        assert.equal(result.status, 201);

        assert.equal(
          await PrizeAward.countDocuments({
            userId: user._id,
          }),
          beforeAwards
        );

        assert.equal(
          await Spin.countDocuments({
            userId: user._id,
          }),
          beforeSpins
        );

        // No WheelItem fixtures are created by this
        // test, and prize allocation remains disabled.
        expectNoAllocation(result.body);
      }
    );

    console.log(
      `\nRESULT: ${passed}/11 TESTS PASSED`
    );
  } finally {
    try {
      await stopHttpServer();
    } finally {
      try {
        await cleanup();
      } finally {
        await mongoose.disconnect();
      }
    }
  }
}

main().catch(error => {
  console.error(
    '\nHTTP TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
