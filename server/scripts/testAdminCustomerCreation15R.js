
'use strict';

/**
 * HNC Phase 4 - Step 15R.15C
 * Administrator Customer Creation Security Tests
 *
 * Sandbox database only.
 * No real customers, emails or prizes.
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');

const DB_NAME = 'hnc_step15q_sandbox';
const URI = process.env.HNC_SANDBOX_MONGO_URI;

if (!URI) {
  throw new Error('SAFETY BLOCK: Sandbox URI missing');
}

const parsed = new URL(URI);

if (
  !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
  parsed.pathname !== `/${DB_NAME}` ||
  (
    parsed.searchParams.has('dbName') &&
    parsed.searchParams.get('dbName') !== DB_NAME
  )
) {
  throw new Error('SAFETY BLOCK: Incorrect database URI');
}

const User = require('../features/authentication/models/User');
const AdminAuditLog = require('../features/administration/models/AdminAuditLog');
const {
  createUser,
} = require('../features/administration/controllers/adminController');

const runId = crypto.randomUUID();
const adminId = new mongoose.Types.ObjectId();

const email1 = `admincreate-${runId}@example.com`;
const email2 = `adminrollback-${runId}@example.com`;
const email3 = `admininvalid-${runId}@example.com`;

const testEmails = [email1, email2, email3];

const originalAuditCreate = AdminAuditLog.create;

let server = null;
let connected = false;
let createdUserId = null;

async function verifySandbox() {
  assert.equal(mongoose.connection.name, DB_NAME);
  assert.equal(mongoose.connection.readyState, 1);

  const result = await mongoose.connection.db.admin()
    .command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    result.authInfo.authenticatedUserPrivileges || [];

  for (const action of [
    'find', 'insert', 'update', 'remove',
  ]) {
    assert.ok(
      privileges.some(p =>
        p.resource?.db === DB_NAME &&
        p.resource?.collection === '' &&
        p.actions?.includes(action)
      ),
      `Missing sandbox permission: ${action}`
    );
  }

  const outside = privileges.filter(p => {
    const db = p.resource?.db;
    return db === '' ||
      (db && db !== DB_NAME);
  });

  assert.equal(outside.length, 0);

  console.log('Sandbox isolation: VERIFIED');
}

function customerBody(email, phone, extra = {}) {
  return {
    name: 'Step15R Test Customer',
    email,
    phone,
    password: 'SandboxPassword123!',
    ...extra,
  };
}

async function post(base, body) {
  const response = await fetch(
    `${base}/api/admin/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    }
  );

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function main() {
  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    connected = true;
    await verifySandbox();

    const app = express();
    app.set('trust proxy', false);
    app.use(express.json());

    // Test-only admin identity.
    // This test isolates the real createUser controller.
    app.post(
      '/api/admin/users',
      (req, res, next) => {
        req.admin = { _id: adminId };
        next();
      },
      createUser
    );

    server = await new Promise((resolve, reject) => {
      const s = app.listen(
        0,
        '127.0.0.1',
        () => resolve(s)
      );

      s.once('error', reject);
    });

    const base =
      `http://127.0.0.1:${server.address().port}`;

    // TEST 1: Cannot create pre-verified accounts.

    const bypass = await post(
      base,
      customerBody(email1, '73456781', {
        emailVerified: true,
      })
    );

    assert.equal(bypass.status, 400);
    assert.equal(
      bypass.body.code,
      'INVALID_CUSTOMER_CREATION'
    );

    assert.equal(
      await User.countDocuments({ email: email1 }),
      0
    );

    console.log(
      'PASS 1: Email verification bypass rejected'
    );

    // TEST 2: Valid customer creation.

    const created = await post(
      base,
      customerBody(email1, '73456781')
    );

    assert.equal(created.status, 201);
    assert.ok(created.body.id);
    assert.equal(created.body.emailVerified, false);

    createdUserId = created.body.id;

    const stored = await User.findById(
      createdUserId
    ).lean();

    assert.ok(stored);
    assert.equal(stored.emailVerified, false);

    console.log(
      'PASS 2: Customer created as unverified'
    );

    // TEST 3: Account creation is audited.

    const audit = await AdminAuditLog.findOne({
      targetType: 'User',
      targetId: createdUserId,
      action: 'USER_CREATED',
    }).lean();

    assert.ok(audit);

    assert.equal(
      String(audit.adminId),
      String(adminId)
    );

    console.log(
      'PASS 3: Customer creation audited'
    );

    // TEST 4: Duplicate email rejected.

    const duplicate = await post(
      base,
      customerBody(email1, '73456782')
    );

    assert.equal(duplicate.status, 409);

    assert.equal(
      await User.countDocuments({ email: email1 }),
      1
    );

    console.log(
      'PASS 4: Duplicate email rejected'
    );

    // TEST 5: Game fields rejected.

    const gameFields = await post(
      base,
      customerBody(email3, '73456783', {
        monkeyAttempts: 0,
        hasSpun: false,
      })
    );

    assert.equal(gameFields.status, 400);

    assert.equal(
      await User.countDocuments({ email: email3 }),
      0
    );

    console.log(
      'PASS 5: Gameplay fields rejected'
    );

    // TEST 6: Audit failure rolls back customer.

    AdminAuditLog.create = async () => {
      throw new Error('SIMULATED_AUDIT_FAILURE');
    };

    const failed = await post(
      base,
      customerBody(email2, '73456784')
    );

    assert.equal(failed.status, 500);

    const rolledBack = await User.findOne({
      email: email2,
    });

    assert.equal(rolledBack, null);

    AdminAuditLog.create = originalAuditCreate;

    console.log(
      'PASS 6: Audit failure rolls back creation'
    );

    // TEST 7: Invalid email rejected.

    const badEmail = await post(
      base,
      customerBody('invalid-email', '73456785')
    );

    assert.equal(badEmail.status, 400);

    console.log(
      'PASS 7: Invalid email rejected'
    );

    // TEST 8: Password never exposed.

    assert.equal(
      Object.hasOwn(created.body, 'passwordHash'),
      false
    );

    assert.equal(
      Object.hasOwn(created.body, 'password'),
      false
    );

    console.log(
      'PASS 8: Password hash excluded from response'
    );

    console.log(
      '\nHNC STEP 15R.15C: PASS (8/8 TESTS)'
    );

  } catch (error) {
    console.error('\nHNC STEP 15R.15C: FAIL');
    console.error(error);
    process.exitCode = 1;

  } finally {
    AdminAuditLog.create = originalAuditCreate;

    if (server) {
      try {
        await new Promise((resolve, reject) => {
          server.close(error =>
            error ? reject(error) : resolve()
          );
          server.closeAllConnections?.();
        });
      } catch (error) {
        console.error(
          'HTTP shutdown failed:',
          error.message
        );
        process.exitCode = 1;
      }
    }

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error(
            'SAFETY BLOCK: Cleanup database mismatch'
          );
        }

        if (createdUserId) {
          await AdminAuditLog.deleteMany({
            adminId,
            action: 'USER_CREATED',
            targetType: 'User',
            targetId: createdUserId,
          });

          await User.deleteOne({
            _id: createdUserId,
            email: email1,
          });
        }

        // Verify no test-created account remains.
        const remaining = await User.countDocuments({
          email: { $in: testEmails },
        });

        if (remaining !== 0) {
          throw new Error(
            `Cleanup verification failed: ${remaining} test accounts remain`
          );
        }

        console.log('Sandbox fixtures cleaned up.');

      } catch (error) {
        console.error('Cleanup failed:', error);
        process.exitCode = 1;
      }

      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
