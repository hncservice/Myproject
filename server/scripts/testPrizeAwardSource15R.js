
'use strict';

/**
 * HNC Phase 4 — Step 15R.17I
 * PrizeAward source validation tests.
 *
 * No MongoDB connection required.
 * No database writes.
 */

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const PrizeAward = require('../features/prizes/models/PrizeAward');

function newId() {
  return new mongoose.Types.ObjectId();
}

function createAward(overrides = {}) {
  return new PrizeAward({
    userId: newId(),
    campaignId: 'sandbox-source-validation',
    wheelItemId: newId(),
    spinId: null,
    gameSessionId: null,
    ...overrides,
  });
}

async function shouldValidate(award) {
  await award.validate();
}

async function shouldReject(award) {
  await assert.rejects(
    async () => award.validate(),
    error => {
      assert.equal(error.name, 'ValidationError');

      assert.match(
        error.message,
        /exactly one source/i
      );

      return true;
    }
  );
}

async function main() {
  // 1. Legacy Spin only.
  await shouldValidate(
    createAward({
      spinId: newId(),
    })
  );

  console.log('PASS 1: Spin-only award accepted');

  // 2. GameSession only.
  await shouldValidate(
    createAward({
      gameSessionId: newId(),
    })
  );

  console.log(
    'PASS 2: GameSession-only award accepted'
  );

  // 3. Neither source.
  await shouldReject(
    createAward()
  );

  console.log(
    'PASS 3: Award without a source rejected'
  );

  // 4. Both sources simultaneously.
  await shouldReject(
    createAward({
      spinId: newId(),
      gameSessionId: newId(),
    })
  );

  console.log(
    'PASS 4: Award with both sources rejected'
  );

  console.log(
    '\nHNC STEP 15R.17I: PASS (4/4 TESTS)'
  );

  console.log(
    'No database connection or writes performed.'
  );
}

main().catch(error => {
  console.error(
    '\nHNC STEP 15R.17I: FAIL'
  );

  console.error(error);
  process.exitCode = 1;
});
