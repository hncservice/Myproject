
'use strict';

/**
 * HNC Game Platform
 * Phase 4 - Step 15R.17J
 *
 * Vendor HTTP Redemption Regression Test
 *
 * SECURITY:
 * - Sandbox database only
 * - Prize allocation disabled
 * - Real Express routes and authVendor middleware
 * - Real JWT authentication
 * - Real MongoDB redemption transactions
 * - Mocked emails (no real delivery)
 * - Unique temporary fixtures
 * - Fixture-only cleanup
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const DB_NAME = 'hnc_step15q_sandbox';
const URI = process.env.HNC_SANDBOX_MONGO_URI;

const runId = crypto.randomUUID();

// =====================================================
// 1. SAFETY CHECKS
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
  parsedUri.pathname !== `/${DB_NAME}` ||
  (
    parsedUri.searchParams.has('dbName') &&
    parsedUri.searchParams.get('dbName') !== DB_NAME
  )
) {
  throw new Error(
    'SAFETY BLOCK: Invalid sandbox URI'
  );
}

if (
  String(process.env.ALLOCATION_ENABLED).toLowerCase()
  !== 'false'
) {
  throw new Error(
    'SAFETY BLOCK: ALLOCATION_ENABLED must be false'
  );
}

// =====================================================
// 2. MOCK ALL OUTBOUND EMAIL
// =====================================================

// Install mock mailer before importing application.

const mailerPath = require.resolve(
  '../config/mailer'
);

let attemptedMailCalls = 0;

require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendMail: async () => {
      attemptedMailCalls++;

      return {
        accepted: [],
        rejected: [],
        messageId: 'sandbox-email-only',
      };
    },
  },
};

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
// 3. IMPORT MODELS AND JWT HELPERS
// =====================================================

const User = require('../features/authentication/models/User');
const Vendor = require('../features/vendors/models/Vendor');
const WheelItem = require('../features/prizes/models/WheelItem');
const Spin = require('../features/games/models/Spin');
const PrizeAward = require('../features/prizes/models/PrizeAward');

const {
  signToken,
} = require('../config/jwt');

const models = [
  User,
  Vendor,
  WheelItem,
  Spin,
  PrizeAward,
];

// Register fixture IDs before inserting documents.

const created = new Map(
  models.map(Model => [Model, []])
);

function fixtureId(Model) {
  const id = new mongoose.Types.ObjectId();

  created.get(Model).push(id);

  return id;
}

// =====================================================
// 4. VERIFY SANDBOX PERMISSIONS
// =====================================================

async function verifySandboxPermissions() {
  const connection = mongoose.connection;

  if (
    connection.readyState !== 1 ||
    connection.name !== DB_NAME
  ) {
    throw new Error(
      'SAFETY BLOCK: Wrong database connection'
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

  for (const action of requiredActions) {
    const permitted = privileges.some(privilege =>
      privilege.resource?.db === DB_NAME &&
      privilege.resource?.collection === '' &&
      privilege.actions?.includes(action)
    );

    assert.equal(
      permitted,
      true,
      `Missing sandbox permission: ${action}`
    );
  }

  const outsidePrivileges = privileges.filter(p => {
    const db = p.resource?.db;

    return (
      db === '' ||
      (db && db !== DB_NAME)
    );
  });

  assert.equal(
    outsidePrivileges.length,
    0,
    'MongoDB account has permissions outside sandbox'
  );

  console.log('Sandbox permissions: VERIFIED');
}

// =====================================================
// 5. PREVENT APP FROM RECONNECTING TO LIVE DATABASE
// =====================================================

function isolateApplicationDatabase() {
  const dbPath = require.resolve(
    '../config/db'
  );

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
// 6. CREATE TEST FIXTURES
// =====================================================

async function createFixtures() {
  const user = await User.create({
    _id: fixtureId(User),
    name: 'Step15R HTTP Customer',
    email: `customer-${runId}@example.com`,
    phone: '73456789',
    passwordHash: 'sandbox-fixture-only',
    emailVerified: true,
  });

  const vendor = await Vendor.create({
    _id: fixtureId(Vendor),
    name: 'Step15R HTTP Vendor',
    email: `vendor-${runId}@example.com`,
    passwordHash: 'sandbox-fixture-only',
    isActive: true,
    tokenVersion: 0,
    redemptionFence: 0,
  });

  const prize = await WheelItem.create({
    _id: fixtureId(WheelItem),
    title: 'Step15R HTTP Test Voucher',
    description: 'Sandbox redemption regression',
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

  const award = await PrizeAward.create({
    _id: fixtureId(PrizeAward),
    userId: user._id,
    campaignId: `step15r-http-${runId}`,
    spinId: spin._id,
    gameSessionId: null,
    wheelItemId: prize._id,
  });

  return {
    user,
    vendor,
    prize,
    spin,
    award,
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
// 8. HTTP HELPER
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
      body: JSON.stringify({
        qrToken,
      }),
      signal: AbortSignal.timeout(20000),
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
// 9. STATE VERIFICATION
// =====================================================

async function getState(data) {
  const [
    spin,
    prize,
    vendor,
    award,
  ] = await Promise.all([
    Spin.findById(data.spin._id).lean(),
    WheelItem.findById(data.prize._id).lean(),
    Vendor.findById(data.vendor._id).lean(),
    PrizeAward.findById(data.award._id).lean(),
  ]);

  assert.ok(spin);
  assert.ok(prize);
  assert.ok(vendor);
  assert.ok(award);

  return {
    spin,
    prize,
    vendor,
    award,
  };
}

async function assertPending(data) {
  const state = await getState(data);

  assert.equal(
    state.spin.redemptionStatus,
    'pending'
  );

  assert.equal(
    state.prize.quantityRedeemed,
    0
  );

  assert.equal(
    state.vendor.redemptionFence,
    0
  );
}

// =====================================================
// 10. REAL HTTP INTEGRATION TESTS
// =====================================================

async function runTests(baseUrl, data) {
  const originalToken = vendorToken(
    data.vendor,
    0
  );

  // ---------------------------------------------------
  // TEST 1 - MISSING AUTHORIZATION
  // ---------------------------------------------------

  const missingToken = await postScan(
    baseUrl,
    data.spin.qrToken,
    null
  );

  assert.equal(missingToken.status, 401);

  await assertPending(data);

  console.log(
    'PASS 1/7: Missing vendor token rejected'
  );

  // ---------------------------------------------------
  // TEST 2 - CUSTOMER TOKEN REJECTED
  // ---------------------------------------------------

  const customerResult = await postScan(
    baseUrl,
    data.spin.qrToken,
    customerToken(data.user)
  );

  assert.equal(customerResult.status, 403);

  await assertPending(data);

  console.log(
    'PASS 2/7: Customer cannot redeem'
  );

  // ---------------------------------------------------
  // TEST 3 - INVALID QR FORMAT
  // ---------------------------------------------------

  const invalidQr = await postScan(
    baseUrl,
    'not-a-valid-qr',
    originalToken
  );

  assert.equal(invalidQr.status, 400);

  await assertPending(data);

  console.log(
    'PASS 3/7: Invalid QR rejected'
  );

  // ---------------------------------------------------
  // TEST 4 - DISABLED VENDOR REJECTED
  // ---------------------------------------------------

  await Vendor.updateOne(
    {
      _id: data.vendor._id,
    },
    {
      $set: {
        isActive: false,
        disabledAt: new Date(),
      },
      $inc: {
        tokenVersion: 1,
      },
    }
  );

  const disabledResult = await postScan(
    baseUrl,
    data.spin.qrToken,
    originalToken
  );

  assert.equal(disabledResult.status, 403);

  assert.equal(
    disabledResult.body.code,
    'VENDOR_DISABLED'
  );

  await assertPending(data);

  console.log(
    'PASS 4/7: Disabled vendor rejected'
  );

  // ---------------------------------------------------
  // TEST 5 - REVOKED JWT REJECTED
  // ---------------------------------------------------

  await Vendor.updateOne(
    {
      _id: data.vendor._id,
    },
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

  // Vendor version is now 2.
  // Original JWT version is still 0.

  const revokedResult = await postScan(
    baseUrl,
    data.spin.qrToken,
    originalToken
  );

  assert.equal(revokedResult.status, 401);

  assert.equal(
    revokedResult.body.code,
    'TOKEN_REVOKED'
  );

  await assertPending(data);

  console.log(
    'PASS 5/7: Revoked vendor JWT rejected'
  );

  // ---------------------------------------------------
  // TEST 6 - EIGHT CONCURRENT QR SCANS
  // ---------------------------------------------------

  const freshToken = vendorToken(
    data.vendor,
    2
  );

  const results = await Promise.allSettled(
    Array.from(
      { length: 8 },
      () => postScan(
        baseUrl,
        data.spin.qrToken,
        freshToken
      )
    )
  );

  const fulfilled = results.filter(
    result => result.status === 'fulfilled'
  );

  const transportFailures = results.filter(
    result => result.status === 'rejected'
  );

  const successful = fulfilled.filter(
    result => result.value.status === 200
  );

  const unsuccessful = fulfilled.filter(
    result => result.value.status !== 200
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
    transportFailures.length,
    0,
    'HTTP transport failures occurred'
  );

  assert.equal(
    successful.length,
    1,
    'Exactly one HTTP scan must succeed'
  );

  assert.equal(
    unsuccessful.length,
    7,
    'Exactly seven scans must be rejected'
  );

  for (const result of unsuccessful) {
    assert.equal(
      result.value.status,
      409,
      'Other scans must receive HTTP 409'
    );

    assert.ok(
      [
        'ALREADY_REDEEMED',
        'REDEMPTION_CONFLICT',
      ].includes(result.value.body.code),
      `Unexpected conflict code: ${result.value.body.code}`
    );
  }

  const state = await getState(data);

  assert.equal(
    state.spin.redemptionStatus,
    'redeemed'
  );

  assert.equal(
    String(state.spin.redeemedByVendorId),
    String(data.vendor._id)
  );

  assert.ok(
    state.spin.redeemedAt instanceof Date
  );

  assert.equal(
    state.prize.quantityAllocated,
    1
  );

  assert.equal(
    state.prize.quantityRedeemed,
    1
  );

  // The new transaction must write the vendor
  // redemption fence exactly once.
  assert.equal(
    state.vendor.redemptionFence,
    1,
    'Exactly one vendor fence increment expected'
  );

  // Previously revoked tokens remain revoked.
  assert.equal(
    state.vendor.tokenVersion,
    2
  );

  assert.equal(
    redemptionEmailCalls,
    1,
    'Exactly one mocked redemption email expected'
  );

  assert.equal(
    attemptedMailCalls,
    0,
    'Real mail transporter must never be used'
  );

  // Award association must remain unchanged.
  assert.equal(
    String(state.award.spinId),
    String(data.spin._id)
  );

  assert.equal(
    String(state.award.wheelItemId),
    String(data.prize._id)
  );

  console.log(
    'PASS 6/7: Eight scans, one redemption and one vendor fence'
  );

  // ---------------------------------------------------
  // TEST 7 - DUPLICATE QR REDEMPTION
  // ---------------------------------------------------

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

  const afterDuplicate = await getState(data);

  assert.equal(
    afterDuplicate.prize.quantityRedeemed,
    1
  );

  assert.equal(
    afterDuplicate.vendor.redemptionFence,
    1,
    'Duplicate scan must not commit another fence increment'
  );

  assert.equal(
    redemptionEmailCalls,
    1,
    'Duplicate scan must not send another email'
  );

  console.log(
    'PASS 7/7: Duplicate redemption rejected'
  );

  // ---------------------------------------------------
  // FINAL RESULT
  // ---------------------------------------------------

  console.log(
    '\nHNC STEP 15R.17J: PASS (7/7 TESTS)'
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
// 11. CLEANUP
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

    if (!ids?.length) {
      continue;
    }

    try {
      await Model.deleteMany({
        _id: { $in: ids },
      });
    } catch (error) {
      errors.push(
        `${Model.modelName}: ${error.message}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Sandbox cleanup incomplete: ${errors.join('; ')}`
    );
  }

  // Confirm that created records are gone.
  for (const Model of models) {
    const ids = created.get(Model);

    if (!ids?.length) {
      continue;
    }

    const remaining = await Model.countDocuments({
      _id: { $in: ids },
    });

    assert.equal(
      remaining,
      0,
      `${Model.modelName} fixtures remain`
    );
  }

  console.log(
    'Sandbox test records cleaned up.'
  );
}

// =====================================================
// 12. MAIN
// =====================================================

async function main() {
  let httpServer = null;
  let databaseConnected = false;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    databaseConnected = true;

    console.log(
      'ISOLATED DATABASE:',
      DB_NAME
    );

    console.log(
      'TEST RUN:',
      runId
    );

    await verifySandboxPermissions();

    isolateApplicationDatabase();

    // Load real Express app only after sandbox
    // connection and email mocks are installed.
    const app = require('../server');

    // Prepare indexes in sandbox only.
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
    console.error(
      '\nHNC STEP 15R.17J: FAIL'
    );

    console.error(error);

    process.exitCode = 1;

  } finally {
    if (httpServer) {
      try {
        // Stop accepting new connections.
        httpServer.closeAllConnections?.();

        await new Promise((resolve, reject) => {
          httpServer.close(error =>
            error ? reject(error) : resolve()
          );
        });

      } catch (error) {
        console.error(
          'HTTP shutdown failed:',
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
    'Unexpected test error:',
    error
  );

  process.exitCode = 1;
});
