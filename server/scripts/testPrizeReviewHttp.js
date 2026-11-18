
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');

const DB_NAME = 'hnc_step15q_sandbox';

function verifyEnvironment() {
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
    throw new Error('Unsafe MongoDB sandbox URI');
  }

  if (process.env.ALLOCATION_ENABLED !== 'false') {
    throw new Error(
      'ALLOCATION_ENABLED must remain false'
    );
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing');
  }

  return uri;
}

// Verify environment before importing application modules.
const uri = verifyEnvironment();

const { signToken } = require('../config/jwt');
const adminRoutes = require('../features/administration/routes/adminRoutes');

const AdminUser = require('../features/administration/models/AdminUser');
const AdminAuditLog = require('../features/administration/models/AdminAuditLog');
const GameSession = require('../features/games/models/GameSession');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');

const {
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

const fixtures = {
  adminIds: [],
  gameSessionIds: [],
  decisionIds: [],
};

let passed = 0;
let databaseVerified = false;
let server = null;
let baseUrl = null;

function objectId() {
  return new mongoose.Types.ObjectId();
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

  assert.ok(
    privileges.length > 0,
    'No effective privileges returned'
  );

  for (const item of privileges) {
    const resource = item.resource || {};

    assert.equal(resource.db, DB_NAME);
    assert.equal(
      typeof resource.collection,
      'string'
    );

    assert.notEqual(resource.anyResource, true);
    assert.notEqual(resource.cluster, true);
  }

  databaseVerified = true;
}

async function createAdmin(overrides = {}) {
  const _id = objectId();
  fixtures.adminIds.push(_id);

  return AdminUser.create({
    _id,
    name: 'HNC Sandbox HTTP Admin',
    email: `http-review-${_id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_NOT_A_LOGIN_PASSWORD',
    role: 'admin',
    tokenVersion: 0,
    prizeReviewFence: 0,
    isActive: true,
    ...overrides,
  });
}

async function createDecision() {
  const userId = objectId();
  const gameSessionId = objectId();
  const decisionId = objectId();

  fixtures.gameSessionIds.push(gameSessionId);
  fixtures.decisionIds.push(decisionId);

  const now = Date.now();

  await GameSession.create({
    _id: gameSessionId,
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
    expiresAt: new Date(now + 90000),
    completedAt: new Date(now - 1000),
    gameState: {
      phase: 'finished',
      round: 7,
      hits: 7,
      misses: 0,
    },
    events: [],
  });

  await PrizeDecision.create({
    _id: decisionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameSessionId,
    gameId: 'monkey',
    status: 'pending_review',
    riskReasons: ['SANDBOX_HTTP_TEST'],
    assessmentVersion: 2,
  });

  return decisionId;
}

function tokenFor(admin, type = 'admin', version = 0) {
  return signToken(
    {
      id: String(admin._id),
      type,
      tokenVersion: version,
    },
    '15m'
  );
}

async function request(
  method,
  path,
  token = null,
  body = undefined
) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
    signal: AbortSignal.timeout(20000),
  });

  const content = await response.text();

  let data;

  try {
    data = JSON.parse(content);
  } catch {
    data = { raw: content };
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}

async function auditCount(id) {
  return AdminAuditLog.countDocuments({
    targetType: 'PrizeDecision',
    targetId: id,
  });
}

function createHttpApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // Mount the REAL administrator router.
  // Do not import server.js or config/db.js.
  app.use('/api/admin', adminRoutes);

  app.use((error, req, res, next) => {
    const status =
      error.status ||
      error.statusCode ||
      500;

    return res.status(
      Number.isInteger(status) &&
      status >= 400 &&
      status <= 599
        ? status
        : 500
    ).json({
      code: error.code || 'INTERNAL_ERROR',
      message:
        status >= 500
          ? 'Request failed'
          : error.message,
    });
  });

  return app;
}

async function cleanup() {
  if (!databaseVerified ||
      mongoose.connection.readyState !== 1) {
    return;
  }

  await AdminAuditLog.deleteMany({
    targetType: 'PrizeDecision',
    targetId: { $in: fixtures.decisionIds },
    adminId: { $in: fixtures.adminIds },
  });

  await PrizeDecision.deleteMany({
    _id: { $in: fixtures.decisionIds },
  });

  await GameSession.deleteMany({
    _id: { $in: fixtures.gameSessionIds },
  });

  await AdminUser.deleteMany({
    _id: { $in: fixtures.adminIds },
  });

  const remaining = await Promise.all([
    AdminAuditLog.countDocuments({
      targetType: 'PrizeDecision',
      targetId: { $in: fixtures.decisionIds },
      adminId: { $in: fixtures.adminIds },
    }),
    PrizeDecision.countDocuments({
      _id: { $in: fixtures.decisionIds },
    }),
    GameSession.countDocuments({
      _id: { $in: fixtures.gameSessionIds },
    }),
    AdminUser.countDocuments({
      _id: { $in: fixtures.adminIds },
    }),
  ]);

  assert.ok(
    remaining.every(value => value === 0),
    'Sandbox fixture cleanup incomplete'
  );

  console.log(
    'PASS: Sandbox HTTP fixtures cleaned up'
  );
}

async function closeServer() {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });

    server.closeIdleConnections?.();
  });
}

async function main() {
  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    await verifyPermissions();

    console.log(
      'PASS: Restricted MongoDB sandbox verified'
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
      'PASS: PrizeDecision unique index verified'
    );

    const app = createHttpApp();

    // Bind ONLY to localhost, on an OS-selected port.
    server = app.listen(0, '127.0.0.1');

    await new Promise((resolve, reject) => {
      if (server.listening) return resolve();

      server.once('listening', resolve);
      server.once('error', reject);
    });

    baseUrl =
      `http://127.0.0.1:${server.address().port}`;

    console.log(
      'PASS: Isolated local HTTP server started'
    );

    const admin = await createAdmin();
    const validToken = tokenFor(admin);

    // Test 1
    await check('No JWT is rejected', async () => {
      const response = await request(
        'GET',
        '/api/admin/prize-reviews'
      );

      assert.equal(response.status, 401);
    });

    // Test 2
    await check('Customer JWT is rejected', async () => {
      const response = await request(
        'GET',
        '/api/admin/prize-reviews',
        tokenFor(admin, 'user')
      );

      assert.equal(response.status, 403);
    });

    // Test 3
    await check('Vendor JWT is rejected', async () => {
      const response = await request(
        'GET',
        '/api/admin/prize-reviews',
        tokenFor(admin, 'vendor')
      );

      assert.equal(response.status, 403);
    });

    // Test 4
    await check('Pending review list works', async () => {
      const id = await createDecision();

      const response = await request(
        'GET',
        '/api/admin/prize-reviews?limit=20&page=1',
        validToken
      );

      assert.equal(response.status, 200);
      assert.equal(response.data.status, 'pending_review');

      assert.ok(
        response.data.items.some(
          item => item.id === String(id)
        )
      );

      assert.equal(
        response.headers.get('cache-control'),
        'no-store'
      );
    });

    // Test 5
    await check('Invalid pagination is rejected', async () => {
      const response = await request(
        'GET',
        '/api/admin/prize-reviews?page=-1',
        validToken
      );

      assert.equal(response.status, 400);
    });

    // Test 6
    await check('Invalid status is rejected', async () => {
      const response = await request(
        'GET',
        '/api/admin/prize-reviews?status=invalid',
        validToken
      );

      assert.equal(response.status, 400);
    });

    // Test 7
    await check('Invalid review ID is rejected', async () => {
      const response = await request(
        'GET',
        '/api/admin/prize-reviews/not-an-id',
        validToken
      );

      assert.equal(response.status, 400);
    });

    // Test 8
    await check('Review details are restricted', async () => {
      const id = await createDecision();

      const response = await request(
        'GET',
        `/api/admin/prize-reviews/${id}`,
        validToken
      );

      assert.equal(response.status, 200);
      assert.equal(
        response.data.review.id,
        String(id)
      );

      assert.equal(
        response.data.gameplay.score,
        7
      );

      const serialized =
        JSON.stringify(response.data);

      assert.ok(
        !serialized.includes('sessionTokenHash')
      );

      assert.ok(
        !serialized.includes('passwordHash')
      );
    });

    // Test 9
    await check('Admin approval is audited', async () => {
      const id = await createDecision();

      const response = await request(
        'POST',
        `/api/admin/prize-reviews/${id}/approve`,
        validToken,
        {}
      );

      assert.equal(response.status, 200);
      assert.equal(response.data.status, 'approved');
      assert.equal(response.data.drawExecuted, false);
      assert.equal(response.data.prizeAllocated, false);
      assert.equal(await auditCount(id), 1);
    });

    // Test 10
    await check('Duplicate approval is blocked', async () => {
      const id = await createDecision();

      const first = await request(
        'POST',
        `/api/admin/prize-reviews/${id}/approve`,
        validToken,
        {}
      );

      assert.equal(first.status, 200);

      const second = await request(
        'POST',
        `/api/admin/prize-reviews/${id}/approve`,
        validToken,
        {}
      );

      assert.equal(second.status, 409);
      assert.equal(await auditCount(id), 1);
    });

    // Test 11
    await check('Admin rejection is audited', async () => {
      const id = await createDecision();

      const response = await request(
        'POST',
        `/api/admin/prize-reviews/${id}/reject`,
        validToken,
        {}
      );

      assert.equal(response.status, 200);
      assert.equal(response.data.status, 'rejected');
      assert.equal(await auditCount(id), 1);
    });

    // Test 12
    await check('Disabled admin is rejected', async () => {
      const disabled = await createAdmin({
        isActive: false,
        disabledAt: new Date(),
      });

      const response = await request(
        'GET',
        '/api/admin/prize-reviews',
        tokenFor(disabled)
      );

      assert.ok(
        [401, 403].includes(response.status)
      );
    });

    // Test 13
    await check('Revoked JWT is rejected', async () => {
      const revoked = await createAdmin({
        tokenVersion: 1,
      });

      const response = await request(
        'GET',
        '/api/admin/prize-reviews',
        tokenFor(revoked, 'admin', 0)
      );

      assert.equal(response.status, 401);
    });

    // Test 14
    await check('Unknown review is not found', async () => {
      const response = await request(
        'GET',
        `/api/admin/prize-reviews/${objectId()}`,
        validToken
      );

      assert.equal(response.status, 404);
    });

    console.log(
      `\nRESULT: ${passed}/14 HTTP TESTS PASSED`
    );

    console.log(
      'PASS: No allocation service invoked by test'
    );
  } finally {
    try {
      await closeServer();
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
    '\nTEST FAILED:',
    error.stack || error.message
  );
  process.exitCode = 1;
});
