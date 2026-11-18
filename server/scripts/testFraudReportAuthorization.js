
'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  authorizeFraudReport,
} = require('../features/fraud-monitoring/controllers/gameplayFraudReportController');

const EXPECTED_TESTS = 9;
let passed = 0;

function admin(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    role: 'admin',
    isActive: true,
    disabledAt: null,
    tokenVersion: 0,
    ...overrides,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },
  };
}

function invoke({
  account,
  tokenVersion = 0,
} = {}) {
  const req = {
    admin: account,
    adminTokenVersion: tokenVersion,
  };

  const res = response();

  let nextCalled = false;

  authorizeFraudReport(req, res, () => {
    nextCalled = true;
  });

  return {
    status: res.statusCode,
    body: res.body,
    nextCalled,
  };
}

function test(label, action) {
  action();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

// ============================================
// TEST 1: MISSING ADMIN
// ============================================

test('Missing administrator rejected', () => {
  const result = invoke();

  assert.equal(result.status, 401);
  assert.equal(result.nextCalled, false);
});

// ============================================
// TEST 2: ADMIN ALLOWED
// ============================================

test('Admin role authorized', () => {
  const result = invoke({
    account: admin({ role: 'admin' }),
  });

  assert.equal(result.nextCalled, true);
});

// ============================================
// TEST 3: SUPERADMIN ALLOWED
// ============================================

test('Superadmin role authorized', () => {
  const result = invoke({
    account: admin({ role: 'superadmin' }),
  });

  assert.equal(result.nextCalled, true);
});

// ============================================
// TEST 4: INVALID ROLE
// ============================================

test('Unknown role rejected', () => {
  const result = invoke({
    account: admin({ role: 'viewer' }),
  });

  assert.equal(result.status, 403);
  assert.equal(result.nextCalled, false);
});

// ============================================
// TEST 5: DISABLED ACCOUNT
// ============================================

test('Disabled administrator rejected', () => {
  const result = invoke({
    account: admin({ isActive: false }),
  });

  assert.equal(result.status, 403);
  assert.equal(result.nextCalled, false);
});

// ============================================
// TEST 6: DISABLED TIMESTAMP
// ============================================

test('Disabled timestamp rejected', () => {
  const result = invoke({
    account: admin({
      disabledAt: new Date(),
    }),
  });

  assert.equal(result.status, 403);
  assert.equal(result.nextCalled, false);
});

// ============================================
// TEST 7: REVOKED TOKEN
// ============================================

test('Revoked token version rejected', () => {
  const result = invoke({
    account: admin({ tokenVersion: 2 }),
    tokenVersion: 1,
  });

  assert.equal(result.status, 401);
  assert.equal(result.nextCalled, false);
});

// ============================================
// TEST 8: INVALID TOKEN VERSION
// ============================================

test('Invalid token version rejected', () => {
  const result = invoke({
    account: admin({ tokenVersion: 0 }),
    tokenVersion: -1,
  });

  assert.equal(result.status, 401);
  assert.equal(result.nextCalled, false);
});

// ============================================
// TEST 9: VALID CURRENT TOKEN
// ============================================

test('Current token version authorized', () => {
  const result = invoke({
    account: admin({ tokenVersion: 3 }),
    tokenVersion: 3,
  });

  assert.equal(result.nextCalled, true);
});

// ============================================
// FINAL RESULT
// ============================================

assert.equal(passed, EXPECTED_TESTS);

console.log(
  `\nRESULT: ${passed}/${EXPECTED_TESTS} TESTS PASSED`
);
