
'use strict';

/**
 * HNC Phase 4 - Step 15R.16F
 * Excel Report Export Security Test
 *
 * - Restricted sandbox only
 * - Actual exportReport controller
 * - Actual ExcelJS workbook generation
 * - No real email or prize allocation
 * - Cleanup of uniquely identified fixtures
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

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
  throw new Error('SAFETY BLOCK: Wrong database URI');
}

const User = require('../features/authentication/models/User');
const Vendor = require('../features/vendors/models/Vendor');
const WheelItem = require('../features/prizes/models/WheelItem');
const Spin = require('../features/games/models/Spin');

const {
  exportReport,
} = require('../features/administration/controllers/adminController');

const runId = crypto.randomUUID();

const ids = {
  user: new mongoose.Types.ObjectId(),
  vendor: new mongoose.Types.ObjectId(),
  prize: new mongoose.Types.ObjectId(),
  spin: new mongoose.Types.ObjectId(),
};

const email = `excel-${runId}@example.com`;
const qrToken = crypto.randomBytes(32).toString('hex');

let server = null;
let connected = false;

const originalCountDocuments = Spin.countDocuments;

// =====================================================
// 1. SANDBOX PERMISSION VALIDATION
// =====================================================

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
    'find',
    'insert',
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

    return db === '' ||
      (db && db !== DB_NAME);
  });

  assert.equal(outside.length, 0);

  console.log('Sandbox isolation: VERIFIED');
}

// =====================================================
// 2. TEST FIXTURES
// =====================================================

async function createFixtures() {
  await User.create({
    _id: ids.user,
    name: '=2+2',
    email,
    phone: '73456789',
    passwordHash: 'sandbox-only-not-a-login',
    emailVerified: true,
  });

  await Vendor.create({
    _id: ids.vendor,
    name: '@SUM(1,2)',
    email: `vendor-${runId}@example.com`,
    passwordHash: 'sandbox-only-not-a-login',
    isActive: true,
    tokenVersion: 0,
  });

  await WheelItem.create({
    _id: ids.prize,
    title: '+SUM(1,2)',
    description: 'Sandbox Excel export test',
    probabilityWeight: 1,
    quantityTotal: 1,
    quantityAllocated: 1,
    quantityRedeemed: 1,
    isActive: false,
  });

  await Spin.create({
    _id: ids.spin,
    userId: ids.user,
    wheelItemId: ids.prize,
    status: 'won',
    qrToken,
    qrExpiry: new Date(Date.now() + 3600000),
    redemptionStatus: 'redeemed',
    redeemedByVendorId: ids.vendor,
    redeemedAt: new Date(),
    spunAt: new Date(),
  });
}

// =====================================================
// 3. HTTP REQUEST HELPER
// =====================================================

async function getExport(base, query = '') {
  return fetch(
    `${base}/api/admin/reports/export${query}`,
    {
      signal: AbortSignal.timeout(30000),
    }
  );
}

// =====================================================
// 4. EXCEL CONTENT HELPERS
// =====================================================

function allCellValues(sheet) {
  const values = [];

  sheet.eachRow(row => {
    row.eachCell({ includeEmpty: false }, cell => {
      values.push(cell.value);
    });
  });

  return values;
}

function assertSafeTextCell(cell) {
  assert.equal(
    cell.type,
    ExcelJS.ValueType.String,
    'Expected an Excel text cell'
  );

  assert.equal(
    typeof cell.value,
    'string'
  );

  assert.equal(
    /^[\s]*[=+\-@]/u.test(cell.value),
    false,
    'Potential spreadsheet formula detected'
  );
}

// =====================================================
// 5. TEST EXECUTION
// =====================================================

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

    // This test requires an otherwise empty sandbox
    // export dataset. Refuse to run if other Spins exist.
    const existingSpins = await Spin.countDocuments();

    if (existingSpins !== 0) {
      throw new Error(
        'SAFETY BLOCK: Sandbox contains existing Spins'
      );
    }

    await createFixtures();

    const app = express();

    app.set('trust proxy', false);

    // Export controller is exercised directly.
    // authAdmin was tested separately.
    app.get(
      '/api/admin/reports/export',
      exportReport
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

    // -------------------------------------------------
    // TEST 1: XLSX DOWNLOAD
    // -------------------------------------------------

    const response = await getExport(base);

    assert.equal(response.status, 200);

    assert.match(
      response.headers.get('content-type') || '',
      /spreadsheetml\.sheet/
    );

    assert.equal(
      response.headers.get('cache-control'),
      'no-store'
    );

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    assert.ok(buffer.length > 0);

    console.log('PASS 1: Excel report downloaded');

    // -------------------------------------------------
    // TEST 2: WORKBOOK IS READABLE
    // -------------------------------------------------

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet('Spins');

    assert.ok(sheet);
    assert.equal(sheet.rowCount, 2);

    const headers = sheet.getRow(1).values.slice(1);

    assert.deepEqual(headers, [
      'User Name',
      'User Email',
      'User Phone',
      'Prize',
      'Status',
      'Redemption Status',
      'Vendor',
      'Spun At',
      'Redeemed At',
    ]);

    console.log('PASS 2: XLSX structure verified');

    // -------------------------------------------------
    // TEST 3: FORMULA INJECTION PROTECTION
    // -------------------------------------------------

    const dataRow = sheet.getRow(2);

    assert.equal(dataRow.getCell(1).value, "'=2+2");
    assert.equal(
      dataRow.getCell(4).value,
      "'+SUM(1,2)"
    );

    assert.equal(
      dataRow.getCell(7).value,
      "'@SUM(1,2)"
    );

    assertSafeTextCell(dataRow.getCell(1));
    assertSafeTextCell(dataRow.getCell(4));
    assertSafeTextCell(dataRow.getCell(7));

    console.log(
      'PASS 3: Spreadsheet formulas neutralized'
    );

    // -------------------------------------------------
    // TEST 4: SENSITIVE FIELDS EXCLUDED
    // -------------------------------------------------

    const values = allCellValues(sheet);

    const serialized = JSON.stringify(values);

    assert.equal(
      serialized.includes(qrToken),
      false,
      'QR bearer token leaked into workbook'
    );

    assert.equal(
      serialized.includes(
        'sandbox-only-not-a-login'
      ),
      false,
      'Password hash field leaked'
    );

    for (const row of sheet.getRows(
      2,
      sheet.rowCount - 1
    ) || []) {
      assert.equal(row.cellCount <= 9, true);
    }

    console.log(
      'PASS 4: QR token and authentication data excluded'
    );

    // -------------------------------------------------
    // TEST 5: DATE FIELDS
    // -------------------------------------------------

    assert.ok(
      dataRow.getCell(8).value instanceof Date
    );

    assert.ok(
      dataRow.getCell(9).value instanceof Date
    );

    console.log('PASS 5: Date fields preserved');

    // -------------------------------------------------
    // TEST 6: INVALID QUERY REJECTED
    // -------------------------------------------------

    const invalidQuery = await getExport(
      base,
      '?unexpected=value'
    );

    assert.equal(invalidQuery.status, 400);

    const invalidBody = await invalidQuery.json();

    assert.equal(
      invalidBody.code,
      'INVALID_EXPORT_QUERY'
    );

    console.log(
      'PASS 6: Unsupported export query rejected'
    );

    // -------------------------------------------------
    // TEST 7: EXPORT SIZE LIMIT
    // -------------------------------------------------

    // Simulate an oversized dataset without creating
    // thousands of MongoDB documents.
    Spin.countDocuments = async () => 5001;

    const oversized = await getExport(base);

    assert.equal(oversized.status, 413);

    const oversizedBody = await oversized.json();

    assert.equal(
      oversizedBody.code,
      'EXPORT_LIMIT_EXCEEDED'
    );

    Spin.countDocuments = originalCountDocuments;

    console.log(
      'PASS 7: Export row limit enforced'
    );

    console.log(
      '\nHNC STEP 15R.16F: PASS (7/7 TESTS)'
    );

  } catch (error) {
    console.error('\nHNC STEP 15R.16F: FAIL');
    console.error(error);
    process.exitCode = 1;

  } finally {
    Spin.countDocuments = originalCountDocuments;

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
          'HTTP shutdown failed:',
          error.message
        );
        process.exitCode = 1;
      }
    }

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error(
            'SAFETY BLOCK: Cleanup database mismatch'
          );
        }

        await Spin.deleteOne({
          _id: ids.spin,
        });

        await WheelItem.deleteOne({
          _id: ids.prize,
        });

        await Vendor.deleteOne({
          _id: ids.vendor,
        });

        await User.deleteOne({
          _id: ids.user,
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
