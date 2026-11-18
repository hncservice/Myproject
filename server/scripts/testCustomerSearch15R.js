
'use strict';

/**
 * HNC Phase 4 - Step 15R.16C
 * Customer Search Security HTTP Tests
 *
 * Restricted MongoDB sandbox only.
 * Uses actual listUsers controller.
 * Does not use production accounts.
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
  throw new Error('SAFETY BLOCK: Invalid database URI');
}

const User = require('../features/authentication/models/User');

const {
  listUsers,
} = require('../features/administration/controllers/adminController');

const runId = crypto.randomBytes(8).toString('hex');

const ids = Array.from(
  { length: 3 },
  () => new mongoose.Types.ObjectId()
);

const emails = [
  `alpha-${runId}@example.com`,
  `beta-${runId}@example.com`,
  `gamma-${runId}@example.com`,
];

const phoneBase = crypto.randomInt(70000000, 79999990);

let server = null;
let connected = false;

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

async function get(base, query = {}) {
  const params = new URLSearchParams(query);

  const response = await fetch(
    `${base}/api/admin/users?${params}`,
    {
      signal: AbortSignal.timeout(15000),
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

    const passwordHash = await bcrypt.hash(
      'SandboxPassword123!',
      10
    );

    await User.insertMany([
      {
        _id: ids[0],
        name: `Alpha ${runId}`,
        email: emails[0],
        phone: String(phoneBase),
        passwordHash,
        emailVerified: true,
      },
      {
        _id: ids[1],
        name: `Beta ${runId}`,
        email: emails[1],
        phone: String(phoneBase + 1),
        passwordHash,
        emailVerified: false,
      },
      {
        _id: ids[2],
        name: `Gamma ${runId}`,
        email: emails[2],
        phone: String(phoneBase + 2),
        passwordHash,
        emailVerified: true,
      },
    ]);

    const app = express();

    app.set('trust proxy', false);
    app.use(express.json());

    // Isolates the actual listUsers controller.
    // authAdmin has been tested separately.
    app.get('/api/admin/users', listUsers);

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

    // TEST 1: Name search
    const nameSearch = await get(base, {
      q: `Alpha ${runId}`,
    });

    assert.equal(nameSearch.status, 200);
    assert.equal(nameSearch.body.total, 1);
    assert.equal(
      nameSearch.body.items[0].email,
      emails[0]
    );

    console.log('PASS 1: Customer name search');

    // TEST 2: Email search
    const emailSearch = await get(base, {
      q: emails[1],
    });

    assert.equal(emailSearch.status, 200);
    assert.equal(emailSearch.body.total, 1);

    console.log('PASS 2: Customer email search');

    // TEST 3: Regex characters are literal
    const regexSearch = await get(base, {
      q: '.*',
    });

    assert.equal(regexSearch.status, 200);

    const returnedIds = regexSearch.body.items.map(
      item => String(item._id)
    );

    for (const id of ids) {
      assert.equal(
        returnedIds.includes(String(id)),
        false,
        'Regex metacharacters matched a test account'
      );
    }

    console.log(
      'PASS 3: Regex metacharacters treated literally'
    );

    // TEST 4: Pagination
    const pageOne = await get(base, {
      q: runId,
      page: 1,
      limit: 2,
    });

    const pageTwo = await get(base, {
      q: runId,
      page: 2,
      limit: 2,
    });

    assert.equal(pageOne.status, 200);
    assert.equal(pageTwo.status, 200);

    assert.equal(pageOne.body.total, 3);
    assert.equal(pageOne.body.items.length, 2);
    assert.equal(pageTwo.body.items.length, 1);
    assert.equal(pageOne.body.pages, 2);

    console.log('PASS 4: Pagination works');

    // TEST 5: Verified account filter
    const verified = await get(base, {
      q: runId,
      emailVerified: 'true',
    });

    assert.equal(verified.status, 200);
    assert.equal(verified.body.total, 2);

    assert.ok(
      verified.body.items.every(
        user => user.emailVerified === true
      )
    );

    console.log(
      'PASS 5: Email verification filter'
    );

    // TEST 6: Invalid pagination rejected
    for (const query of [
      { page: '-1' },
      { page: 'abc' },
      { limit: '101' },
      { limit: '0' },
    ]) {
      const response = await get(base, query);

      assert.equal(response.status, 400);
      assert.equal(
        response.body.code,
        'INVALID_SEARCH_QUERY'
      );
    }

    console.log(
      'PASS 6: Invalid pagination rejected'
    );

    // TEST 7: Password and OTP never exposed
    const sensitive = await get(base, {
      q: runId,
    });

    assert.equal(sensitive.status, 200);
    assert.equal(sensitive.body.items.length, 3);

    for (const user of sensitive.body.items) {
      assert.equal(
        Object.hasOwn(user, 'passwordHash'),
        false
      );

      assert.equal(
        Object.hasOwn(user, 'otpHash'),
        false
      );

      assert.equal(
        Object.hasOwn(user, 'otpExpiresAt'),
        false
      );

      assert.equal(
        Object.hasOwn(user, 'pendingRegistration'),
        false
      );
    }

    console.log(
      'PASS 7: Sensitive account fields excluded'
    );

    console.log(
      '\nHNC STEP 15R.16C: PASS (7/7 TESTS)'
    );

  } catch (error) {
    console.error('\nHNC STEP 15R.16C: FAIL');
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

        await User.deleteMany({
          _id: { $in: ids },
          email: { $in: emails },
        });

        const remaining = await User.countDocuments({
          _id: { $in: ids },
        });

        assert.equal(
          remaining,
          0,
          'Test fixtures were not fully cleaned'
        );

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
