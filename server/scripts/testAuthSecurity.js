
'use strict';

/**
 * HNC Phase 4 - Step 15N
 * Authentication security tests.
 *
 * - Uses real JWT sign/verify functions
 * - Uses real authentication middleware
 * - Mocks database account lookups
 * - No MongoDB connection
 * - No emails or OTP requests
 * - No existing account changes
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../features/authentication/models/User');
const Vendor = require('../features/vendors/models/Vendor');
const AdminUser = require('../features/administration/models/AdminUser');

const { signToken } = require('../config/jwt');

const {
  authUser,
  authVendor,
  authAdmin,
  auth,
  requireAdmin,
} = require('../features/authentication/middleware/authMiddleware');

const userId = new mongoose.Types.ObjectId();
const vendorId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

const originalFindById = {
  user: User.findById,
  vendor: Vendor.findById,
  admin: AdminUser.findById,
};

const accounts = {
  user: {
    _id: userId,
    name: 'Test Customer',
    emailVerified: true,
  },
  vendor: {
    _id: vendorId,
    name: 'Test Vendor',
  },
  admin: {
    _id: adminId,
    name: 'Test Administrator',
  },
};

function mockLookup(modelName, id) {
  const account = accounts[modelName];

  if (
    account &&
    String(account._id) === String(id)
  ) {
    return Promise.resolve(account);
  }

  return Promise.resolve(null);
}

function installMocks() {
  User.findById = (id) =>
    mockLookup('user', id);

  Vendor.findById = (id) =>
    mockLookup('vendor', id);

  AdminUser.findById = (id) =>
    mockLookup('admin', id);
}

function restoreMocks() {
  User.findById = originalFindById.user;
  Vendor.findById = originalFindById.vendor;
  AdminUser.findById = originalFindById.admin;
}

function makeRequest(token) {
  return {
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
  };
}

async function executeMiddleware(
  middleware,
  token
) {
  const req = makeRequest(token);

  let statusCode = 200;
  let responseBody = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },

    json(body) {
      responseBody = body;
      return this;
    },
  };

  const next = () => {
    nextCalled = true;
  };

  await middleware(req, res, next);

  return {
    req,
    statusCode,
    responseBody,
    nextCalled,
  };
}

async function expectAllowed(
  middleware,
  token,
  attachedProperty
) {
  const result = await executeMiddleware(
    middleware,
    token
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);

  if (attachedProperty) {
    assert.ok(
      result.req[attachedProperty],
      `${attachedProperty} was not attached`
    );
  }
}

async function expectDenied(
  middleware,
  token,
  status
) {
  const result = await executeMiddleware(
    middleware,
    token
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, status);
}

const userToken = signToken({
  id: String(userId),
  type: 'user',
});

const vendorToken = signToken({
  id: String(vendorId),
  type: 'vendor',
});

const adminToken = signToken({
  id: String(adminId),
  type: 'admin',
});

let passed = 0;

async function test(label, fn) {
  await fn();
  passed += 1;
  console.log(`PASS: ${label}`);
}

async function main() {
  installMocks();

  try {
    await test(
      'Valid customer token accepted',
      async () => {
        await expectAllowed(
          authUser,
          userToken,
          'user'
        );
      }
    );

    await test(
      'Valid vendor token accepted',
      async () => {
        await expectAllowed(
          authVendor,
          vendorToken,
          'vendor'
        );
      }
    );

    await test(
      'Valid admin token accepted',
      async () => {
        await expectAllowed(
          authAdmin,
          adminToken,
          'admin'
        );
      }
    );

    await test(
      'Customer token cannot access vendor routes',
      async () => {
        await expectDenied(
          authVendor,
          userToken,
          403
        );
      }
    );

    await test(
      'Admin token cannot access vendor routes',
      async () => {
        await expectDenied(
          authVendor,
          adminToken,
          403
        );
      }
    );

    await test(
      'Vendor token cannot access admin routes',
      async () => {
        await expectDenied(
          authAdmin,
          vendorToken,
          403
        );
      }
    );

    await test(
      'Vendor token cannot access customer routes',
      async () => {
        await expectDenied(
          authUser,
          vendorToken,
          401
        );
      }
    );

    await test(
      'Missing token rejected',
      async () => {
        await expectDenied(
          authVendor,
          null,
          401
        );
      }
    );

    await test(
      'Invalid token rejected',
      async () => {
        await expectDenied(
          authVendor,
          'invalid.jwt.token',
          401
        );
      }
    );

    await test(
      'Expired token rejected',
      async () => {
        const expired = signToken(
          {
            id: String(vendorId),
            type: 'vendor',
          },
          -10
        );

        await expectDenied(
          authVendor,
          expired,
          401
        );
      }
    );

    await test(
      'Malformed vendor ID rejected',
      async () => {
        const malformed = signToken({
          id: 'invalid-id',
          type: 'vendor',
        });

        await expectDenied(
          authVendor,
          malformed,
          401
        );
      }
    );

    await test(
      'Deleted or nonexistent vendor rejected',
      async () => {
        const nonexistent = signToken({
          id: String(
            new mongoose.Types.ObjectId()
          ),
          type: 'vendor',
        });

        await expectDenied(
          authVendor,
          nonexistent,
          401
        );
      }
    );

    await test(
      'Tampered JWT rejected',
      async () => {
        const parts = vendorToken.split('.');

        const tamperedPayload = Buffer.from(
          JSON.stringify({
            id: String(adminId),
            type: 'admin',
          })
        ).toString('base64url');

        const tampered = [
          parts[0],
          tamperedPayload,
          parts[2],
        ].join('.');

        await expectDenied(
          authAdmin,
          tampered,
          401
        );
      }
    );

    await test(
      'Unsigned JWT rejected',
      async () => {
        const unsigned = jwt.sign(
          {
            id: String(vendorId),
            type: 'vendor',
          },
          undefined,
          { algorithm: 'none' }
        );

        await expectDenied(
          authVendor,
          unsigned,
          401
        );
      }
    );

    await test(
      'Generic authentication accepts valid admin token',
      async () => {
        await expectAllowed(
          auth,
          adminToken,
          'user'
        );
      }
    );

    await test(
      'Generic admin authorization rejects vendor',
      async () => {
        const result = await executeMiddleware(
          auth,
          vendorToken
        );

        assert.equal(result.nextCalled, true);

        const req = result.req;

        let statusCode = 200;
        let nextCalled = false;

        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          json() {
            return this;
          },
        };

        requireAdmin(req, res, () => {
          nextCalled = true;
        });

        assert.equal(statusCode, 403);
        assert.equal(nextCalled, false);
      }
    );

    await test(
      'Generic admin authorization accepts admin',
      async () => {
        const result = await executeMiddleware(
          auth,
          adminToken
        );

        assert.equal(result.nextCalled, true);

        let nextCalled = false;

        const res = {
          status() {
            throw new Error(
              'Admin unexpectedly rejected'
            );
          },
        };

        requireAdmin(
          result.req,
          res,
          () => {
            nextCalled = true;
          }
        );

        assert.equal(nextCalled, true);
      }
    );

    console.log(
      `\nHNC STEP 15N: PASS (${passed}/17 TESTS)`
    );

    console.log(
      'No MongoDB connection or account changes.'
    );
  } finally {
    restoreMocks();
  }
}

main().catch((error) => {
  restoreMocks();

  console.error(
    '\nHNC STEP 15N: FAIL'
  );

  console.error(error);
  process.exitCode = 1;
});
