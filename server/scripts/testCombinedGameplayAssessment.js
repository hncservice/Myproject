
'use strict';

const assert = require('node:assert/strict');

const {
  assessPrizeRisk,
} = require('../features/fraud-monitoring/services/prizeFraudAssessmentService');

const {
  analyzeGameplayBehavior,
} = require('../features/fraud-monitoring/services/gameplayBehaviorSignalsService');

const {
  assessGameplayCombined,
} = require('../features/fraud-monitoring/services/combinedGameplayAssessmentService');

const {
  GAMES,
} = require('../config/gameConfig');

let passed = 0;
const EXPECTED_TESTS = 7;

function test(label, action) {
  action();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

function makeMonkey(intervals) {
  const start = Date.parse('2026-01-01T10:00:00Z');

  let time = start + 3000;

  const times = [time];

  for (const interval of intervals) {
    time += interval;
    times.push(time);
  }

  const events = times.map((timestamp, index) => ({
    type: 'tap',
    round: index + 1,
    success: true,
    serverAt: new Date(timestamp),
  }));

  return {
    gameId: 'monkey',
    status: 'completed',
    outcome: 'qualified',
    score: events.length,

    startedAt: new Date(start),
    completedAt: new Date(time + 1000),
    expiresAt: new Date(
      start + GAMES.monkey.sessionTtlMs
    ),

    gameState: {
      phase: 'finished',
      round: events.length,
      hits: events.length,
      misses: 0,
    },

    events,
  };
}

test('Normal gameplay keeps assessments separate', () => {
  const game = makeMonkey([
    1100, 1600, 1250, 1950, 1450, 1800,
  ]);

  const result = assessGameplayCombined(game);

  assert.equal(result.integrity.reviewRequired, false);
  assert.equal(result.behavior.reviewSuggested, false);
  assert.equal(result.preliminaryReviewRequired, false);
});

test('Behavior warnings do not change integrity result', () => {
  const game = makeMonkey([
    1000, 1000, 1000, 1000, 1000, 1000,
  ]);

  const result = assessGameplayCombined(game);
  const original = assessPrizeRisk(game);

  assert.equal(
    result.integrity.reviewRequired,
    original.reviewRequired
  );

  assert.equal(result.behavior.reviewSuggested, true);

  assert.equal(
    result.preliminaryReviewRequired,
    original.reviewRequired
  );

  assert.equal(result.behaviorAffectsPrizeDecision, false);
});

test('Impossible intervals remain advisory only', () => {
  const game = makeMonkey([
    500, 1200, 1600, 1800, 1400, 1700,
  ]);

  const result = assessGameplayCombined(game);

  assert.ok(
    result.behavior.signals.includes(
      'BELOW_MINIMUM_ROUND_GAP'
    )
  );

  assert.equal(result.behavior.enforcementAllowed, false);
});

test('Integrity anomalies retain review requirement', () => {
  const game = makeMonkey([
    1100, 1600, 1250, 1950, 1450, 1800,
  ]);

  game.score = 99;

  const result = assessGameplayCombined(game);

  assert.equal(result.integrity.reviewRequired, true);
  assert.equal(result.preliminaryReviewRequired, true);
  assert.ok(
    result.integrity.riskReasons.includes(
      'MONKEY_SCORE_MISMATCH'
    )
  );
});

test('Combined results match standalone services', () => {
  const game = makeMonkey([
    1200, 1800, 1400, 1700, 1100, 1500,
  ]);

  const integrity = assessPrizeRisk(game);
  const behavior = analyzeGameplayBehavior(game);
  const combined = assessGameplayCombined(game);

  assert.deepEqual(
    combined.integrity.riskReasons,
    integrity.riskReasons
  );

  assert.deepEqual(
    combined.behavior.signals,
    behavior.signals
  );
});

test('Combined assessment does not modify game input', () => {
  const game = makeMonkey([
    1100, 1600, 1250, 1950, 1450, 1800,
  ]);

  const before = JSON.stringify(game);

  assessGameplayCombined(game);

  assert.equal(JSON.stringify(game), before);
});

test('Behavioral analysis never enables enforcement', () => {
  const game = makeMonkey([
    1000, 1000, 1000, 1000, 1000, 1000,
  ]);

  const result = assessGameplayCombined(game);

  assert.equal(result.readOnly, true);
  assert.equal(result.behavior.enforcementAllowed, false);
  assert.equal(result.behaviorAffectsPrizeDecision, false);
});

assert.equal(passed, EXPECTED_TESTS);

console.log(
  `\nRESULT: ${passed}/${EXPECTED_TESTS} TESTS PASSED`
);
