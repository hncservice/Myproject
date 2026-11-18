
'use strict';

/**
 * HNC PHASE 4 - STEP 15M
 * Actual QR redemption concurrency testing.
 *
 * SAFE TEST:
 * - Separate sandbox database
 * - Actual Mongoose models and redemption service
 * - No HTTP requests
 * - No redemption emails
 * - No existing customer or prize data modified
 * - Cleanup limited to this test's document IDs
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../features/authentication/models/User');
const Vendor = require('../features/vendors/models/Vendor');
const Spin = require('../features/games/models/Spin');
const WheelItem = require('../features/prizes/models/WheelItem');
const PrizeAward = require('../features/prizes/models/PrizeAward');

const {
  redeemPrize,
} = require('../features/prizes/services/prizeRedemptionService');

const DB_NAME = 'hnc_step15m_sandbox';
const RUN_ID = crypto.randomUUID();

const URI =
  process.env.HNC_SANDBOX_MONGO_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;

const records = new Map([
  [User, []],
  [Vendor, []],
  [Spin, []],
  [WheelItem, []],
  [PrizeAward, []],
]);

function track(Model, doc) {
  records.get(Model).push(doc._id);
  return doc;
}

async function createUser() {
  return track(
    User,
    await User.create({
      name: 'Step15M Test Customer',
      email:
        `step15m-user-${crypto.randomUUID()}@example.invalid`,
      passwordHash: 'not-a-real-password',
      emailVerified: true,
    })
  );
}

async function createVendor() {
  return track(
    Vendor,
    await Vendor.create({
      name: `Step15M Vendor ${RUN_ID}`,
      email:
        `step15m-vendor-${crypto.randomUUID()}@example.invalid`,
      passwordHash: 'not-a-real-password',
    })
  );
}

async function createPrize({
  allocated = 1,
  redeemed = 0,
} = {}) {
  return track(
    WheelItem,
    await WheelItem.create({
      title: `Step15M Test Prize ${RUN_ID}`,
      probabilityWeight: 1,
      quantityTotal: 10,
      quantityAllocated: allocated,
      quantityRedeemed: redeemed,
      isActive: true,
    })
  );
}

async function createSpin({
  user,
  prize,
  expired = false,
} = {}) {
  return track(
    Spin,
    await Spin.create({
      userId: user._id,
      wheelItemId: prize._id,
      status: 'won',
      qrToken: crypto.randomBytes(32).toString('hex'),
      qrExpiry: expired
        ? new Date(Date.now() - 60000)
        : new Date(Date.now() + 3600000),
      redemptionStatus: 'pending',
      emailSent: false,
    })
  );
}

async function createAward({
  user,
  prize,
  spin,
} = {}) {
  return track(
    PrizeAward,
    await PrizeAward.create({
      userId: user._id,
      campaignId: `step15m-${RUN_ID}`,
      spinId: spin._id,
      wheelItemId: prize._id,
    })
  );
}

async function fixture({
  allocated = 1,
  redeemed = 0,
  expired = false,
  withAward = true,
} = {}) {
  const user = await createUser();
  const vendor = await createVendor();

  const prize = await createPrize({
    allocated,
    redeemed,
  });

  const spin = await createSpin({
    user,
    prize,
    expired,
  });

  if (withAward) {
    await createAward({
      user,
      prize,
      spin,
    });
  }

  return {
    user,
    vendor,
    prize,
    spin,
  };
}

async function checkFailure(
  operation,
  expectedCode
) {
  await assert.rejects(
    operation,
    (error) => {
      assert.equal(error.code, expectedCode);
      return true;
    }
  );
}

// ======================================
// TEST 1: CONCURRENT REDEMPTION
// ======================================

async function testConcurrentScans() {
  const data = await fixture();

  const secondVendor = await createVendor();

  const requests = Array.from(
    { length: 8 },
    (_, index) =>
      redeemPrize({
        qrToken: data.spin.qrToken,
        vendorId:
          index % 2 === 0
            ? data.vendor._id
            : secondVendor._id,
      })
  );

  const results = await Promise.allSettled(requests);

  const successful = results.filter(
    (r) => r.status === 'fulfilled'
  );

  const rejected = results.filter(
    (r) => r.status === 'rejected'
  );

  assert.equal(successful.length, 1);
  assert.equal(rejected.length, 7);

  const spin = await Spin.findById(
    data.spin._id
  ).lean();

  const prize = await WheelItem.findById(
    data.prize._id
  ).lean();

  assert.equal(
    spin.redemptionStatus,
    'redeemed'
  );

  assert.equal(prize.quantityRedeemed, 1);

  assert.ok(spin.redeemedByVendorId);
  assert.ok(spin.redeemedAt);

  console.log(
    'PASS: Eight simultaneous scans redeem only once'
  );
}

// ======================================
// TEST 2: REPEATED SCAN
// ======================================

async function testDuplicateScan() {
  const data = await fixture();

  const first = await redeemPrize({
    qrToken: data.spin.qrToken,
    vendorId: data.vendor._id,
  });

  assert.equal(
    first.spinId,
    String(data.spin._id)
  );

  await checkFailure(
    () =>
      redeemPrize({
        qrToken: data.spin.qrToken,
        vendorId: data.vendor._id,
      }),
    'ALREADY_REDEEMED'
  );

  const prize = await WheelItem.findById(
    data.prize._id
  ).lean();

  assert.equal(prize.quantityRedeemed, 1);

  console.log(
    'PASS: Repeated QR scan rejected'
  );
}

// ======================================
// TEST 3: EXPIRED QR
// ======================================

async function testExpiredQr() {
  const data = await fixture({
    expired: true,
  });

  await checkFailure(
    () =>
      redeemPrize({
        qrToken: data.spin.qrToken,
        vendorId: data.vendor._id,
      }),
    'QR_EXPIRED'
  );

  const spin = await Spin.findById(
    data.spin._id
  ).lean();

  assert.equal(
    spin.redemptionStatus,
    'pending'
  );

  console.log(
    'PASS: Expired QR rejected'
  );
}

// ======================================
// TEST 4: INVALID QR
// ======================================

async function testInvalidQr() {
  const vendor = await createVendor();

  await checkFailure(
    () =>
      redeemPrize({
        qrToken: 'invalid-token',
        vendorId: vendor._id,
      }),
    'INVALID_QR'
  );

  console.log(
    'PASS: Invalid QR format rejected'
  );
}

// ======================================
// TEST 5: INVALID VENDOR
// ======================================

async function testInvalidVendor() {
  const data = await fixture();

  const nonexistentVendor =
    new mongoose.Types.ObjectId();

  await checkFailure(
    () =>
      redeemPrize({
        qrToken: data.spin.qrToken,
        vendorId: nonexistentVendor,
      }),
    'VENDOR_NOT_FOUND'
  );

  const spin = await Spin.findById(
    data.spin._id
  ).lean();

  assert.equal(
    spin.redemptionStatus,
    'pending'
  );

  console.log(
    'PASS: Nonexistent vendor rejected'
  );
}

// ======================================
// TEST 6: INVENTORY ROLLBACK
// ======================================

async function testInventoryRollback() {
  const data = await fixture({
    allocated: 0,
    redeemed: 0,
  });

  await checkFailure(
    () =>
      redeemPrize({
        qrToken: data.spin.qrToken,
        vendorId: data.vendor._id,
      }),
    'INVENTORY_RECONCILIATION_REQUIRED'
  );

  const spin = await Spin.findById(
    data.spin._id
  ).lean();

  const prize = await WheelItem.findById(
    data.prize._id
  ).lean();

  assert.equal(
    spin.redemptionStatus,
    'pending'
  );

  assert.equal(
    prize.quantityRedeemed,
    0
  );

  console.log(
    'PASS: Inventory failure rolls back redemption'
  );
}

// ======================================
// TEST 7: AWARD OWNERSHIP MISMATCH
// ======================================

async function testAwardMismatch() {
  const data = await fixture({
    withAward: false,
  });

  const otherUser = await createUser();

  await createAward({
    user: otherUser,
    prize: data.prize,
    spin: data.spin,
  });

  await checkFailure(
    () =>
      redeemPrize({
        qrToken: data.spin.qrToken,
        vendorId: data.vendor._id,
      }),
    'AWARD_MISMATCH'
  );

  const spin = await Spin.findById(
    data.spin._id
  ).lean();

  assert.equal(
    spin.redemptionStatus,
    'pending'
  );

  console.log(
    'PASS: Incorrect award ownership rejected'
  );
}

// ======================================
// CLEANUP
// ======================================

async function cleanup() {
  for (const Model of [
    PrizeAward,
    Spin,
    WheelItem,
    Vendor,
    User,
  ]) {
    const ids = records.get(Model);

    if (!ids.length) continue;

    await Model.deleteMany({
      _id: { $in: ids },
    });
  }
}

// ======================================
// MAIN
// ======================================

async function main() {
  if (!URI) {
    throw new Error(
      'MongoDB URI missing'
    );
  }

  let connected = false;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });

    connected = true;

    if (
      mongoose.connection.name !== DB_NAME ||
      mongoose.connection.name === 'test'
    ) {
      throw new Error(
        'DATABASE ISOLATION CHECK FAILED'
      );
    }

    console.log(
      'ISOLATED DATABASE:',
      mongoose.connection.name
    );

    console.log('TEST RUN:', RUN_ID);

    for (const Model of [
      User,
      Vendor,
      Spin,
      WheelItem,
      PrizeAward,
    ]) {
      await Model.createIndexes();
    }

    await testConcurrentScans();
    await testDuplicateScan();
    await testExpiredQr();
    await testInvalidQr();
    await testInvalidVendor();
    await testInventoryRollback();
    await testAwardMismatch();

    console.log(
      '\nHNC STEP 15M: PASS (7/7 TESTS)'
    );
    console.log(
      'No real customer prizes modified.'
    );
  } catch (error) {
    console.error(
      '\nHNC STEP 15M: FAIL'
    );
    console.error(error);

    process.exitCode = 1;
  } finally {
    if (connected) {
      try {
        if (
          mongoose.connection.name === DB_NAME
        ) {
          await cleanup();

          console.log(
            'Sandbox test records cleaned up.'
          );
        }
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

main();
