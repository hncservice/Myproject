
'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const PrizeDecision = require('../features/prizes/models/PrizeDecision');

let passed = 0;

const userId = new mongoose.Types.ObjectId();
const gameSessionId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();
const awardId = new mongoose.Types.ObjectId();

function makeDecision(overrides = {}) {
  return new PrizeDecision({
    userId,
    gameSessionId,
    campaignId: 'sandbox-model-validation',
    gameId: 'monkey',
    status: 'pending_review',
    ...overrides,
  });
}

async function test(name, callback) {
  await callback();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

async function valid(overrides) {
  const document = makeDecision(overrides);
  await document.validate();
}

async function invalid(overrides) {
  const document = makeDecision(overrides);

  await assert.rejects(
    document.validate(),
    error => error.name === 'ValidationError'
  );
}

async function main() {
  await test('Valid pending review', async () => {
    await valid({
      riskReasons: ['SUSPICIOUS_ACTIVITY'],
    });
  });

  await test('Valid ready for draw', async () => {
    await valid({
      status: 'ready_for_draw',
      riskReasons: [],
    });
  });

  await test('Ready for draw cannot contain risk reasons', async () => {
    await invalid({
      status: 'ready_for_draw',
      riskReasons: ['SUSPICIOUS_ACTIVITY'],
    });
  });

  await test('Ready for draw cannot contain an award', async () => {
    await invalid({
      status: 'ready_for_draw',
      decision: 'PRIZE_AWARDED',
      prizeAwardId: awardId,
      decidedAt: new Date(),
    });
  });

  await test('Ready for draw cannot contain admin approval', async () => {
    await invalid({
      status: 'ready_for_draw',
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    });
  });

  await test('Valid administrator approval', async () => {
    await valid({
      status: 'approved',
      riskReasons: ['MANUAL_REVIEW'],
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    });
  });

  await test('Approval without admin rejected', async () => {
    await invalid({
      status: 'approved',
    });
  });

  await test('Valid administrator rejection', async () => {
    await valid({
      status: 'rejected',
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    });
  });

  await test('Pending review cannot contain an award', async () => {
    await invalid({
      status: 'pending_review',
      decision: 'PRIZE_AWARDED',
      prizeAwardId: awardId,
    });
  });

  await test('Valid final No Prize', async () => {
    await valid({
      status: 'no_prize',
      decision: 'NO_PRIZE',
      decidedAt: new Date(),
    });
  });

  await test('Valid final Prize Awarded', async () => {
    await valid({
      status: 'prize_awarded',
      decision: 'PRIZE_AWARDED',
      prizeAwardId: awardId,
      decidedAt: new Date(),
    });
  });

  await test('Awarded without award ID rejected', async () => {
    await invalid({
      status: 'prize_awarded',
      decision: 'PRIZE_AWARDED',
      decidedAt: new Date(),
    });
  });

  await test('Invalid status rejected', async () => {
    await invalid({
      status: 'unknown_status',
    });
  });

  await test('Assessment version defaults to 2', async () => {
    const document = makeDecision();

    assert.equal(document.assessmentVersion, 2);
  });

  console.log(
    `\nRESULT: ${passed}/14 TESTS PASSED`
  );
}

main().catch(error => {
  console.error('TEST FAILED:', error);
  process.exitCode = 1;
});
