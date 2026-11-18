
'use strict';

/**
 * HNC Phase 4 - Step 15R.18C
 * Real Redemption Service Performance Benchmark
 *
 * Sandbox only.
 * No email delivery.
 * No prize allocation.
 * No production database fallback.
 *
 * Measures:
 * 1. Eight sequential independent QRs.
 * 2. Eight concurrent independent QRs.
 * 3. Eight concurrent scans of the same QR.
 * 4. Invalid and duplicate QR latency.
 * 5. Committed redemption/inventory/fence consistency.
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
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
  throw new Error('SAFETY BLOCK: Invalid sandbox URI');
}

if (
  String(process.env.ALLOCATION_ENABLED).toLowerCase()
  !== 'false'
) {
  throw new Error(
    'SAFETY BLOCK: ALLOCATION_ENABLED must be false'
  );
}

const User = require('../features/authentication/models/User');
const Vendor = require('../features/vendors/models/Vendor');
const WheelItem = require('../features/prizes/models/WheelItem');
const Spin = require('../features/games/models/Spin');
const PrizeAward = require('../features/prizes/models/PrizeAward');

const {
  redeemPrize,
} = require('../features/prizes/services/prizeRedemptionService');

const runId = crypto.randomUUID();

const vendorId = new mongoose.Types.ObjectId();

const fixtures = [];

let connected = false;
let testVendorRegistered = false;
let committedRedemptions = 0;

function newId() {
  return new mongoose.Types.ObjectId();
}

async function verifySandbox() {
  assert.equal(mongoose.connection.name, DB_NAME);
  assert.equal(mongoose.connection.readyState, 1);

  const result =
    await mongoose.connection.db.admin().command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    result.authInfo?.authenticatedUserPrivileges || [];

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

  const outsidePrivileges = privileges.filter(p => {
    const db = p.resource?.db;

    return db === '' ||
      (db && db !== DB_NAME);
  });

  assert.equal(outsidePrivileges.length, 0);

  console.log('Sandbox isolation: VERIFIED');
}

async function createVendor() {
  testVendorRegistered = true;

  await Vendor.create({
    _id: vendorId,
    name: 'Performance Benchmark Vendor',
    email: `perf-vendor-${runId}@example.com`,
    passwordHash: 'sandbox-test-only',
    isActive: true,
    tokenVersion: 0,
    redemptionFence: 0,
  });
}

async function createFixture(index) {
  const fixture = {
    index,
    userId: newId(),
    prizeId: newId(),
    spinId: newId(),
    awardId: newId(),
    qrToken: crypto.randomBytes(32).toString('hex'),
  };

  // Record IDs before database writes.
  fixtures.push(fixture);

  await User.create({
    _id: fixture.userId,
    name: `Performance Test User ${index}`,
    email: `perf-user-${runId}-${index}@example.com`,
    phone: String(73000000 + index),
    passwordHash: 'sandbox-test-only',
    emailVerified: true,
  });

  await WheelItem.create({
    _id: fixture.prizeId,
    title: `Performance Prize ${index}`,
    description: 'Sandbox benchmark only',
    probabilityWeight: 1,
    quantityTotal: 1,
    quantityAllocated: 1,
    quantityRedeemed: 0,
    isActive: false,
  });

  await Spin.create({
    _id: fixture.spinId,
    userId: fixture.userId,
    wheelItemId: fixture.prizeId,
    status: 'won',
    qrToken: fixture.qrToken,
    qrExpiry: new Date(Date.now() + 3600000),
    redemptionStatus: 'pending',
  });

  await PrizeAward.create({
    _id: fixture.awardId,
    userId: fixture.userId,
    campaignId: `performance-${runId}-${index}`,
    spinId: fixture.spinId,
    gameSessionId: null,
    wheelItemId: fixture.prizeId,
  });

  return fixture;
}

async function redeem(fixture) {
  return redeemPrize({
    qrToken: fixture.qrToken,
    vendorId,
    tokenVersion: 0,
  });
}

async function measure(label, fn) {
  const start = performance.now();

  try {
    const result = await fn();

    return {
      label,
      ok: true,
      ms: performance.now() - start,
      result,
    };
  } catch (error) {
    return {
      label,
      ok: false,
      ms: performance.now() - start,
      status: error.status,
      code: error.code,
      error: error.message,
    };
  }
}

function printResults(title, results) {
  console.log(`\n${title}`);

  for (const item of results) {
    const outcome = item.ok
      ? 'SUCCESS'
      : `${item.status || 'ERROR'} ${item.code || ''}`;

    console.log(
      `${item.label}: ${item.ms.toFixed(0)} ms — ${outcome}`
    );
  }

  const values = results
    .map(item => item.ms)
    .sort((a, b) => a - b);

  const sum = values.reduce((a, b) => a + b, 0);

  const average = sum / values.length;

  const p95Index =
    Math.ceil(values.length * 0.95) - 1;

  const p95 = values[p95Index];

  console.log(
    `Average: ${average.toFixed(0)} ms`
  );

  console.log(
    `P95 sample: ${p95.toFixed(0)} ms`
  );

  console.log(
    `Successful: ${
      results.filter(item => item.ok).length
    }/${results.length}`
  );

  // With only eight requests, P95 is descriptive,
  // not a production performance percentile.
}

async function checkAllFixtures() {
  let redeemedCount = 0;

  for (const fixture of fixtures) {
    const [spin, prize, award] =
      await Promise.all([
        Spin.findById(fixture.spinId).lean(),
        WheelItem.findById(fixture.prizeId).lean(),
        PrizeAward.findById(fixture.awardId).lean(),
      ]);

    assert.ok(spin);
    assert.ok(prize);
    assert.ok(award);

    assert.equal(
      String(award.spinId),
      String(fixture.spinId)
    );

    assert.equal(
      String(award.wheelItemId),
      String(fixture.prizeId)
    );

    if (spin.redemptionStatus === 'redeemed') {
      redeemedCount++;

      assert.equal(prize.quantityRedeemed, 1);
      assert.ok(spin.redeemedAt);

      assert.equal(
        String(spin.redeemedByVendorId),
        String(vendorId)
      );
    } else {
      assert.equal(spin.redemptionStatus, 'pending');
      assert.equal(prize.quantityRedeemed, 0);
    }
  }

  const vendor = await Vendor.findById(
    vendorId
  ).lean();

  assert.ok(vendor);
  assert.equal(vendor.isActive, true);
  assert.equal(vendor.tokenVersion, 0);

  assert.equal(
    vendor.redemptionFence,
    redeemedCount,
    'Vendor fence must match committed redemptions'
  );

  assert.equal(
    redeemedCount,
    committedRedemptions,
    'Committed result count mismatch'
  );

  console.log(
    `\nConsistency verified: ${redeemedCount} redeemed`
  );

  console.log(
    `Vendor fence value: ${vendor.redemptionFence}`
  );
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

    await createVendor();

    console.log('Test run:', runId);
    console.log('Benchmark vendor:', String(vendorId));

    // ----------------------------------------------
    // TEST 1: SEQUENTIAL, DIFFERENT QRs
    // ----------------------------------------------

    const sequentialFixtures = [];

    for (let i = 1; i <= 8; i++) {
      sequentialFixtures.push(
        await createFixture(i)
      );
    }

    const sequential = [];

    const sequentialStart = performance.now();

    for (const fixture of sequentialFixtures) {
      sequential.push(
        await measure(
          `Sequential QR ${fixture.index}`,
          () => redeem(fixture)
        )
      );
    }

    const sequentialWallMs =
      performance.now() - sequentialStart;

    printResults(
      'TEST 1: Sequential, independent QRs',
      sequential
    );

    console.log(
      `Total elapsed: ${sequentialWallMs.toFixed(0)} ms`
    );

    assert.equal(
      sequential.every(item => item.ok),
      true,
      'Sequential redemptions should all succeed'
    );

    committedRedemptions += 8;

    // ----------------------------------------------
    // TEST 2: CONCURRENT, DIFFERENT QRs
    // ----------------------------------------------

    const concurrentFixtures = [];

    for (let i = 9; i <= 16; i++) {
      concurrentFixtures.push(
        await createFixture(i)
      );
    }

    const concurrentStart = performance.now();

    const concurrent = await Promise.all(
      concurrentFixtures.map(fixture =>
        measure(
          `Concurrent QR ${fixture.index}`,
          () => redeem(fixture)
        )
      )
    );

    const concurrentWallMs =
      performance.now() - concurrentStart;

    printResults(
      'TEST 2: Concurrent, independent QRs',
      concurrent
    );

    console.log(
      `Total elapsed: ${concurrentWallMs.toFixed(0)} ms`
    );

    const concurrentSuccessCount =
      concurrent.filter(item => item.ok).length;

    committedRedemptions += concurrentSuccessCount;

    // Do not require all independent concurrent QRs
    // to succeed immediately. Record any conflicts.
    //
    // Failures indicate a usability/performance issue
    // that requires review before production.
    if (concurrentSuccessCount !== 8) {
      console.log(
        'WARNING: Some independent concurrent scans failed.'
      );
    }

    // ----------------------------------------------
    // TEST 3: CONCURRENT, SAME QR
    // ----------------------------------------------

    const sameFixture = await createFixture(17);

    const sameStart = performance.now();

    const sameResults = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        measure(
          `Same QR request ${index + 1}`,
          () => redeem(sameFixture)
        )
      )
    );

    const sameWallMs =
      performance.now() - sameStart;

    printResults(
      'TEST 3: Concurrent scans of one QR',
      sameResults
    );

    console.log(
      `Total elapsed: ${sameWallMs.toFixed(0)} ms`
    );

    const sameSuccesses =
      sameResults.filter(item => item.ok);

    assert.equal(
      sameSuccesses.length,
      1,
      'Exactly one same-QR redemption must succeed'
    );

    for (const item of sameResults) {
      if (!item.ok) {
        assert.equal(
          item.status,
          409,
          'Duplicate/conflicting redemption must return 409'
        );
      }
    }

    committedRedemptions++;

    // ----------------------------------------------
    // TEST 4: INVALID QR
    // ----------------------------------------------

    const invalid = await measure(
      'Unknown valid-format QR',
      () => redeemPrize({
        qrToken: crypto.randomBytes(32)
          .toString('hex'),
        vendorId,
        tokenVersion: 0,
      })
    );

    assert.equal(invalid.ok, false);
    assert.equal(invalid.status, 404);

    console.log(
      '\nTEST 4: Invalid QR response',
      `${invalid.ms.toFixed(0)} ms`
    );

    // ----------------------------------------------
    // TEST 5: ALREADY REDEEMED QR
    // ----------------------------------------------

    const duplicate = await measure(
      'Already redeemed QR',
      () => redeem(sameFixture)
    );

    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.status, 409);

    console.log(
      'TEST 5: Already redeemed QR response',
      `${duplicate.ms.toFixed(0)} ms`
    );

    // ----------------------------------------------
    // TEST 6: DATABASE CONSISTENCY
    // ----------------------------------------------

    await checkAllFixtures();

    if (concurrentSuccessCount !== 8) {
      throw new Error(
        'PERFORMANCE REVIEW REQUIRED: Independent concurrent redemptions experienced conflicts'
      );
    }

    console.log(
      '\nHNC STEP 15R.18C: BENCHMARK COMPLETE'
    );

    console.log(
      'All independent QR redemptions succeeded.'
    );

    console.log(
      'All committed transactions are consistent.'
    );

  } catch (error) {
    console.error(
      '\nHNC STEP 15R.18C: REVIEW REQUIRED'
    );

    console.error(error);
    process.exitCode = 1;

  } finally {
    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error(
            'SAFETY BLOCK: Cleanup database mismatch'
          );
        }

        const ids = key =>
          fixtures.map(fixture => fixture[key]);

        await PrizeAward.deleteMany({
          _id: { $in: ids('awardId') },
        });

        await Spin.deleteMany({
          _id: { $in: ids('spinId') },
        });

        await WheelItem.deleteMany({
          _id: { $in: ids('prizeId') },
        });

        await User.deleteMany({
          _id: { $in: ids('userId') },
        });

        if (testVendorRegistered) {
          await Vendor.deleteOne({
            _id: vendorId,
          });
        }

        // Confirm benchmark fixtures were removed.
        for (const [Model, values] of [
          [PrizeAward, ids('awardId')],
          [Spin, ids('spinId')],
          [WheelItem, ids('prizeId')],
          [User, ids('userId')],
          [Vendor, testVendorRegistered ? [vendorId] : []],
        ]) {
          const remaining = await Model.countDocuments({
            _id: { $in: values },
          });

          assert.equal(
            remaining,
            0,
            `${Model.modelName} cleanup incomplete`
          );
        }

        console.log(
          'Sandbox benchmark fixtures cleaned up.'
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
