
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  allocatePrize,
} = require('../features/prizes/services/prizeAllocationService');

async function main() {
  let passed = 0;

  function pass(message) {
    passed++;
    console.log(`PASS ${passed}: ${message}`);
  }

  assert.equal(
    process.env.ALLOCATION_ENABLED,
    'false',
    'Allocation must remain disabled in .env'
  );

  pass('Environment allocation flag is false');

  assert.equal(
    mongoose.connection.readyState,
    0,
    'Test must begin disconnected from MongoDB'
  );

  pass('No database connection');

  const userId = new mongoose.Types.ObjectId();
  const gameSessionId = new mongoose.Types.ObjectId();

  // If the disabled boundary tries to start a
  // transaction, the test must fail immediately.
  const originalTransaction =
    mongoose.connection.transaction;

  let transactionCalled = false;

  mongoose.connection.transaction = async () => {
    transactionCalled = true;
    throw new Error('UNEXPECTED_DATABASE_TRANSACTION');
  };

  try {
    await assert.rejects(
      () => allocatePrize({
        userId,
        gameSessionId,
      }),
      error =>
        error.code === 'PRIZE_ALLOCATION_DISABLED' &&
        error.status === 503
    );

    pass('Valid allocation request blocked');

    await assert.rejects(
      () => allocatePrize({
        userId: 'invalid',
        gameSessionId: 'invalid',
      }),
      error =>
        error.code === 'PRIZE_ALLOCATION_DISABLED'
    );

    pass('Invalid allocation request blocked');

    await assert.rejects(
      () => allocatePrize({}),
      error =>
        error.code === 'PRIZE_ALLOCATION_DISABLED'
    );

    pass('Missing identifiers cannot bypass gate');

    assert.equal(
      transactionCalled,
      false,
      'Allocation unexpectedly entered a transaction'
    );

    pass('No allocation transaction executed');

    assert.equal(
      mongoose.connection.readyState,
      0
    );

    pass('MongoDB remained disconnected');

    console.log(
      `\nRESULT: ${passed}/7 TESTS PASSED`
    );
  } finally {
    mongoose.connection.transaction =
      originalTransaction;
  }
}

main().catch(error => {
  console.error('TEST FAILED:', error);
  process.exitCode = 1;
});
