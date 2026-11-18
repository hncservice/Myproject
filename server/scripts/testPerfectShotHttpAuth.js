'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

const envKeys = [
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'NODE_ENV',
  'ALLOCATION_ENABLED',
  'HNC_TEST_SHOT_COMPENSATION',
];

const originalEnv = Object.fromEntries(
  envKeys.map(key => [key, process.env[key]])
);

const secret = 'isolated-perfect-shot-http-test-secret';
const userId = '111111111111111111111111';
const otherId = '222222222222222222222222';
const savedCache = new Map();

let server;
let account;
let passed = 0;
const calls = [];
let serviceFailure = null;

function replaceModule(path, exports) {
  const id = require.resolve(path);
  savedCache.set(id, require.cache[id]);
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports,
  };
}

function resetAccount() {
  account = {
    _id: userId,
    isActive: true,
    emailVerified: true,
    tokenVersion: 0,
  };
}

function unexpected() {
  throw new Error('Unexpected controller or account lookup');
}

function gameplay(action) {
  return async (id, body) => {
    calls.push({ action, id: String(id), body });
    if (serviceFailure) throw serviceFailure;
    return { success: true, action };
  };
}

async function main() {
  process.env.JWT_SECRET = secret;
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.NODE_ENV = 'test';
  process.env.ALLOCATION_ENABLED = 'false';
  process.env.HNC_TEST_SHOT_COMPENSATION = 'false';

  // No database model execution or real gameplay.
  replaceModule('../features/authentication/models/User', {
    findById: async id =>
      String(id) === userId ? account : null,
  });

  replaceModule('../features/vendors/models/Vendor', {
    findById: unexpected,
  });

  replaceModule('../features/administration/models/AdminUser', {
    findById: unexpected,
  });

  replaceModule('../features/games/engine/legacyGameEngine', {
    perfectShot: {
      nextShot: gameplay('next'),
      shoot: gameplay('shoot'),
    },
  });

  replaceModule('../features/games/controllers/gameController', {
    getStatus: unexpected,
    start: unexpected,
    getSession: unexpected,
    getHistory: unexpected,
    complete: unexpected,
  });

  replaceModule('../features/games/controllers/monkeyGameplayController', {
    nextRound: unexpected,
    hit: unexpected,
  });

    replaceModule('../features/prizes/controllers/prizeDecisionController', {
    create: unexpected,
    getPrize: unexpected,
    getStatus: unexpected,
    draw: unexpected,
  });

  const { signToken } = require('../config/jwt');
  const routes = require('../features/games/routes/gameRoutes');

  const app = express();
  app.use(express.json());
  app.use('/api/games', routes);

  // Test-local error handler: verifies controller forwarding.
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      code: err.code || 'TEST_UNEXPECTED_ERROR',
    });
  });

  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  async function post(action, authorization, body = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authorization !== undefined) {
      headers.Authorization = authorization;
    }

    const response = await fetch(
      `${base}/api/games/perfect-shot/${action}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      }
    );

    return {
      status: response.status,
      body: await response.json(),
    };
  }

  const token = (extra = {}, expiry = '5m') =>
    signToken({ id: userId, type: 'user', tokenVersion: 0, ...extra }, expiry);

  const cases = [
    {
      name: 'Missing token',
      authorization: () => undefined,
      status: 401,
    },
    {
      name: 'Malformed token',
      authorization: () => 'Bearer invalid-token',
      status: 401,
    },
    {
      name: 'Wrong signing secret',
      authorization: () => 'Bearer ' + jwt.sign(
        { id: userId, type: 'user' },
        'different-isolated-secret',
        { algorithm: 'HS256', expiresIn: '5m' }
      ),
      status: 401,
    },
    {
      name: 'Expired token',
      authorization: () => 'Bearer ' + token({}, -1),
      status: 401,
    },
    {
      name: 'Vendor token',
      authorization: () => 'Bearer ' + token({ type: 'vendor' }),
      status: 401,
    },
    {
      name: 'Admin token',
      authorization: () => 'Bearer ' + token({ type: 'admin' }),
      status: 401,
    },
    {
      name: 'Unknown account',
      authorization: () => 'Bearer ' + token({ id: otherId }),
      status: 401,
    },
    {
      name: 'Disabled account',
      setup: () => { account.isActive = false; },
      authorization: () => 'Bearer ' + token(),
      status: 403,
      code: 'ACCOUNT_DISABLED',
    },
    {
      name: 'Unverified account',
      setup: () => { account.emailVerified = false; },
      authorization: () => 'Bearer ' + token(),
      status: 403,
      code: 'ACCOUNT_NOT_VERIFIED',
    },
    {
      name: 'Revoked token',
      setup: () => { account.tokenVersion = 1; },
      authorization: () => 'Bearer ' + token(),
      status: 401,
      code: 'TOKEN_REVOKED',
    },
  ];

  for (const action of ['next', 'shoot']) {
    for (const scenario of cases) {
      resetAccount();
      scenario.setup?.();
      const before = calls.length;
      const result = await post(action, scenario.authorization());

      assert.equal(result.status, scenario.status, scenario.name);
      if (scenario.code) {
        assert.equal(result.body.code, scenario.code);
      }
      assert.equal(calls.length, before, 'Rejected request reached gameplay');
      passed++;
      console.log(`PASS: ${action}: ${scenario.name}`);
    }
  }

  for (const action of ['next', 'shoot']) {
    resetAccount();

    const body = {
      userId: otherId,
      sessionId: 'synthetic-session',
      sessionToken: 'synthetic-session-token',
      shot: 1,
      x: 50,
      y: 50,
    };

    const before = calls.length;
    const result = await post(action, 'Bearer ' + token(), body);

    assert.equal(result.status, 200);
    assert.equal(result.body.action, action);
    assert.equal(calls.length, before + 1);
    assert.equal(calls.at(-1).id, userId);
    assert.deepEqual(calls.at(-1).body, body);

    passed++;
    console.log(`PASS: ${action}: authenticated identity overrides body userId`);
  }

  resetAccount();
  serviceFailure = Object.assign(new Error('Synthetic conflict'), {
    status: 409,
    code: 'SHOT_CONFLICT',
  });

  const conflict = await post('shoot', 'Bearer ' + token(), {});
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'SHOT_CONFLICT');
  passed++;
  console.log('PASS: Controller forwards service errors');

  assert.equal(calls.length, 3);
  console.log(`\nPERFECT SHOT HTTP AUTH: PASS (${passed} tests)`);
  console.log('Loopback test server only; account and gameplay operations mocked.');
}

main().catch(err => {
  console.error(err.stack);
  process.exitCode = 1;
}).finally(async () => {
  if (server) {
    const closed = new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
    server.closeAllConnections?.();
    await closed;
  }

  for (const [id, original] of savedCache) {
    if (original === undefined) delete require.cache[id];
    else require.cache[id] = original;
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
