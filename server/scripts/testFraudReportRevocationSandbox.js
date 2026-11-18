
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');

const AdminUser = require('../features/administration/models/AdminUser');
const { signToken } = require('../config/jwt');
const { authAdmin } = require('../features/authentication/middleware/authMiddleware');

const reportService = require(
  '../features/fraud-monitoring/services/gameplayFraudReportService'
);

const realGenerate =
  reportService.generateGameplayFraudReport;

const DB_NAME = 'hnc_step15q_sandbox';
const ownedAdmins = [];

let authorized = false;
let server;
let passed = 0;
let gate = null;

// Substitute only the reporting function.
// No gameplay or prize database operations.
reportService.generateGameplayFraudReport = async () => {
  if (!gate) {
    throw new Error('Missing test gate');
  }

  gate.signalStarted();
  await gate.wait;

  return {
    reportType: 'observational',
    found: 0,
    missing: 1,
    reports: [],
    prizeAllocated: false,
    decisionModified: false,
  };
};

const {
  authorizeFraudReport,
  getGameplayFraudReport,
} = require('../features/fraud-monitoring/controllers/gameplayFraudReportController');

function deferred() {
  let resolve;

  const promise = new Promise(r => {
    resolve = r;
  });

  return { promise, resolve };
}

function makeGate() {
  const started = deferred();
  const released = deferred();

  return {
    started: started.promise,
    wait: released.promise,
    signalStarted: started.resolve,
    release: released.resolve,
  };
}

async function test(label, callback) {
  await callback();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

function validateEnvironment() {
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

  authorized = true;
}

async function createAdmin() {
  const id = new mongoose.Types.ObjectId();

  ownedAdmins.push(id);

  return AdminUser.create({
    _id: id,
    name: 'Revocation Sandbox Administrator',
    email: `revocation-${id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    role: 'admin',
    isActive: true,
    disabledAt: null,
    tokenVersion: 0,
  });
}

function tokenFor(admin) {
  return signToken({
    id: String(admin._id),
    type: 'admin',
    tokenVersion: 0,
  });
}

function sendRequest(token, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const req = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      method: 'POST',
      path: '/sandbox/fraud-report',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let output = '';

      res.on('data', chunk => {
        output += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(output),
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end(data);
  });
}

async function runDelayedRequest(admin, update) {
  gate = makeGate();

  const sessionId = String(new mongoose.Types.ObjectId());

  const pending = sendRequest(tokenFor(admin), {
    sessionIds: [sessionId],
    limit: 1,
  });

  // Wait until report generation is actually underway.
  await gate.started;

  // Change the administrator account before report
  // generation is allowed to finish.
  await AdminUser.updateOne(
    { _id: admin._id },
    update
  );

  gate.release();

  const response = await pending;
  gate = null;

  return response;
}

async function cleanup() {
  if (
    !authorized ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  assert.equal(mongoose.connection.name, DB_NAME);

  if (ownedAdmins.length === 0) return;

  await AdminUser.deleteMany({
    _id: { $in: ownedAdmins },
    email: /^revocation-[a-f0-9]{24}@sandbox\.invalid$/,
  });

  assert.equal(
    await AdminUser.countDocuments({
      _id: { $in: ownedAdmins },
    }),
    0
  );

  console.log('PASS: Revocation fixtures cleaned up');
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

    const app = express();
    app.use(express.json({ limit: '16kb' }));

    app.post(
      '/sandbox/fraud-report',
      authAdmin,
      authorizeFraudReport,
      getGameplayFraudReport
    );

    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', resolve);
      server.once('error', reject);
    });

    await test('Disabled during report is rejected', async () => {
      const admin = await createAdmin();

      const response = await runDelayedRequest(admin, {
        $set: {
          isActive: false,
          disabledAt: new Date(),
        },
      });

      assert.equal(response.status, 401);
      assert.equal(
        response.body.code,
        'ADMIN_SESSION_REVOKED'
      );
    });

    await test('Token revoked during report is rejected', async () => {
      const admin = await createAdmin();

      const response = await runDelayedRequest(admin, {
        $inc: { tokenVersion: 1 },
      });

      assert.equal(response.status, 401);
      assert.equal(
        response.body.code,
        'ADMIN_SESSION_REVOKED'
      );
    });

    await test('Role removed during report is rejected', async () => {
      const admin = await createAdmin();

      // Model updates normally enforce role enum
      // when runValidators is enabled. This isolated
      // test simulates an externally corrupted role.
      gate = makeGate();

      const pending = sendRequest(tokenFor(admin), {
        sessionIds: [
          String(new mongoose.Types.ObjectId()),
        ],
        limit: 1,
      });

      await gate.started;

      // A removal also makes the role unauthorized.
      await AdminUser.updateOne(
        { _id: admin._id },
        { $unset: { role: 1 } }
      );

      gate.release();

      const response = await pending;
      gate = null;

      assert.equal(response.status, 401);
      assert.equal(
        response.body.code,
        'ADMIN_SESSION_REVOKED'
      );
    });

    await test('Session count above limit rejected', async () => {
      const admin = await createAdmin();

      const response = await sendRequest(
        tokenFor(admin),
        {
          sessionIds: [
            String(new mongoose.Types.ObjectId()),
            String(new mongoose.Types.ObjectId()),
          ],
          limit: 1,
        }
      );

      assert.equal(response.status, 400);
      assert.equal(
        response.body.code,
        'SESSION_LIMIT_EXCEEDED'
      );
    });

    await test('Reporting service rejects silent truncation', async () => {
      await assert.rejects(
        () => realGenerate({
          sessionIds: [
            String(new mongoose.Types.ObjectId()),
            String(new mongoose.Types.ObjectId()),
          ],
          limit: 1,
        }),
        error =>
          error.code === 'SESSION_LIMIT_EXCEEDED'
      );
    });

    assert.equal(passed, 5);

    console.log(
      `\nRESULT: ${passed}/5 TESTS PASSED`
    );
  } finally {
    if (gate) {
      gate.release();
    }

    if (server) {
      await new Promise((resolve, reject) => {
        server.close(error =>
          error ? reject(error) : resolve()
        );
      });
    }

    try {
      await cleanup();
    } finally {
      reportService.generateGameplayFraudReport =
        realGenerate;

      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(
    'REVOCATION TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
