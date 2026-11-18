
'use strict';

/**
 * HNC Game Platform - Phase 4, Step 15Q
 * Vendor QR Redemption HTTP Integration Test
 *
 * SAFETY:
 * - Restricted sandbox MongoDB only
 * - No production MongoDB fallback
 * - No actual email delivery
 * - No real prize allocation
 * - Uses real Express routes and controllers
 * - Cleans up its own test fixtures
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const DB_NAME = 'hnc_step15q_sandbox';
const URI = process.env.HNC_SANDBOX_MONGO_URI;
const runId = crypto.randomUUID();

// =====================================================
// 1. DATABASE SAFETY VALIDATION
// =====================================================

if (!URI) {
  throw new Error(
    'SAFETY BLOCK: HNC_SANDBOX_MONGO_URI missing'
  );
}

const parsedUri = new URL(URI);

if (
  !['mongodb:', 'mongodb+srv:'].includes(
    parsedUri.protocol
  ) ||
  parsedUri.pathname !== `/${DB_NAME}`
) {
  throw new Error(
    'SAFETY BLOCK: Incorrect sandbox connection URI'
  );
}

if (
  parsedUri.searchParams.has('dbName') &&
  parsedUri.searchParams.get('dbName') !== DB_NAME
) {
  throw new Error(
    'SAFETY BLOCK: Conflicting dbName parameter'
  );
}

// =====================================================
// 2. DISABLE ALL OUTBOUND EMAIL
// =====================================================

// Replace the mailer BEFORE importing Express,
// controllers, or services that might use it.

const mailerPath = require.resolve('../config/mailer');

let attemptedMailCalls = 0;

const mockTransporter = {
  sendMail: async () => {
    attemptedMailCalls++;

    return {
      accepted: [],
      rejected: [],
      messageId: 'sandbox-mocked-email',
    };
  },
};

require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: mockTransporter,
};

// Mock email service exports as a second safety layer.

const emailPath = require.resolve(
  '../infrastructure/email/emailService'
);

const emailService = require(emailPath);

let redemptionEmailCalls = 0;

emailService.sendOtpEmail = async () => {};
emailService.sendPrizeEmail = async () => {};

emailService.sendRedemptionEmail = async () => {
  redemptionEmailCalls++;
};

// =====================================================
// 3. IMPORT TEST DEPENDENCIES
// =====================================================

const User = require('../features/authentication/models/User');
const Vendor = require('../features/vendors/models/Vendor');
const Spin = require('../features/games/models/Spin');
const WheelItem = require('../features/prizes/models/WheelItem');
const PrizeAward = require('../features/prizes/models/PrizeAward');

const { signToken } = require('../config/jwt');

const models = [
  User,
  Vendor,
  Spin,
  WheelItem,
  PrizeAward,
];

// Track IDs before attempting writes, allowing cleanup
// even if a create operation partially fails.

const created = new Map(
  models.map(Model => [Model, []])
);

function fixtureId(Model) {
  const id = new mongoose.Types.ObjectId();

  created.get(Model).push(id);

  return id;
}

// =====================================================
// 4. VERIFY DATABASE PERMISSIONS
// =====================================================

async function verifySandboxPermissions() {
  const connection = mongoose.connection;

  if (
    connection.readyState !== 1 ||
    connection.name !== DB_NAME
  ) {
    throw new Error(
      'SAFETY BLOCK: Wrong MongoDB connection'
    );
  }

  const status = await connection.db.admin().command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const privileges =
    status.authInfo?.authenticatedUserPrivileges || [];

  const requiredActions = [
    'find',
    'insert',
    'update',
    'remove',
    'createIndex',
  ];

  const sandboxAllowed = requiredActions.every(
    action =>
      privileges.some(privilege =>
        privilege.resource?.db === DB_NAME &&
        privilege.resource?.collection === '' &&
        privilege.actions?.includes(action)
      )
  );

  const outsidePrivileges = privileges.filter(p => {
    const db = p.resource?.db;

    return db === '' ||
      (db && db !== DB_NAME);
  });

  if (
    !sandboxAllowed ||
    outsidePrivileges.length !== 0
  ) {
    throw new Error(
      'SAFETY BLOCK: Unexpected MongoDB privileges'
    );
  }

  console.log('Sandbox permissions: VERIFIED');
}

// =====================================================
// 5. MOCK CONNECTDB FOR EXPRESS
// =====================================================

function isolateApplicationDatabase() {
  const dbPath = require.resolve('../config/db');

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: async () => {
      if (
        mongoose.connection.readyState !== 1 ||
        mongoose.connection.name !== DB_NAME
      ) {
        throw new Error(
          'SAFETY BLOCK: Sandbox disconnected'
        );
      }

      return mongoose.connection;
    },
  };
}

// =====================================================
// 6. CREATE SANDBOX FIXTURES
// =====================================================

async function createFixtures() {
  const user = await User.create({
    _id: fixtureId(User),
    name: 'Step15Q Customer',
    email: `customer-${runId}@example.invalid`,
    passwordHash: 'sandbox-fixture-only',
    emailVerified: true,
  });

  const vendor = await Vendor.create({
    _id: fixtureId(Vendor),
    name: 'Step15Q Vendor',
    email: `vendor-${runId}@example.invalid`,
    passwordHash: 'sandbox-fixture-only',
    isActive: true,
    tokenVersion: 0,
  });

  const prize = await WheelItem.create({
    _id: fixtureId(WheelItem),
    title: 'Step15Q Test Voucher',
    probabilityWeight: 1,
    quantityTotal: 1,
    quantityAllocated: 1,
    quantityRedeemed: 0,
    isActive: true,
  });

  const spin = await Spin.create({
    _id: fixtureId(Spin),
    userId: user._id,
    wheelItemId: prize._id,
    status: 'won',
    qrToken: crypto.randomBytes(32).toString('hex'),
    qrExpiry: new Date(Date.now() + 3600000),
    redemptionStatus: 'pending',
  });

  await PrizeAward.create({
    _id: fixtureId(PrizeAward),
    userId: user._id,
    campaignId: `step15q-${runId}`,
    spinId: spin._id,
    wheelItemId: prize._id,
  });

  return {
    user,
    vendor,
    prize,
    spin,
  };
}

// =====================================================
// 7. JWT HELPERS
// =====================================================

function vendorToken(vendor, tokenVersion = 0) {
  return signToken({
    id: vendor._id,
    type: 'vendor',
    tokenVersion,
  });
}

function customerToken(user) {
  return signToken({
    id: user._id,
    type: 'user',
  });
}

// =====================================================
// 8. REAL HTTP REQUEST HELPER
// =====================================================

async function postScan(baseUrl, qrToken, token) {
  const response = await fetch(
    `${baseUrl}/api/vendor/scan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      body: JSON.stringify({ qrToken }),
      signal: AbortSignal.timeout(15000),
    }
  );

  let body;

  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return {
    status: response.status,
    body,
  };
}

// =====================================================
// 9. CLEANUP ONLY CREATED TEST FIXTURES
// =====================================================

async function cleanup() {
  if (
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !== DB_NAME
  ) {
    throw new Error(
      'SAFETY BLOCK: Cleanup database mismatch'
    );
  }

  const cleanupOrder = [
    PrizeAward,
    Spin,
    WheelItem,
    Vendor,
    User,
  ];

  const errors = [];

  for (const Model of cleanupOrder) {
    const ids = created.get(Model);

    if (!ids.length) continue;

    try {
      await Model.deleteMany({
        _id: { $in: ids },
      });
    } catch (error) {
      errors.push(`${Model.modelName}: ${error.message}`);
    }
  }

  if (errors.length) {
    throw new Error(
      `Sandbox cleanup incomplete: ${errors.join('; ')}`
    );
  }

  console.log('Sandbox test records cleaned up.');
}

// =====================================================
// 10. RUN HTTP INTEGRATION TESTS
// =====================================================

async function runTests(baseUrl, data) {
  const validToken = vendorToken(data.vendor);

  // TEST 1: Missing vendor token

  const noToken = await postScan(
    baseUrl,
    data.spin.qrToken,
    null
  );

  assert.equal(noToken.status, 401);

  console.log(
    'PASS 1/7: Missing vendor token rejected'
  );

  // TEST 2: Customer token cannot redeem

  const customerResult = await postScan(
    baseUrl,
    data.spin.qrToken,
    customerToken(data.user)
  );

  assert.equal(customerResult.status, 403);

  console.log(
    'PASS 2/7: Customer cannot redeem'
  );

  // TEST 3: Invalid QR

  const invalidQr = await postScan(
    baseUrl,
    'invalid',
    validToken
  );

  assert.equal(invalidQr.status, 400);

  console.log(
    'PASS 3/7: Invalid QR rejected'
  );

  // TEST 4: Disabled vendor

  await Vendor.updateOne(
    { _id: data.vendor._id },
    { $set: { isActive: false } }
  );

  const disabled = await postScan(
    baseUrl,
    data.spin.qrToken,
    validToken
  );

  assert.equal(disabled.status, 403);

  console.log(
    'PASS 4/7: Disabled vendor rejected'
  );

  // TEST 5: Revoked vendor JWT

  await Vendor.updateOne(
    { _id: data.vendor._id },
    {
      $set: { isActive: true },
      $inc: { tokenVersion: 1 },
    }
  );

  const revoked = await postScan(
    baseUrl,
    data.spin.qrToken,
    validToken
  );

  assert.equal(revoked.status, 401);

  console.log(
    'PASS 5/7: Revoked JWT rejected'
  );

  // TEST 6: Eight concurrent HTTP QR scans

  const freshToken = vendorToken(data.vendor, 1);

  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      postScan(
        baseUrl,
        data.spin.qrToken,
        freshToken
      )
    )
  );

  const successful = results.filter(
    result =>
      result.status === 'fulfilled' &&
      result.value.status === 200
  );

  const failedRequests = results.filter(
    result => result.status === 'rejected'
  );

  console.log(
    'Concurrent HTTP statuses:',
    results.map(result =>
      result.status === 'fulfilled'
        ? result.value.status
        : 'REQUEST_ERROR'
    ).join(', ')
  );

  assert.equal(
    failedRequests.length,
    0,
    'Some concurrent HTTP requests failed'
  );

  assert.equal(
    successful.length,
    1,
    'Exactly one redemption must succeed'
  );

  const storedSpin = await Spin.findById(
    data.spin._id
  ).lean();

  const storedPrize = await WheelItem.findById(
    data.prize._id
  ).lean();

  assert.ok(storedSpin);
  assert.ok(storedPrize);

  assert.equal(
    storedSpin.redemptionStatus,
    'redeemed'
  );

  assert.equal(
    String(storedSpin.redeemedByVendorId),
    String(data.vendor._id)
  );

  assert.equal(
    storedPrize.quantityAllocated,
    1
  );

  assert.equal(
    storedPrize.quantityRedeemed,
    1
  );

  assert.equal(
    redemptionEmailCalls,
    1,
    'One redemption email invocation expected'
  );

  assert.equal(
    attemptedMailCalls,
    0,
    'No direct mailer invocation expected'
  );

  console.log(
    'PASS 6/7: Eight scans, one redemption'
  );

  // TEST 7: Duplicate redemption

  const duplicate = await postScan(
    baseUrl,
    data.spin.qrToken,
    freshToken
  );

  assert.equal(duplicate.status, 409);

  assert.equal(
    duplicate.body.code,
    'ALREADY_REDEEMED'
  );

  console.log(
    'PASS 7/7: Duplicate redemption rejected'
  );

  console.log(
    '\nHNC STEP 15Q: PASS (7/7 TESTS)'
  );

  console.log(
    'Redemption email calls:',
    redemptionEmailCalls
  );

  console.log(
    'Real emails delivered: 0 (mock transporter)'
  );
}

// =====================================================
// 11. MAIN
// =====================================================

async function main() {
  let httpServer;
  let databaseConnected = false;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });

    databaseConnected = true;

    console.log('ISOLATED DATABASE:', DB_NAME);
    console.log('TEST RUN:', runId);

    await verifySandboxPermissions();

    isolateApplicationDatabase();

    // Import real Express application only after
    // database and email safety hooks are installed.

    const app = require('../server');

    // Prepare model indexes in sandbox only.

    for (const Model of models) {
      await Model.createIndexes();
    }

    const data = await createFixtures();

    httpServer = await new Promise(
      (resolve, reject) => {
        const server = app.listen(
          0,
          '127.0.0.1',
          () => resolve(server)
        );

        server.once('error', reject);
      }
    );

    const address = httpServer.address();

    const baseUrl =
      `http://127.0.0.1:${address.port}`;

    console.log(
      'Sandbox HTTP server:',
      baseUrl
    );

    await runTests(baseUrl, data);

  } catch (error) {
    console.error('\nHNC STEP 15Q: FAIL');
    console.error(error);

    process.exitCode = 1;

  } finally {
    if (httpServer) {
      try {
        await new Promise((resolve, reject) => {
          httpServer.close(error =>
            error ? reject(error) : resolve()
          );

          httpServer.closeAllConnections?.();
        });
      } catch (error) {
        console.error(
          'HTTP server shutdown failed:',
          error.message
        );

        process.exitCode = 1;
      }
    }

    if (databaseConnected) {
      try {
        await cleanup();
      } catch (error) {
        console.error(
          'Cleanup failed:',
          error.message
        );

        process.exitCode = 1;
      }

      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(
    'Unexpected integration test error:',
    error.message
  );

  process.exitCode = 1;
});
