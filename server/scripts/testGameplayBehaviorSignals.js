
'use strict';

const assert = require('node:assert/strict');

const {
  analyzeGameplayBehavior,
} = require('../features/fraud-monitoring/services/gameplayBehaviorSignalsService');

// =====================================================
// TEST CONFIGURATION
// =====================================================

const EXPECTED_TESTS = 10;

let passed = 0;

// =====================================================
// TEST RUNNER
// =====================================================

function test(label, action) {
  action();

  passed++;

  console.log(`PASS ${passed}: ${label}`);
}

// =====================================================
// MONKEY GAME TEST FIXTURE
// =====================================================

function monkey(intervals) {
  let time = Date.parse('2026-01-01T00:00:00Z');

  const times = [time];

  for (const interval of intervals) {
    time += interval;
    times.push(time);
  }

  return {
    gameId: 'monkey',

    events: times.map((timestamp, index) => ({
      type: 'tap',
      round: index + 1,
      success: true,
      serverAt: new Date(timestamp),
    })),
  };
}

// =====================================================
// TEST 1: NORMAL GAMEPLAY
// =====================================================

test('Ordinary varied intervals are not flagged', () => {
  const result = analyzeGameplayBehavior(
    monkey([1100, 1600, 1250, 1950, 1450, 1800])
  );

  assert.deepEqual(result.signals, []);

  assert.equal(result.reviewSuggested, false);
  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// TEST 2: UNUSUALLY RAPID TAPS
// =====================================================

test('Very rapid taps are flagged for review', () => {
  const result = analyzeGameplayBehavior(
    monkey([1200, 45, 1800, 1400])
  );

  assert.ok(
    result.signals.includes('UNUSUALLY_RAPID_TAPS')
  );

  assert.equal(result.reviewSuggested, true);
  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// TEST 3: HIGHLY REGULAR TAP CADENCE
// =====================================================

test('Highly regular cadence is flagged', () => {
  const result = analyzeGameplayBehavior(
    monkey([1000, 1000, 1000, 1000, 1000, 1000])
  );

  assert.ok(
    result.signals.includes(
      'HIGHLY_REGULAR_TAP_CADENCE'
    )
  );

  assert.equal(result.reviewSuggested, true);
});

// =====================================================
// TEST 4: INSUFFICIENT CADENCE DATA
// =====================================================

test('Few events do not trigger cadence flag', () => {
  const result = analyzeGameplayBehavior(
    monkey([1000, 1000])
  );

  assert.ok(
    !result.signals.includes(
      'HIGHLY_REGULAR_TAP_CADENCE'
    )
  );
});

// =====================================================
// TEST 5: INVALID TIMESTAMPS
// =====================================================

test('Invalid timestamps are identified', () => {
  const game = monkey([1000, 1200]);

  game.events[1].serverAt = 'invalid';

  const result = analyzeGameplayBehavior(game);

  assert.ok(
    result.signals.includes(
      'BEHAVIOR_TIMESTAMPS_INVALID'
    )
  );

  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// TEST 6: OUT-OF-ORDER EVENTS
// =====================================================

test('Out-of-order events are identified', () => {
  const result = analyzeGameplayBehavior(
    monkey([1000, -500, 1500])
  );

  assert.ok(
    result.signals.includes(
      'BEHAVIOR_EVENT_ORDER_INVALID'
    )
  );
});

// =====================================================
// TEST 7: PERFECT SHOT UNAFFECTED
// =====================================================

test('Other games remain unaffected', () => {
  const result = analyzeGameplayBehavior({
    gameId: 'perfect-shot',
    events: [],
  });

  assert.deepEqual(result.signals, []);

  assert.equal(result.reviewSuggested, false);
  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// TEST 8: ADVISORY-ONLY BEHAVIOR
// =====================================================

test('Behavior signals cannot enforce decisions', () => {
  const result = analyzeGameplayBehavior(
    monkey([1000, 1000, 1000, 1000, 1000, 1000])
  );

  assert.equal(result.enforcementAllowed, false);
  assert.equal(result.reviewSuggested, true);

  assert.ok(
    result.signals.includes(
      'HIGHLY_REGULAR_TAP_CADENCE'
    )
  );
});

// =====================================================
// TEST 9: BELOW MINIMUM ROUND GAP
// =====================================================

test('Consecutive rounds below 540 ms are flagged', () => {
  const result = analyzeGameplayBehavior(
    monkey([500, 1200, 1600])
  );

  assert.ok(
    result.signals.includes(
      'BELOW_MINIMUM_ROUND_GAP'
    )
  );

  assert.equal(result.reviewSuggested, true);
  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// TEST 10: VALID ROUND GAP
// =====================================================

test('Consecutive rounds above 540 ms are accepted', () => {
  const result = analyzeGameplayBehavior(
    monkey([800, 1200, 1700, 900])
  );

  assert.ok(
    !result.signals.includes(
      'BELOW_MINIMUM_ROUND_GAP'
    )
  );

  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// FINAL TEST SUMMARY
// =====================================================

assert.equal(
  passed,
  EXPECTED_TESTS,
  `Expected ${EXPECTED_TESTS} tests, but completed ${passed}`
);

console.log(
  `\nRESULT: ${passed}/${EXPECTED_TESTS} TESTS PASSED`
);
