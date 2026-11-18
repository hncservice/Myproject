
'use strict';

/**
 * HNC Game Platform
 * Phase 4 - Step 15R.17K
 *
 * Reverse-Order Vendor Revocation Test
 *
 * Verifies:
 * 1. Revocation commits before redemption fence.
 * 2. Old vendor token version is rejected.
 * 3. Spin and inventory remain unchanged.
 * 4. Fresh token version can redeem after revocation.
 * 5. Disabled vendor is rejected.
 * 6. Re-enabled vendor uses a new token version.
 *
 * SANDBOX ONLY.
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const DB_NAME = 'hnc_step15q_sandbox';
const URI = process.env.HNC_SANDBOX_MONGO_URI;

const runId = crypto.randomUUID();

// =====================================================
// 1. SAFETY
// =====================================================

if (!URI) {
  throw new Error(
    'SAFETY BLOCK: Sandbox URI missing'
  );
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
// 2. IMPORTS
// =====================================================

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
  enableVendor,
  revokeVendorSessions,
} = require('../features/vendors/services/vendorAccountSecurityService');

const originalVendorUpdate = Vendor.findOneAndUpdate;

const models = [
  User,
  Vendor,
  WheelItem,
  Spin,
  PrizeAward,
];

const created = new Map(
  models.map(Model => [Model, []])
);

let connected = false;

function newFixtureId(Model) {
  const id = new mongoose.Types.ObjectId();

  created.get(Model).push(id);

  return id;
}

// =====================================================
// 3. SAFETY HELPERS
// =====================================================

async function verifySandbox() {
  assert.equal(mongoose.connection.name, DB_NAME);
  assert.equal(mongoose.connection.readyState, 1);

  const status =
    await mongoose.connection.db.admin().command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    status.authInfo?.authenticatedUserPrivileges || [];

  const actions = [
    'find',
    'insert',
    'update',
    'remove',
  ];

  for (const action of actions) {
    assert.ok(
      privileges.some(p =>
        p.resource?.db === DB_NAME &&
        p.resource?.collection === '' &&
        p.actions?.includes(action)
      ),
      `Sandbox permission missing: ${action}`
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

function timeout(promise, milliseconds, label) {
  let timer;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`TIMEOUT: ${label}`));
      }, milliseconds);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}

async function expectError(
  promise,
  expectedStatus,
  expectedCode
) {
  try {
    await promise;
  } catch (error) {
    assert.equal(
      error.status,
      expectedStatus,
      `Unexpected status: ${error.message}`
    );

    assert.equal(
      error.code,
      expectedCode,
      `Unexpected error code: ${error.message}`
    );

    return error;
  }

  throw new Error(
    'Expected redemption to be rejected'
  );
}

// =====================================================
// 4. CREATE FIXTURES
// =====================================================

async function createFixture(index) {
  const userId = newFixtureId(User);
  const vendorId = newFixtureId(Vendor);
  const prizeId = newFixtureId(WheelItem);
  const spinId = newFixtureId(Spin);
  const awardId = newFixtureId(PrizeAward);

  const qrToken =
    crypto.randomBytes(32).toString('hex');

  await User.create({
    _id: userId,
    name: `Reverse Race Customer ${index}`,
    email:
      `race-customer-${runId}-${index}@example.com`,
    phone: String(72000000 + index),
    passwordHash: 'sandbox-only-hash',
    emailVerified: true,
  });

  await Vendor.create({
    _id: vendorId,
    name: `Reverse Race Vendor ${index}`,
    email:
      `race-vendor-${runId}-${index}@example.com`,
    passwordHash: 'sandbox-only-hash',
    isActive: true,
    disabledAt: null,
    tokenVersion: 0,
    redemptionFence: 0,
  });

  await WheelItem.create({
    _id: prizeId,
    title: `Reverse Race Prize ${index}`,
    probabilityWeight: 1,
    quantityTotal: 1,
    quantityAllocated: 1,
    quantityRedeemed: 0,
    isActive: false,
  });

  await Spin.create({
    _id: spinId,
    userId,
    wheelItemId: prizeId,
    status: 'won',
    qrToken,
    qrExpiry: new Date(Date.now() + 3600000),
    redemptionStatus: 'pending',
  });

  await PrizeAward.create({
    _id: awardId,
    userId,
    campaignId: `reverse-race-${runId}-${index}`,
    spinId,
    gameSessionId: null,
    wheelItemId: prizeId,
  });

  return {
    userId,
    vendorId,
    prizeId,
    spinId,
    awardId,
    qrToken,
  };
}

// =====================================================
// 5. CHECK DATABASE STATE
// =====================================================

async function checkState(
  fixture,
  {
    redeemed,
    tokenVersion,
    isActive,
    redemptionFence,
  }
) {
  const [spin, prize, vendor, award] =
    await Promise.all([
      Spin.findById(fixture.spinId).lean(),
      WheelItem.findById(fixture.prizeId).lean(),
      Vendor.findById(fixture.vendorId).lean(),
      PrizeAward.findById(fixture.awardId).lean(),
    ]);

  assert.ok(spin);
  assert.ok(prize);
  assert.ok(vendor);
  assert.ok(award);

  assert.equal(
    spin.redemptionStatus,
    redeemed ? 'redeemed' : 'pending'
  );

  assert.equal(
    prize.quantityRedeemed,
    redeemed ? 1 : 0
  );

  assert.equal(
    prize.quantityAllocated,
    1
  );

  assert.equal(
    vendor.tokenVersion,
    tokenVersion
  );

  assert.equal(
    vendor.isActive,
    isActive
  );

  assert.equal(
    vendor.redemptionFence,
    redemptionFence
  );

  assert.equal(
    String(award.spinId),
    String(fixture.spinId)
  );

  if (redeemed) {
    assert.equal(
      String(spin.redeemedByVendorId),
      String(fixture.vendorId)
    );

    assert.ok(spin.redeemedAt);
  } else {
    assert.equal(spin.redeemedAt == null, true);
  }
}

// =====================================================
// 6. PAUSE THE AUTHORIZATION FENCE
// =====================================================

/**
 * Intercepts only the redemptionFence write
 * for one specified vendor.
 *
 * The actual MongoDB write is delayed until
 * release() is called.
 *
 * This guarantees revocation can commit before
 * the redemption authorization check executes.
 *
 * Note: This is a test-controlled pause before
 * the database write, not a test of MongoDB
 * write conflicts after the fence is acquired.
 */

function pauseNextFence(vendorId) {
  let signalEntered;
  let signalRelease;
  let intercepted = false;

  const entered = new Promise(resolve => {
    signalEntered = resolve;
  });

  const released = new Promise(resolve => {
    signalRelease = resolve;
  });

  Vendor.findOneAndUpdate = function (
    filter,
    update,
    options
  ) {
    const isTarget =
      !intercepted &&
      String(filter?._id) === String(vendorId) &&
      update?.$inc?.redemptionFence === 1 &&
      options?.session != null;

    if (!isTarget) {
      return originalVendorUpdate.apply(
        this,
        arguments
      );
    }

    intercepted = true;

    const model = this;
    const args = [
      filter,
      update,
      options,
    ];

    return (async () => {
      signalEntered();

      await released;

      // Execute the original conditional write,
      // preserving its MongoDB session.
      return originalVendorUpdate.apply(
        model,
        args
      );
    })();
  };

  return {
    entered,
    release() {
      signalRelease();
    },
    restore() {
      Vendor.findOneAndUpdate =
        originalVendorUpdate;
    },
  };
}

// =====================================================
// 7. REDEMPTION HELPER
// =====================================================

function redeem(fixture, tokenVersion) {
  return redeemPrize({
    qrToken: fixture.qrToken,
    vendorId: fixture.vendorId,
    tokenVersion,
  });
}

// =====================================================
// 8. TEST EXECUTION
// =====================================================

async function main() {
  let activePause = null;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    connected = true;

    await verifySandbox();

    const revokedFixture = await createFixture(1);
    const disabledFixture = await createFixture(2);

    // ================================================
    // TEST 1:
    // REVOKE WHILE REDEMPTION IS PAUSED
    // ================================================

    activePause = pauseNextFence(
      revokedFixture.vendorId
    );

    const oldTokenRedemption = redeem(
      revokedFixture,
      0
    );

    await timeout(
      activePause.entered,
      10000,
      'Revoked-case fence not reached'
    );

    const revoked = await revokeVendorSessions(
      revokedFixture.vendorId
    );

    assert.ok(revoked);
    assert.equal(revoked.tokenVersion, 1);

    activePause.release();

    await expectError(
      timeout(
        oldTokenRedemption,
        15000,
        'Old token redemption'
      ),
      403,
      'VENDOR_SESSION_INVALID'
    );

    activePause.restore();
    activePause = null;

    console.log(
      'PASS 1: Revocation committed before fence'
    );

    // ================================================
    // TEST 2:
    // FAILED REDEMPTION CHANGED NOTHING
    // ================================================

    await checkState(revokedFixture, {
      redeemed: false,
      tokenVersion: 1,
      isActive: true,
      redemptionFence: 0,
    });

    console.log(
      'PASS 2: Revoked token caused no redemption'
    );

    // ================================================
    // TEST 3:
    // NEW TOKEN VERSION CAN REDEEM
    // ================================================

    const freshResult = await redeem(
      revokedFixture,
      1
    );

    assert.equal(
      freshResult.prize,
      'Reverse Race Prize 1'
    );

    await checkState(revokedFixture, {
      redeemed: true,
      tokenVersion: 1,
      isActive: true,
      redemptionFence: 1,
    });

    console.log(
      'PASS 3: Fresh token version can redeem'
    );

    // ================================================
    // TEST 4:
    // DISABLE BEFORE AUTHORIZATION FENCE
    // ================================================

    activePause = pauseNextFence(
      disabledFixture.vendorId
    );

    const pendingRedemption = redeem(
      disabledFixture,
      0
    );

    await timeout(
      activePause.entered,
      10000,
      'Disabled-case fence not reached'
    );

    const disabled = await disableVendor(
      disabledFixture.vendorId
    );

    assert.ok(disabled);
    assert.equal(disabled.isActive, false);
    assert.equal(disabled.tokenVersion, 1);

    activePause.release();

    await expectError(
      timeout(
        pendingRedemption,
        15000,
        'Disabled vendor redemption'
      ),
      403,
      'VENDOR_SESSION_INVALID'
    );

    activePause.restore();
    activePause = null;

    console.log(
      'PASS 4: Disable before fence rejects redemption'
    );

    // ================================================
    // TEST 5:
    // DISABLED VENDOR CANNOT REDEEM
    // ================================================

    await checkState(disabledFixture, {
      redeemed: false,
      tokenVersion: 1,
      isActive: false,
      redemptionFence: 0,
    });

    await expectError(
      redeem(disabledFixture, 1),
      403,
      'VENDOR_SESSION_INVALID'
    );

    console.log(
      'PASS 5: Disabled vendor cannot redeem'
    );

    // ================================================
    // TEST 6:
    // RE-ENABLE REQUIRES ANOTHER TOKEN VERSION
    // ================================================

    const enabled = await enableVendor(
      disabledFixture.vendorId
    );

    assert.ok(enabled);
    assert.equal(enabled.isActive, true);
    assert.equal(enabled.tokenVersion, 2);

    // Previously issued token version remains invalid.
    await expectError(
      redeem(disabledFixture, 1),
      403,
      'VENDOR_SESSION_INVALID'
    );

    await checkState(disabledFixture, {
      redeemed: false,
      tokenVersion: 2,
      isActive: true,
      redemptionFence: 0,
    });

    // Newly issued version is accepted.
    const enabledResult = await redeem(
      disabledFixture,
      2
    );

    assert.equal(
      enabledResult.prize,
      'Reverse Race Prize 2'
    );

    await checkState(disabledFixture, {
      redeemed: true,
      tokenVersion: 2,
      isActive: true,
      redemptionFence: 1,
    });

    console.log(
      'PASS 6: Re-enabled vendor requires fresh session'
    );

    console.log(
      '\nHNC STEP 15R.17K: PASS (6/6 TESTS)'
    );

  } catch (error) {
    console.error(
      '\nHNC STEP 15R.17K: FAIL'
    );

    console.error(error);
    process.exitCode = 1;

  } finally {
    if (activePause) {
      activePause.release();
      activePause.restore();
    }

    Vendor.findOneAndUpdate =
      originalVendorUpdate;

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
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

        for (const Model of cleanupOrder) {
          const ids = created.get(Model);

          if (ids.length > 0) {
            await Model.deleteMany({
              _id: { $in: ids },
            });
          }
        }

        // Verify test records were removed.
        for (const Model of models) {
          const ids = created.get(Model);

          if (ids.length === 0) {
            continue;
          }

          const remaining =
            await Model.countDocuments({
              _id: { $in: ids },
            });

          assert.equal(
            remaining,
            0,
            `${Model.modelName} fixtures remain`
          );
        }

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
