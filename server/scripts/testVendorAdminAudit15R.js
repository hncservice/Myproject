
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const express = require('express');

const DB_NAME = 'hnc_step15q_sandbox';
const uri = process.env.HNC_SANDBOX_MONGO_URI;

if (!uri) throw new Error('Sandbox URI missing');

const parsed = new URL(uri);

if (
  !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
  parsed.pathname !== `/${DB_NAME}` ||
  (
    parsed.searchParams.has('dbName') &&
    parsed.searchParams.get('dbName') !== DB_NAME
  )
) {
  throw new Error('SAFETY BLOCK: Wrong database URI');
}

const Vendor = require('../features/vendors/models/Vendor');
const AdminAuditLog = require('../features/administration/models/AdminAuditLog');

const {
  updateVendor,
} = require('../features/administration/controllers/adminController');

const {
  authVendor,
} = require('../features/authentication/middleware/authMiddleware');

const {
  signToken,
} = require('../config/jwt');

const vendorId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

const email =
  `audit-${vendorId.toString()}@example.com`;

const oldPassword = 'OldSandboxPassword123!';
const newPassword = 'NewSandboxPassword123!';

async function checkPermissions() {
  assert.equal(mongoose.connection.name, DB_NAME);

  const status =
    await mongoose.connection.db.admin().command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    status.authInfo.authenticatedUserPrivileges || [];

  for (const action of [
    'find', 'insert', 'update', 'remove',
  ]) {
    assert.ok(
      privileges.some(p =>
        p.resource?.db === DB_NAME &&
        p.actions?.includes(action)
      )
    );
  }

  assert.equal(
    privileges.filter(p => {
      const db = p.resource?.db;
      return db === '' ||
        (db && db !== DB_NAME);
    }).length,
    0
  );
}

async function main() {
  let server;
  let connected = false;
  const originalAuditCreate = AdminAuditLog.create;

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    connected = true;
    await checkPermissions();

    console.log('Sandbox isolation: VERIFIED');

    await Vendor.create({
      _id: vendorId,
      name: 'Audit Test Vendor',
      email,
      passwordHash: await bcrypt.hash(
        oldPassword, 10
      ),
      isActive: true,
      tokenVersion: 0,
    });

    const app = express();
    app.set('trust proxy', false);
    app.use(express.json());

    // Test-only administrator identity.
    // The real controller receives the same req.admin
    // shape supplied by authAdmin.
    app.put('/vendor/:id',
      (req, res, next) => {
        req.admin = { _id: adminId };
        next();
      },
      updateVendor
    );

    app.get('/vendor/protected',
      authVendor,
      (req, res) => res.json({ ok: true })
    );

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

    async function putVendor(data) {
      const response = await fetch(
        `${base}/vendor/${vendorId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(15000),
        }
      );

      return {
        status: response.status,
        body: await response.json(),
      };
    }

    async function protectedRequest(token) {
      const response = await fetch(
        `${base}/vendor/protected`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(15000),
        }
      );

      return response.status;
    }

    const oldToken = signToken({
      id: vendorId,
      type: 'vendor',
      tokenVersion: 0,
    });

    assert.equal(
      await protectedRequest(oldToken), 200
    );

    console.log('PASS 1: Initial JWT accepted');

    const profile = await putVendor({
      name: 'Updated Audit Vendor',
      email,
    });

    assert.equal(profile.status, 200);

    let vendor = await Vendor.findById(vendorId);

    assert.equal(vendor.tokenVersion, 0);
    assert.equal(
      await protectedRequest(oldToken), 200
    );

    console.log(
      'PASS 2: Profile update preserves sessions'
    );

    const changePassword = await putVendor({
      name: 'Updated Audit Vendor',
      email,
      password: newPassword,
    });

    assert.equal(changePassword.status, 200);

    vendor = await Vendor.findById(vendorId);

    assert.equal(vendor.tokenVersion, 1);
    assert.equal(
      await bcrypt.compare(
        newPassword,
        vendor.passwordHash
      ),
      true
    );

    assert.equal(
      await protectedRequest(oldToken), 401
    );

    console.log(
      'PASS 3: Password update revokes old JWT'
    );

    let logs = await AdminAuditLog.find({
      targetType: 'Vendor',
      targetId: vendorId,
    }).lean();

    assert.equal(logs.length, 2);

    assert.equal(
      logs.some(log =>
        log.details?.sessionsRevoked === true
      ),
      true
    );

    console.log(
      'PASS 4: Both changes have audit records'
    );

    // Simulate audit-write failure to test rollback.
    AdminAuditLog.create = async () => {
      throw new Error('SIMULATED_AUDIT_FAILURE');
    };

    const failed = await putVendor({
      name: 'Should Not Be Saved',
      email,
    });

    assert.equal(failed.status, 500);

    vendor = await Vendor.findById(vendorId);

    assert.equal(
      vendor.name,
      'Updated Audit Vendor'
    );

    logs = await AdminAuditLog.find({
      targetType: 'Vendor',
      targetId: vendorId,
    });

    assert.equal(logs.length, 2);

    console.log(
      'PASS 5: Audit failure rolls back vendor update'
    );

    AdminAuditLog.create = originalAuditCreate;

    console.log(
      '\nHNC STEP 15R.12C: PASS (5/5 TESTS)'
    );

  } catch (error) {
    console.error('\nHNC STEP 15R.12C: FAIL');
    console.error(error);
    process.exitCode = 1;

  } finally {
    AdminAuditLog.create = originalAuditCreate;

    if (server) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
    }

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error('Cleanup database mismatch');
        }

        await AdminAuditLog.deleteMany({
          targetType: 'Vendor',
          targetId: vendorId,
        });

        await Vendor.deleteOne({
          _id: vendorId,
          email,
        });

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
