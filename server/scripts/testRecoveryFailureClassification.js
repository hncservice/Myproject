
'use strict';

const assert = require('node:assert/strict');

const {
  classifyRecoveryFailure,
} = require('../features/prizes/services/prizeRecoveryFailureClassifier');

let passed = 0;

function test(label, action) {
  action();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

test('Unverified customer is permanent', () => {
  const result = classifyRecoveryFailure(
    'EMAIL_NOT_VERIFIED'
  );
  assert.equal(result.category, 'permanent');
  assert.equal(result.retryable, false);
});

test('Already awarded customer is permanent', () => {
  const result = classifyRecoveryFailure(
    'PRIZE_ALREADY_AWARDED'
  );
  assert.equal(result.retryable, false);
});

test('Unqualified gameplay is permanent', () => {
  const result = classifyRecoveryFailure(
    'GAME_NOT_QUALIFIED'
  );
  assert.equal(result.category, 'permanent');
});

test('Invalid identity is permanent', () => {
  const result = classifyRecoveryFailure(
    'INVALID_RECOVERY_IDENTITY'
  );
  assert.equal(result.retryable, false);
});

test('Network error is transient', () => {
  const result = classifyRecoveryFailure(
    'MONGO_NETWORK_ERROR'
  );
  assert.equal(result.category, 'transient');
  assert.equal(result.retryable, true);
});

test('Database timeout is transient', () => {
  const result = classifyRecoveryFailure(
    'MONGO_TIMEOUT'
  );
  assert.equal(result.retryable, true);
});

test('Write conflict is transient', () => {
  const result = classifyRecoveryFailure(
    'MONGO_WRITE_CONFLICT'
  );
  assert.equal(result.category, 'transient');
});

test('Injected database failure is transient', () => {
  const result = classifyRecoveryFailure(
    'INJECTED_DB_FAILURE'
  );
  assert.equal(result.retryable, true);
});

test('Unavailable assessment is transient', () => {
  const result = classifyRecoveryFailure(
    'ASSESSMENT_UNAVAILABLE'
  );
  assert.equal(result.category, 'transient');
});

test('Unknown error is conservatively retryable', () => {
  const result = classifyRecoveryFailure(
    'UNEXPECTED_INTERNAL_FAILURE'
  );
  assert.equal(result.category, 'unknown');
  assert.equal(result.retryable, true);
});

test('Malformed error codes are rejected', () => {
  assert.throws(
    () => classifyRecoveryFailure(
      'bad error message'
    ),
    error => error.code === 'INVALID_ERROR_CODE'
  );
});

test('Missing error code is rejected', () => {
  assert.throws(
    () => classifyRecoveryFailure(undefined),
    error => error.code === 'INVALID_ERROR_CODE'
  );
});

console.log(
  `\nRESULT: ${passed}/12 TESTS PASSED`
);
