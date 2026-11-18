
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');

const AdminUser = require('../features/administration/models/AdminUser');

const { signToken } = require('../config/jwt');

const {
  authAdmin,
} = require('../features/authentication/middleware/authMiddleware');

const {
  authorizeFraudReport,
  getGameplayFraudReport,
} = require('../features/fraud-monitoring/controllers/gameplayFraudReportController');

const DB_NAME = 'hnc_step15q_sandbox';
const EXPECTED_TESTS = 11;

const ownedAdmins = [];

let permissionsVerified = false;
let passed = 0;
let server = null;

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

  permissionsVerified = true;

  console.log('PASS: Restricted sandbox permissions verified');
}

async function createAdmin({
  role = 'admin',
  isActive = true,
  disabledAt = null,
  tokenVersion = 0,
} = {}) {
  const _id = newId();

  ownedAdmins.push(_id);

  return AdminUser.create({
    _id,
    name: 'Fraud HTTP Sandbox Administrator',
    email: `fraud-http-${_id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    role,
    isActive,
    disabledAt,
    tokenVersion,
  });
}

function adminToken(admin, overrides = {}) {
  return signToken({
    id: admin._id,
    type: 'admin',
    tokenVersion: admin.tokenVersion,
    ...overrides,
  });
}

// Create a completely separate Express application.
// Do not import server.js or adminRoutes.js.
function createTestApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.post(
    '/sandbox/fraud-report',
    authAdmin,
    authorizeFraudReport,
    getGameplayFraudReport
  );

  app.use((error, req, res, next) => {
    if (error) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
      });
    }

    return next();
  });

  return app;
}

// Local-only HTTP request helper.
// No external network calls are performed.
function request({
  token = null,
  authorization = null,
  body = {},
} = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };

    if (authorization !== null) {
      headers.Authorization = authorization;
    } else if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/sandbox/fraud-report',
        method: 'POST',
        headers,
      },
      res => {
        let responseText = '';

        res.setEncoding('utf8');

        res.on('data', chunk => {
          responseText += chunk;
        });

        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: JSON.parse(responseText),
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on('error', reject);
    req.end(payload);
  });
}

async function test(label, action) {
  await action();
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

  assert.equal(mongoose.connection.name, DB_NAME);

  if (ownedAdmins.length === 0) {
    return;
  }

  // Delete only administrators created by this run.
  await AdminUser.deleteMany({
    _id: { $in: ownedAdmins },
    email: /^fraud-http-[a-f0-9]{24}@sandbox\.invalid$/,
  });

  const remaining = await AdminUser.countDocuments({
    _id: { $in: ownedAdmins },
  });

  assert.equal(
    remaining,
    0,
    'Administrator fixture cleanup incomplete'
  );

  console.log('PASS: HTTP sandbox fixtures cleaned up');
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

    const admin = await createAdmin({
      role: 'admin',
    });

    const superadmin = await createAdmin({
      role: 'superadmin',
    });

    const disabled = await createAdmin({
      isActive: false,
    });

    const disabledByDate = await createAdmin({
      disabledAt: new Date(),
    });

    const revoked = await createAdmin({
      tokenVersion: 2,
    });

    const app = createTestApp();

    await new Promise((resolve, reject) => {
      const listener = app.listen(
        0,
        '127.0.0.1',
        resolve
      );

      server = listener;
      listener.once('error', reject);
    });

    const missingSessionId = String(newId());

    const validBody = {
      sessionIds: [missingSessionId],
      limit: 1,
    };

    // ============================================
    // TEST 1: NO AUTHENTICATION
    // ============================================

    await test('Missing token rejected', async () => {
      const res = await request({
        body: validBody,
      });

      assert.equal(res.status, 401);
    });

    // ============================================
    // TEST 2: MALFORMED BEARER HEADER
    // ============================================

    await test('Malformed authorization rejected', async () => {
      const res = await request({
        authorization: 'NotBearer invalid',
        body: validBody,
      });

      assert.equal(res.status, 401);
    });

    // ============================================
    // TEST 3: EXPIRED ADMIN TOKEN
    // ============================================

    await test('Expired administrator token rejected', async () => {
      const token = adminToken(admin);

      // Sign a token with an expiration time
      // already in the past.
      const expired = require('jsonwebtoken').sign(
        {
          id: String(admin._id),
          type: 'admin',
          tokenVersion: 0,
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' }
      );

      assert.ok(token);

      const res = await request({
        token: expired,
        body: validBody,
      });

      assert.equal(res.status, 401);
    });

    // ============================================
    // TEST 4: CUSTOMER TOKEN
    // ============================================

    await test('Customer token rejected', async () => {
      const token = signToken({
        id: newId(),
        type: 'user',
      });

      const res = await request({
        token,
        body: validBody,
      });

      assert.equal(res.status, 403);
    });

    // ============================================
    // TEST 5: VENDOR TOKEN
    // ============================================

    await test('Vendor token rejected', async () => {
      const token = signToken({
        id: newId(),
        type: 'vendor',
        tokenVersion: 0,
      });

      const res = await request({
        token,
        body: validBody,
      });

      assert.equal(res.status, 403);
    });

    // ============================================
    // TEST 6: DISABLED ADMIN
    // ============================================

    await test('Disabled administrator rejected', async () => {
      const res = await request({
        token: adminToken(disabled),
        body: validBody,
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'ADMIN_DISABLED');
    });

    // ============================================
    // TEST 7: DISABLED TIMESTAMP
    // ============================================

    await test('Disabled timestamp rejected', async () => {
      const res = await request({
        token: adminToken(disabledByDate),
        body: validBody,
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'ADMIN_DISABLED');
    });

    // ============================================
    // TEST 8: REVOKED TOKEN VERSION
    // ============================================

    await test('Revoked administrator token rejected', async () => {
      const token = adminToken(revoked, {
        tokenVersion: 1,
      });

      const res = await request({
        token,
        body: validBody,
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_REVOKED');
    });

    // ============================================
    // TEST 9: ADMIN ALLOWED
    // ============================================

    await test('Admin can request sandbox report', async () => {
      const res = await request({
        token: adminToken(admin),
        body: validBody,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.found, 0);
      assert.equal(res.body.missing, 1);
      assert.equal(res.body.reportType, 'observational');

      assert.equal(
        res.headers['cache-control'],
        'no-store'
      );
    });

    // ============================================
    // TEST 10: SUPERADMIN ALLOWED
    // ============================================

    await test('Superadmin can request sandbox report', async () => {
      const res = await request({
        token: adminToken(superadmin),
        body: validBody,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.prizeAllocated, false);
      assert.equal(res.body.decisionModified, false);
    });

    // ============================================
    // TEST 11: INVALID INPUT REJECTED
    // ============================================

    await test('Invalid session IDs rejected', async () => {
      const res = await request({
        token: adminToken(admin),
        body: {
          sessionIds: ['invalid'],
        },
      });

      assert.equal(res.status, 400);
      assert.equal(
        res.body.code,
        'INVALID_SESSION_FILTER'
      );
    });

    assert.equal(passed, EXPECTED_TESTS);

    console.log(
      `\nRESULT: ${passed}/${EXPECTED_TESTS} TESTS PASSED`
    );
  } finally {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close(error => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    try {
      await cleanup();
    } finally {
      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(
    '\nHTTP SECURITY TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
