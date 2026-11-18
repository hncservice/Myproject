
'use strict';

/**
 * HNC Phase 4 - Step 15R.17G
 * Vendor revocation and transactional redemption tests.
 *
 * SANDBOX ONLY.
 * No HTTP emails, real prizes or production data.
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

// Never permit this test to run with prize allocation on.
if (
  String(process.env.ALLOCATION_ENABLED).toLowerCase() !==
  'false'
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

const {
  disableVendor,
  revokeVendorSessions,
} = require('../features/vendors/services/vendorAccountSecurityService');

const runId = crypto.randomBytes(10).toString('hex');

const fixtures = [];
let connected = false;

const originalSpinFindOne = Spin.findOne;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`TIMEOUT: ${label}`));
      }, ms);

      timer.unref?.();
    }),
  ]);
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
    return db === '' || (db && db !== DB_NAME);
  });

  assert.equal(outside.length, 0);

  console.log('Sandbox isolation: VERIFIED');
}

async function makeFixture(index) {
  const ids = {
    user: new mongoose.Types.ObjectId(),
    vendor: new mongoose.Types.ObjectId(),
    prize: new mongoose.Types.ObjectId(),
    spin: new mongoose.Types.ObjectId(),
    award: new mongoose.Types.ObjectId(),
  };

  const fixture = {
    index,
    ids,
    qrToken: crypto.randomBytes(32).toString('hex'),
    email: `vendor-test-user-${runId}-${index}@example.com`,
    vendorEmail:
      `vendor-test-${runId}-${index}@example.com`,
  };

  // Register before creating anything so partial
  // fixture creation can still be cleaned up.
  fixtures.push(fixture);

  await User.create({
    _id: ids.user,
    name: `Sandbox User ${index}`,
    email: fixture.email,
    phone: String(70000000 + index),
    passwordHash: 'sandbox-only-password-hash',
    emailVerified: true,
  });

  await Vendor.create({
    _id: ids.vendor,
    name: `Sandbox Vendor ${index}`,
    email: fixture.vendorEmail,
    passwordHash: 'sandbox-only-password-hash',
    isActive: true,
    tokenVersion: 0,
    redemptionFence: 0,
  });

  await WheelItem.create({
    _id: ids.prize,
    title: `Sandbox Prize ${index}`,
    description: 'Transactional revocation test',
    probabilityWeight: 1,
    quantityTotal: 1,
    quantityAllocated: 1,
    quantityRedeemed: 0,
    isActive: false,
  });

  await Spin.create({
    _id: ids.spin,
    userId: ids.user,
    wheelItemId: ids.prize,
    status: 'won',
    qrToken: fixture.qrToken,
    qrExpiry: new Date(Date.now() + 3600000),
    redemptionStatus: 'pending',
  });

  await PrizeAward.create({
    _id: ids.award,
    userId: ids.user,
    campaignId: `sandbox-${runId}-${index}`,
    spinId: ids.spin,
    wheelItemId: ids.prize,
  });

  return fixture;
}

async function redeem(fixture, tokenVersion = 0) {
  return redeemPrize({
    qrToken: fixture.qrToken,
    vendorId: fixture.ids.vendor,
    tokenVersion,
  });
}

async function checkState(fixture, expectedRedeemed) {
  const spin = await Spin.findById(
    fixture.ids.spin
  ).lean();

  const prize = await WheelItem.findById(
    fixture.ids.prize
  ).lean();

  assert.ok(spin);
  assert.ok(prize);

  assert.equal(
    spin.redemptionStatus,
    expectedRedeemed ? 'redeemed' : 'pending'
  );

  assert.equal(
    prize.quantityRedeemed,
    expectedRedeemed ? 1 : 0
  );

  if (expectedRedeemed) {
    assert.equal(
      String(spin.redeemedByVendorId),
      String(fixture.ids.vendor)
    );
    assert.ok(spin.redeemedAt);
  } else {
    assert.equal(spin.redeemedAt == null, true);
  }
}

async function expectError(promise, allowedStatuses) {
  try {
    await promise;
  } catch (error) {
    assert.ok(
      allowedStatuses.includes(error.status),
      `Unexpected error: ${error.status} ${error.code} ${error.message}`
    );
    return error;
  }

  throw new Error('Expected rejection but operation succeeded');
}

async function main() {
  let releasePausedRedemption = null;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    connected = true;
    await verifySandbox();

    const [
      active,
      disabled,
      revoked,
      concurrent,
      racing,
      afterDisable,
    ] = await Promise.all(
      Array.from(
        { length: 6 },
        (_, i) => makeFixture(i + 1)
      )
    );

    // ----------------------------------------
    // TEST 1: ACTIVE VENDOR
    // ----------------------------------------

    const successful = await redeem(active);

    assert.equal(
      successful.prize,
      'Sandbox Prize 1'
    );

    await checkState(active, true);

    console.log(
      'PASS 1: Active vendor redeems successfully'
    );

    // ----------------------------------------
    // TEST 2: DISABLED VENDOR
    // ----------------------------------------

    await disableVendor(disabled.ids.vendor);

    const disabledError = await expectError(
      redeem(disabled),
      [403]
    );

    assert.equal(
      disabledError.code,
      'VENDOR_SESSION_INVALID'
    );

    await checkState(disabled, false);

    console.log(
      'PASS 2: Disabled vendor redemption rejected'
    );

    // ----------------------------------------
    // TEST 3: REVOKED JWT
    // ----------------------------------------

    await revokeVendorSessions(revoked.ids.vendor);

    const revokedError = await expectError(
      redeem(revoked, 0),
      [403]
    );

    assert.equal(
      revokedError.code,
      'VENDOR_SESSION_INVALID'
    );

    await checkState(revoked, false);

    console.log(
      'PASS 3: Revoked vendor token rejected'
    );

    // ----------------------------------------
    // TEST 4: CONCURRENT QR REDEMPTION
    // ----------------------------------------

    const results = await Promise.allSettled(
      Array.from(
        { length: 8 },
        () => redeem(concurrent)
      )
    );

    const successes = results.filter(
      result => result.status === 'fulfilled'
    );

    const failures = results.filter(
      result => result.status === 'rejected'
    );

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 7);

    await checkState(concurrent, true);

    console.log(
      'PASS 4: Eight concurrent scans redeem once'
    );

    // ----------------------------------------
    // TEST 5: DETERMINISTIC OVERLAP
    // ----------------------------------------
    //
    // Pause the real redemption service after
    // it has obtained the vendor write fence
    // and read its Spin document.
    //
    // While the transaction is open, request
    // vendor deactivation. The deactivation
    // must not finish until the conflicting
    // transaction has resolved.

    let signalPaused;

    const paused = new Promise(resolve => {
      signalPaused = resolve;
    });

    const resume = new Promise(resolve => {
      releasePausedRedemption = resolve;
    });

    let intercepted = false;

    Spin.findOne = function (...args) {
      const query = originalSpinFindOne.apply(
        this,
        args
      );

      if (
        intercepted ||
        args[0]?.qrToken !== racing.qrToken
      ) {
        return query;
      }

      intercepted = true;

      const originalLean = query.lean;

      query.lean = function (...leanArgs) {
        const actualQuery =
          originalLean.apply(this, leanArgs);

        return (async () => {
          const spin = await actualQuery;

          signalPaused();

          await resume;

          return spin;
        })();
      };

      return query;
    };

    const redemptionPromise = redeem(racing);

    await withTimeout(
      paused,
      10000,
      'Redemption did not reach fence'
    );

    let disableFinished = false;

    const disablePromise =
      disableVendor(racing.ids.vendor)
        .then(result => {
          disableFinished = true;
          return result;
        });

    await delay(150);

    assert.equal(
      disableFinished,
      false,
      'Vendor disable completed while fenced transaction remained open'
    );

    releasePausedRedemption();
    releasePausedRedemption = null;

    await withTimeout(
      redemptionPromise,
      15000,
      'Paused redemption did not finish'
    );

    await withTimeout(
      disablePromise,
      15000,
      'Vendor disable did not finish'
    );

    Spin.findOne = originalSpinFindOne;

    await checkState(racing, true);

    const racingVendor =
      await Vendor.findById(racing.ids.vendor).lean();

    assert.equal(racingVendor.isActive, false);
    assert.equal(racingVendor.tokenVersion, 1);

    console.log(
      'PASS 5: In-flight redemption and disable coordinated'
    );

    // ----------------------------------------
    // TEST 6: REDEMPTION AFTER DISABLE
    // ----------------------------------------
    //
    // Create a new pending award for the vendor
    // that has already been disabled.

    await Vendor.updateOne(
      { _id: afterDisable.ids.vendor },
      {
        $set: {
          isActive: false,
          disabledAt: new Date(),
        },
        $inc: { tokenVersion: 1 },
      }
    );

    const afterError = await expectError(
      redeem(afterDisable, 0),
      [403]
    );

    assert.equal(
      afterError.code,
      'VENDOR_SESSION_INVALID'
    );

    await checkState(afterDisable, false);

    console.log(
      'PASS 6: Old token rejected after disable'
    );

    // ----------------------------------------
    // TEST 7: CONSISTENCY CHECK
    // ----------------------------------------

    await checkState(active, true);
    await checkState(disabled, false);
    await checkState(revoked, false);
    await checkState(concurrent, true);
    await checkState(racing, true);
    await checkState(afterDisable, false);

    const awardCount =
      await PrizeAward.countDocuments({
        _id: {
          $in: fixtures.map(f => f.ids.award),
        },
      });

    assert.equal(awardCount, 6);

    console.log(
      'PASS 7: Inventory, Spin and awards consistent'
    );

    console.log(
      '\nHNC STEP 15R.17G: PASS (7/7 TESTS)'
    );

  } catch (error) {
    console.error(
      '\nHNC STEP 15R.17G: FAIL'
    );
    console.error(error);
    process.exitCode = 1;

  } finally {
    // Always release the test-only pause.
    releasePausedRedemption?.();

    Spin.findOne = originalSpinFindOne;

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error(
            'SAFETY BLOCK: Cleanup DB mismatch'
          );
        }

        const userIds = fixtures.map(
          f => f.ids.user
        );

        const vendorIds = fixtures.map(
          f => f.ids.vendor
        );

        const prizeIds = fixtures.map(
          f => f.ids.prize
        );

        const spinIds = fixtures.map(
          f => f.ids.spin
        );

        const awardIds = fixtures.map(
          f => f.ids.award
        );

        await PrizeAward.deleteMany({
          _id: { $in: awardIds },
        });

        await Spin.deleteMany({
          _id: { $in: spinIds },
        });

        await WheelItem.deleteMany({
          _id: { $in: prizeIds },
        });

        await Vendor.deleteMany({
          _id: { $in: vendorIds },
        });

        await User.deleteMany({
          _id: { $in: userIds },
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
