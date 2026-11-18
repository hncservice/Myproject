
'use strict';

/**
 * HNC Phase 4 - Step 15R.14C
 * Customer profile and deletion protection.
 *
 * Sandbox only. No real emails or prize allocation.
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
  throw new Error('SAFETY BLOCK: Invalid sandbox URI');
}

const User = require('../features/authentication/models/User');
const AdminAuditLog = require('../features/administration/models/AdminAuditLog');

const {
  updateUser,
  deleteUser,
} = require('../features/administration/controllers/adminController');

const userId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

const runId = crypto.randomUUID();

const email = `customer-${runId}@example.com`;

const originalPassword = 'SandboxPassword123!';

const originalAuditCreate = AdminAuditLog.create;

let server = null;
let connected = false;

// ============================================
// DATABASE SAFETY
// ============================================

async function verifySandbox() {
  assert.equal(mongoose.connection.name, DB_NAME);
  assert.equal(mongoose.connection.readyState, 1);

  const result =
    await mongoose.connection.db.admin().command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    result.authInfo.authenticatedUserPrivileges || [];

  for (const action of [
    'find',
    'insert',
    'update',
    'remove',
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

// ============================================
// HTTP HELPERS
// ============================================

async function request(base, method, body) {
  const response = await fetch(
    `${base}/api/admin/users/${userId}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      signal: AbortSignal.timeout(15000),
    }
  );

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function getUser() {
  return User.findById(userId).lean();
}

async function auditCount() {
  return AdminAuditLog.countDocuments({
    targetType: 'User',
    targetId: userId,
    action: 'USER_PROFILE_UPDATED',
  });
}

// ============================================
// MAIN
// ============================================

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

    // Create uniquely identified sandbox customer.
    const passwordHash = await bcrypt.hash(
      originalPassword,
      10
    );

    await User.create({
      _id: userId,
      name: 'Original Customer',
      email,
      phone: '71234567',
      passwordHash,
      emailVerified: true,
      hasSpun: true,
      monkeyAttempts: 2,
      monkeyLocked: true,
    });

    const app = express();

    app.set('trust proxy', false);
    app.use(express.json());

    // Test-only administrator identity.
    // Real authAdmin was tested separately.
    app.use((req, res, next) => {
      req.admin = { _id: adminId };
      next();
    });

    app.put(
      '/api/admin/users/:id',
      updateUser
    );

    app.delete(
      '/api/admin/users/:id',
      deleteUser
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

    // TEST 1: Valid profile update.

    const valid = await request(
      base,
      'PUT',
      {
        name: 'Updated Customer',
        phone: '71234568',
      }
    );

    assert.equal(valid.status, 200);

    let user = await getUser();

    assert.equal(user.name, 'Updated Customer');
    assert.equal(user.phone, '71234568');

    console.log('PASS 1: Profile update accepted');

    // TEST 2: Game eligibility cannot be changed.

    const gameChange = await request(
      base,
      'PUT',
      {
        monkeyAttempts: 0,
        monkeyLocked: false,
        hasSpun: false,
      }
    );

    assert.equal(gameChange.status, 400);
    assert.equal(
      gameChange.body.code,
      'INVALID_PROFILE_UPDATE'
    );

    user = await getUser();

    assert.equal(user.monkeyAttempts, 2);
    assert.equal(user.monkeyLocked, true);
    assert.equal(user.hasSpun, true);

    console.log(
      'PASS 2: Game eligibility modification rejected'
    );

    // TEST 3: Password reset cannot occur here.

    const passwordChange = await request(
      base,
      'PUT',
      {
        password: 'UnauthorizedReset123!',
      }
    );

    assert.equal(passwordChange.status, 400);

    user = await getUser();

    assert.equal(
      await bcrypt.compare(
        originalPassword,
        user.passwordHash
      ),
      true
    );

    console.log(
      'PASS 3: Password modification rejected'
    );

    // TEST 4: Email verification cannot be modified.

    const verificationChange = await request(
      base,
      'PUT',
      {
        emailVerified: false,
      }
    );

    assert.equal(verificationChange.status, 400);

    user = await getUser();
    assert.equal(user.emailVerified, true);

    console.log(
      'PASS 4: Verification status protected'
    );

    // TEST 5: Successful profile update is audited.

    assert.equal(await auditCount(), 1);

    const audit = await AdminAuditLog.findOne({
      targetType: 'User',
      targetId: userId,
      action: 'USER_PROFILE_UPDATED',
    }).lean();

    assert.ok(audit);

    assert.equal(
      String(audit.adminId),
      String(adminId)
    );

    assert.ok(
      audit.details.changedFields.includes('name')
    );

    assert.ok(
      audit.details.changedFields.includes('phone')
    );

    console.log(
      'PASS 5: Profile modification audited'
    );

    // TEST 6: Audit failure rolls back changes.

    AdminAuditLog.create = async () => {
      throw new Error('SIMULATED_AUDIT_FAILURE');
    };

    const failedUpdate = await request(
      base,
      'PUT',
      {
        name: 'Should Not Be Saved',
      }
    );

    assert.equal(failedUpdate.status, 500);

    user = await getUser();

    assert.equal(user.name, 'Updated Customer');
    assert.equal(await auditCount(), 1);

    AdminAuditLog.create = originalAuditCreate;

    console.log(
      'PASS 6: Audit failure rolls back profile update'
    );

    // TEST 7: Delete request is blocked.

    const deletion = await request(
      base,
      'DELETE'
    );

    assert.equal(deletion.status, 409);

    assert.equal(
      deletion.body.code,
      'CUSTOMER_DELETION_RESTRICTED'
    );

    user = await getUser();

    assert.ok(user);
    assert.equal(user.email, email);

    console.log(
      'PASS 7: Customer deletion restricted'
    );

    // TEST 8: Invalid ID rejected.

    const invalidIdResponse = await fetch(
      `${base}/api/admin/users/invalid-id`,
      {
        method: 'DELETE',
        signal: AbortSignal.timeout(15000),
      }
    );

    assert.equal(invalidIdResponse.status, 400);

    console.log('PASS 8: Invalid user ID rejected');

    // TEST 9: No-op update creates no extra audit.

    const noChange = await request(
      base,
      'PUT',
      {
        name: 'Updated Customer',
      }
    );

    assert.equal(noChange.status, 200);

    assert.equal(await auditCount(), 1);

    console.log(
      'PASS 9: No-op update does not create audit'
    );

    console.log(
      '\nHNC STEP 15R.14C: PASS (9/9 TESTS)'
    );

  } catch (error) {
    console.error('\nHNC STEP 15R.14C: FAIL');
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

        await AdminAuditLog.deleteMany({
          targetType: 'User',
          targetId: userId,
        });

        await User.deleteOne({
          _id: userId,
          email,
        });

        console.log(
          'Sandbox fixtures cleaned up.'
        );
      } catch (error) {
        console.error(
          'Cleanup failed:',
          error
        );

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
