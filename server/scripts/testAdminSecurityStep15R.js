
'use strict';

/**
 * HNC Phase 4 - Step 15R.10E
 * Administrator authentication security test.
 *
 * - Restricted sandbox database only
 * - Real admin login controller
 * - Real authAdmin middleware
 * - Local HTTP server
 * - No actual email delivery
 * - No existing administrator modifications
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
  throw new Error('Sandbox URI missing');
}

const parsed = new URL(URI);

if (
  !['mongodb:', 'mongodb+srv:'].includes(
    parsed.protocol
  ) ||
  parsed.pathname !== `/${DB_NAME}` ||
  (
    parsed.searchParams.has('dbName') &&
    parsed.searchParams.get('dbName') !== DB_NAME
  )
) {
  throw new Error(
    'SAFETY BLOCK: Invalid sandbox URI'
  );
}

// Disable outbound email before importing controllers.

const mailerPath = require.resolve('../config/mailer');

require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendMail: async () => {
      throw new Error(
        'Outbound email blocked during test'
      );
    },
  },
};

const AdminUser = require('../features/administration/models/AdminUser');

const {
  loginAdmin,
} = require('../features/authentication/controllers/authController');

const {
  authAdmin,
} = require('../features/authentication/middleware/authMiddleware');

const {
  signToken,
} = require('../config/jwt');

const runId = crypto.randomUUID();

const fixtureId = new mongoose.Types.ObjectId();

const email =
  `admin-${runId}@example.com`;

const password = 'SandboxAdminPassword123!';

// ============================================
// DATABASE SAFETY
// ============================================

async function verifyDatabase() {
  assert.equal(
    mongoose.connection.name,
    DB_NAME
  );

  assert.equal(
    mongoose.connection.readyState,
    1
  );

  const result =
    await mongoose.connection.db.admin().command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    result.authInfo.authenticatedUserPrivileges || [];

  const required = [
    'find',
    'insert',
    'update',
    'remove',
  ];

  for (const action of required) {
    assert.ok(
      privileges.some(p =>
        p.resource?.db === DB_NAME &&
        p.actions?.includes(action)
      ),
      `Missing permission: ${action}`
    );
  }

  const outside = privileges.filter(p => {
    const db = p.resource?.db;

    return db === '' ||
      (db && db !== DB_NAME);
  });

  assert.equal(
    outside.length,
    0,
    'Unexpected privileges outside sandbox'
  );

  console.log('Sandbox isolation: VERIFIED');
}

// ============================================
// HTTP HELPERS
// ============================================

async function postLogin(base, loginEmail, loginPassword) {
  const response = await fetch(
    `${base}/api/auth/admin/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function getProtected(base, token) {
  const response = await fetch(
    `${base}/api/admin/test-protected`,
    {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
      signal: AbortSignal.timeout(15000),
    }
  );

  return {
    status: response.status,
    body: await response.json(),
  };
}

// ============================================
// MAIN TEST
// ============================================

async function main() {
  let server;
  let connected = false;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    connected = true;

    await verifyDatabase();

    // Create only a uniquely identified test admin.

    const passwordHash = await bcrypt.hash(
      password,
      10
    );

    const admin = await AdminUser.create({
      _id: fixtureId,
      name: 'Step15R Test Admin',
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
      disabledAt: null,
    });

    const app = express();

    app.set('trust proxy', false);
    app.use(express.json());

    // Actual login controller.
    app.post(
      '/api/auth/admin/login',
      loginAdmin
    );

    // Actual admin authentication middleware.
    app.get(
      '/api/admin/test-protected',
      authAdmin,
      (req, res) => {
        res.json({
          success: true,
          adminId: String(req.admin._id),
        });
      }
    );

    server = await new Promise(
      (resolve, reject) => {
        const s = app.listen(
          0,
          '127.0.0.1',
          () => resolve(s)
        );

        s.once('error', reject);
      }
    );

    const base =
      `http://127.0.0.1:${server.address().port}`;

    // TEST 1: Invalid password rejected.

    const wrongPassword = await postLogin(
      base,
      email,
      'IncorrectPassword123!'
    );

    assert.equal(wrongPassword.status, 400);

    console.log(
      'PASS 1: Invalid admin password rejected'
    );

    // TEST 2: Valid administrator login.

    const login = await postLogin(
      base,
      email,
      password
    );

    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const originalToken = login.body.token;

    console.log(
      'PASS 2: Active administrator login successful'
    );

    // TEST 3: Protected endpoint accepts admin.

    const authorized = await getProtected(
      base,
      originalToken
    );

    assert.equal(authorized.status, 200);
    assert.equal(
      authorized.body.adminId,
      String(admin._id)
    );

    console.log(
      'PASS 3: Valid admin JWT authorized'
    );

    // TEST 4: No token rejected.

    const missing = await getProtected(
      base,
      null
    );

    assert.equal(missing.status, 401);

    console.log(
      'PASS 4: Missing token rejected'
    );

    // TEST 5: Customer JWT rejected.

    const customerToken = signToken({
      id: admin._id,
      type: 'user',
    });

    const customer = await getProtected(
      base,
      customerToken
    );

    assert.equal(customer.status, 403);

    console.log(
      'PASS 5: Customer JWT cannot access admin route'
    );

    // TEST 6: Disabled admin cannot log in.

    await AdminUser.updateOne(
      { _id: admin._id },
      {
        $set: {
          isActive: false,
          disabledAt: new Date(),
        },
      }
    );

    const disabledLogin = await postLogin(
      base,
      email,
      password
    );

    assert.equal(disabledLogin.status, 403);
    assert.equal(
      disabledLogin.body.code,
      'ADMIN_DISABLED'
    );

    console.log(
      'PASS 6: Disabled administrator login rejected'
    );

    // TEST 7: Existing JWT rejected when disabled.

    const disabledAccess = await getProtected(
      base,
      originalToken
    );

    assert.equal(disabledAccess.status, 403);
    assert.equal(
      disabledAccess.body.code,
      'ADMIN_DISABLED'
    );

    console.log(
      'PASS 7: Disabled administrator JWT rejected'
    );

    // Re-enable and increment version.

    await AdminUser.updateOne(
      { _id: admin._id },
      {
        $set: {
          isActive: true,
          disabledAt: null,
        },
        $inc: {
          tokenVersion: 1,
        },
      }
    );

    // TEST 8: Old JWT revoked.

    const revoked = await getProtected(
      base,
      originalToken
    );

    assert.equal(revoked.status, 401);
    assert.equal(
      revoked.body.code,
      'TOKEN_REVOKED'
    );

    console.log(
      'PASS 8: Old administrator JWT revoked'
    );

    // TEST 9: New login receives a valid token.

    const newLogin = await postLogin(
      base,
      email,
      password
    );

    assert.equal(newLogin.status, 200);
    assert.ok(newLogin.body.token);

    const newAccess = await getProtected(
      base,
      newLogin.body.token
    );

    assert.equal(newAccess.status, 200);

    console.log(
      'PASS 9: New admin JWT works after revocation'
    );

    console.log(
      '\nHNC STEP 15R.10E: PASS (9/9 TESTS)'
    );

  } catch (error) {
    console.error(
      '\nHNC STEP 15R.10E: FAIL'
    );

    console.error(error);
    process.exitCode = 1;

  } finally {
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
          'HTTP shutdown error:',
          error.message
        );

        process.exitCode = 1;
      }
    }

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error(
            'Cleanup database mismatch'
          );
        }

        await AdminUser.deleteOne({
          _id: fixtureId,
          email,
        });

        console.log(
          'Sandbox administrator fixture cleaned up.'
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
