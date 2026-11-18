
'use strict';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const {
  assessPrizeRisk,
} = require('../features/fraud-monitoring/services/prizeFraudAssessmentService');

async function main() {
  let passed = 0;

  async function test(name, fn) {
    await fn();
    passed++;
    console.log(`PASS ${passed}: ${name}`);
  }

  const userId = new mongoose.Types.ObjectId();
  const sessionId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();

  const now = Date.now();

  function validDecision(overrides = {}) {
    return new PrizeDecision({
      userId,
      campaignId: 'sandbox-security-test',
      gameSessionId: sessionId,
      gameId: 'monkey',
      status: 'pending_review',
      ...overrides,
    });
  }

  function validMonkeySession(overrides = {}) {
    const events = Array.from(
      { length: 7 },
      (_, i) => ({
        type: 'tap',
        round: i + 1,
        success: true,
        serverAt: new Date(now - 7000 + i * 1000),
      })
    );

    return {
      gameId: 'monkey',
      status: 'completed',
      outcome: 'qualified',
      score: 7,
      startedAt: new Date(now - 15000),
      completedAt: new Date(now - 1000),
      expiresAt: new Date(now + 10000),
      gameState: {
        round: 7,
        hits: 7,
        misses: 0,
        phase: 'finished',
      },
      events,
      ...overrides,
    };
  }

  await test('Valid pending decision', async () => {
    const doc = validDecision();
    assert.equal(await doc.validate(), undefined);
  });

  await test('Missing user rejected', async () => {
    const doc = validDecision({ userId: null });
    await assert.rejects(doc.validate());
  });

  await test('Duplicate award status requires award ID', async () => {
    const doc = validDecision({
      status: 'prize_awarded',
      decision: 'PRIZE_AWARDED',
      decidedAt: new Date(),
      prizeAwardId: null,
    });
    await assert.rejects(doc.validate());
  });

  await test('Pending review cannot contain award', async () => {
    const doc = validDecision({
      status: 'pending_review',
      decision: 'PRIZE_AWARDED',
      decidedAt: new Date(),
      prizeAwardId: new mongoose.Types.ObjectId(),
    });
    await assert.rejects(doc.validate());
  });

  await test('Approval requires administrator details', async () => {
    const doc = validDecision({
      status: 'approved',
      reviewedByAdminId: null,
      reviewedAt: null,
    });
    await assert.rejects(doc.validate());
  });

  await test('Valid administrator approval', async () => {
    const doc = validDecision({
      status: 'approved',
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    });
    assert.equal(await doc.validate(), undefined);
  });

  await test('Valid Monkey passes consistency checks', async () => {
    const result = assessPrizeRisk(validMonkeySession());
    assert.equal(result.reviewRequired, false);
  });

  await test('Manipulated Monkey score held', async () => {
    const result = assessPrizeRisk(
      validMonkeySession({ score: 20 })
    );
    assert.equal(result.reviewRequired, true);
    assert.ok(
      result.riskReasons.includes('MONKEY_SCORE_MISMATCH')
    );
  });

  await test('Missing gameplay state held', async () => {
    const result = assessPrizeRisk(
      validMonkeySession({ gameState: null })
    );
    assert.equal(result.reviewRequired, true);
  });

  await test('Invalid session timing held', async () => {
    const result = assessPrizeRisk(
      validMonkeySession({
        completedAt: new Date(now + 20000),
      })
    );
    assert.equal(result.reviewRequired, true);
    assert.ok(
      result.riskReasons.includes('INVALID_SESSION_TIMING')
    );
  });

  await test('Invalid game rejected for review', async () => {
    const result = assessPrizeRisk(
      validMonkeySession({ gameId: 'unknown-game' })
    );
    assert.equal(result.reviewRequired, true);
  });

  console.log(
    `\nRESULT: ${passed}/11 TESTS PASSED`
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
