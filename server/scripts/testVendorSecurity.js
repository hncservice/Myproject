
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Vendor = require('../features/vendors/models/Vendor');
const { signToken } = require('../config/jwt');
const { authVendor } =
  require('../features/authentication/middleware/authMiddleware');

const securityService = require(
  '../features/vendors/services/vendorAccountSecurityService'
);

const vendorId = new mongoose.Types.ObjectId();

const original = {
  findById: Vendor.findById,
  findOneAndUpdate: Vendor.findOneAndUpdate,
  findByIdAndUpdate: Vendor.findByIdAndUpdate,
};

const vendor = {
  _id: vendorId,
  name: 'Test Vendor',
  isActive: true,
  tokenVersion: 0,
  disabledAt: null,
};

function installMocks() {
  Vendor.findById = async id =>
    String(id) === String(vendorId)
      ? { ...vendor }
      : null;

  Vendor.findOneAndUpdate = async (filter, update) => {
    if (String(filter._id) !== String(vendorId)) {
      return null;
    }

    if (
      filter.isActive &&
      vendor.isActive === false
    ) {
      return null;
    }

    Object.assign(vendor, update.$set || {});
    vendor.tokenVersion +=
      update.$inc?.tokenVersion || 0;

    return { ...vendor };
  };

  Vendor.findByIdAndUpdate = async (id, update) => {
    if (String(id) !== String(vendorId)) {
      return null;
    }

    vendor.tokenVersion +=
      update.$inc?.tokenVersion || 0;

    return { ...vendor };
  };
}

function restoreMocks() {
  Object.assign(Vendor, original);
}

function token(version = 0) {
  return signToken({
    id: String(vendorId),
    type: 'vendor',
    tokenVersion: version,
  });
}

async function checkAuth(jwtToken) {
  let status = 200;
  let nextCalled = false;

  const req = {
    headers: {
      authorization: `Bearer ${jwtToken}`,
    },
  };

  const res = {
    status(code) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  };

  await authVendor(req, res, () => {
    nextCalled = true;
  });

  return { status, nextCalled };
}

async function test(name, callback) {
  await callback();
  console.log(`PASS: ${name}`);
}

async function main() {
  installMocks();

  try {
    const oldToken = token(0);

    await test('Existing vendor JWT accepted', async () => {
      assert.equal(
        (await checkAuth(oldToken)).nextCalled,
        true
      );
    });

    await test('Disable vendor', async () => {
      await securityService.disableVendor(vendorId);
      assert.equal(vendor.isActive, false);
      assert.equal(vendor.tokenVersion, 1);
    });

    await test('Disabled vendor rejected', async () => {
      const result = await checkAuth(oldToken);
      assert.equal(result.status, 403);
      assert.equal(result.nextCalled, false);
    });

    await test('Enable vendor', async () => {
      await securityService.enableVendor(vendorId);
      assert.equal(vendor.isActive, true);
      assert.equal(vendor.tokenVersion, 2);
    });

    await test('Old JWT remains revoked', async () => {
      const result = await checkAuth(oldToken);
      assert.equal(result.status, 401);
    });

    const freshToken = token(2);

    await test('Fresh JWT accepted', async () => {
      assert.equal(
        (await checkAuth(freshToken)).nextCalled,
        true
      );
    });

    await test('Revoke all sessions', async () => {
      await securityService.revokeVendorSessions(
        vendorId
      );
      assert.equal(vendor.tokenVersion, 3);
    });

    await test('Revoked JWT rejected', async () => {
      assert.equal(
        (await checkAuth(freshToken)).status,
        401
      );
    });

    await test('New version JWT accepted', async () => {
      assert.equal(
        (await checkAuth(token(3))).nextCalled,
        true
      );
    });

    await test('Incorrect token version rejected', async () => {
      assert.equal(
        (await checkAuth(token(999))).status,
        401
      );
    });

    await test('Invalid vendor ID rejected', async () => {
      await assert.rejects(
        () => securityService.disableVendor('bad-id'),
        error => error.code === 'INVALID_VENDOR_ID'
      );
    });

    console.log(
      '\nHNC STEP 15P: PASS (11/11 TESTS)'
    );
    console.log(
      'No MongoDB connection or account changes.'
    );
  } finally {
    restoreMocks();
  }
}

main().catch(error => {
  restoreMocks();
  console.error('HNC STEP 15P: FAIL', error);
  process.exitCode = 1;
});
