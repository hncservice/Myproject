
'use strict';

/**
 * HNC Phase 4 - Step 15R.13C
 * Prize inventory and administrator audit tests.
 *
 * Restricted sandbox only.
 * No real prize allocation.
 * No production database writes.
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');

const DB_NAME = 'hnc_step15q_sandbox';
const URI = process.env.HNC_SANDBOX_MONGO_URI;

if (!URI) {
  throw new Error('Sandbox URI missing');
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

const WheelItem = require('../features/prizes/models/WheelItem');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const AdminAuditLog = require('../features/administration/models/AdminAuditLog');

const {
  updateWheelItem,
  deleteWheelItem,
} = require('../features/administration/controllers/adminController');

const itemId = new mongoose.Types.ObjectId();
const awardId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

const originalAuditCreate = AdminAuditLog.create;

let server;
let connected = false;

async function verifySandbox() {
  assert.equal(mongoose.connection.name, DB_NAME);
  assert.equal(mongoose.connection.readyState, 1);

  const result = await mongoose.connection.db.admin()
    .command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    result.authInfo.authenticatedUserPrivileges || [];

  for (const action of [
    'find', 'insert', 'update', 'remove',
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

  assert.equal(
    outside.length,
    0,
    'Unexpected database permissions'
  );

  console.log('Sandbox isolation: VERIFIED');
}

function prizeBody(quantityTotal, extra = {}) {
  return {
    title: 'Step15R Test Prize',
    description: 'Sandbox inventory test',
    probabilityWeight: 5,
    quantityTotal,
    isActive: true,
    ...extra,
  };
}

async function request(base, method, body) {
  const response = await fetch(
    `${base}/api/admin/wheel-items/${itemId}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body ? {
        body: JSON.stringify(body),
      } : {}),
      signal: AbortSignal.timeout(20000),
    }
  );

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function storedItem() {
  return WheelItem.findById(itemId).lean();
}

async function auditCount() {
  return AdminAuditLog.countDocuments({
    targetType: 'WheelItem',
    targetId: itemId,
  });
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

    // Create uniquely identified sandbox fixtures.
    await WheelItem.create({
      _id: itemId,
      title: 'Step15R Test Prize',
      probabilityWeight: 5,
      quantityTotal: 6,
      quantityAllocated: 3,
      quantityRedeemed: 1,
      isActive: true,
    });

    // A test award referencing this prize.
    // No real customer or winning QR is created.
    await PrizeAward.create({
      _id: awardId,
      userId: new mongoose.Types.ObjectId(),
      campaignId: `step15r-${itemId}`,
      spinId: new mongoose.Types.ObjectId(),
      wheelItemId: itemId,
    });

    const app = express();
    app.set('trust proxy', false);
    app.use(express.json());

    // Test-only administrator identity.
    // Real authAdmin was tested in Step 15R.10E.
    app.use((req, res, next) => {
      req.admin = { _id: adminId };
      next();
    });

    app.put(
      '/api/admin/wheel-items/:id',
      updateWheelItem
    );

    app.delete(
      '/api/admin/wheel-items/:id',
      deleteWheelItem
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

    // TEST 1: Valid update.
    const valid = await request(
      base, 'PUT', prizeBody(8)
    );

    assert.equal(valid.status, 200);

    let item = await storedItem();

    assert.equal(item.quantityTotal, 8);
    assert.equal(item.quantityAllocated, 3);
    assert.equal(item.quantityRedeemed, 1);

    console.log('PASS 1: Valid inventory update');

    // TEST 2: Cannot reduce below allocated.
    const invalidStock = await request(
      base, 'PUT', prizeBody(2)
    );

    assert.equal(invalidStock.status, 409);

    assert.equal(
      invalidStock.body.code,
      'INVENTORY_BELOW_ALLOCATED'
    );

    item = await storedItem();
    assert.equal(item.quantityTotal, 8);

    console.log(
      'PASS 2: Inventory below allocated rejected'
    );

    // TEST 3: Direct counter changes rejected.
    const counterChange = await request(
      base, 'PUT',
      prizeBody(8, {
        quantityAllocated: 0,
        quantityRedeemed: 0,
      })
    );

    assert.equal(counterChange.status, 400);

    item = await storedItem();

    assert.equal(item.quantityAllocated, 3);
    assert.equal(item.quantityRedeemed, 1);

    console.log(
      'PASS 3: Direct inventory counter edit rejected'
    );

    // TEST 4: Initial successful update audited.
    assert.equal(await auditCount(), 1);

    console.log('PASS 4: Prize update audit created');

    // TEST 5: Audit failure rolls back update.
    AdminAuditLog.create = async () => {
      throw new Error('SIMULATED_AUDIT_FAILURE');
    };

    const rollback = await request(
      base, 'PUT',
      prizeBody(9, {
        title: 'Should Not Be Saved',
      })
    );

    assert.equal(rollback.status, 500);

    item = await storedItem();

    assert.equal(item.quantityTotal, 8);
    assert.equal(item.title, 'Step15R Test Prize');
    assert.equal(await auditCount(), 1);

    AdminAuditLog.create = originalAuditCreate;

    console.log(
      'PASS 5: Audit failure rolls back update'
    );

    // TEST 6: Concurrent administrator updates.
    const concurrent = await Promise.allSettled([
      request(base, 'PUT', prizeBody(10)),
      request(base, 'PUT', prizeBody(11)),
    ]);

    const responses = concurrent.map(result =>
      result.status === 'fulfilled'
        ? result.value.status
        : 'REQUEST_ERROR'
    );

    console.log(
      'Concurrent HTTP statuses:',
      responses.join(', ')
    );

    item = await storedItem();

    assert.ok(item.quantityTotal >= 3);
    assert.equal(item.quantityAllocated, 3);
    assert.equal(item.quantityRedeemed, 1);

    assert.ok(
      responses.includes(200),
      'At least one update must succeed'
    );

    assert.ok(
      [10, 11].includes(item.quantityTotal)
    );

    console.log(
      'PASS 6: Concurrent updates preserve inventory'
    );

    // TEST 7: Deactivation preserves references.
    const deactivate = await request(
      base, 'DELETE'
    );

    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.body.deleted, false);

    item = await storedItem();

    assert.ok(item);
    assert.equal(item.isActive, false);
    assert.equal(item.quantityAllocated, 3);
    assert.equal(item.quantityRedeemed, 1);

    const award = await PrizeAward.findById(
      awardId
    ).lean();

    assert.ok(award);
    assert.equal(
      String(award.wheelItemId),
      String(itemId)
    );

    console.log(
      'PASS 7: Deactivation preserves award reference'
    );

    // TEST 8: Deactivation is audited.
    const deactivateLog = await AdminAuditLog.findOne({
      targetType: 'WheelItem',
      targetId: itemId,
      action: 'WHEEL_ITEM_DEACTIVATED',
    }).lean();

    assert.ok(deactivateLog);

    console.log('PASS 8: Deactivation audit created');

    // TEST 9: Repeated deactivation is idempotent.
    const previousAuditCount = await auditCount();

    const again = await request(base, 'DELETE');

    assert.equal(again.status, 200);
    assert.equal(again.body.deleted, false);
    assert.equal(
      await auditCount(),
      previousAuditCount
    );

    console.log(
      'PASS 9: Repeated deactivation handled safely'
    );

    console.log(
      '\nHNC STEP 15R.13C: PASS (9/9 TESTS)'
    );

  } catch (error) {
    console.error('\nHNC STEP 15R.13C: FAIL');
    console.error(error);
    process.exitCode = 1;

  } finally {
    AdminAuditLog.create = originalAuditCreate;

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
          'HTTP shutdown failed:', error.message
        );
        process.exitCode = 1;
      }
    }

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error(
            'Cleanup database mismatch'
          );
        }

        await AdminAuditLog.deleteMany({
          targetType: 'WheelItem',
          targetId: itemId,
        });

        await PrizeAward.deleteOne({
          _id: awardId,
        });

        await WheelItem.deleteOne({
          _id: itemId,
        });

        console.log('Sandbox fixtures cleaned up.');
      } catch (error) {
        console.error(
          'Cleanup failed:', error
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
