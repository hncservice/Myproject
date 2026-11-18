
'use strict';

const assert = require('node:assert/strict');

const {
  analyzeGameplayBehavior,
} = require('../features/fraud-monitoring/services/gameplayBehaviorSignalsService');

const EXPECTED_TESTS = 10;
const BASE_TIME = Date.parse('2026-01-01T00:00:00Z');

let passed = 0;

function test(label, action) {
  action();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

// Build an ordered sequence of server-recorded taps.
// Each interval represents elapsed time between
// accepted tap events, not client reaction time.
function monkey(intervals, rounds = null) {
  let timestamp = BASE_TIME;
  const times = [timestamp];

  for (const interval of intervals) {
    timestamp += interval;
    times.push(timestamp);
  }

  return {
    gameId: 'monkey',
    events: times.map((time, index) => ({
      type: 'tap',
      round: rounds ? rounds[index] : index + 1,
      success: true,
      serverAt: new Date(time),
    })),
  };
}

function signals(game) {
  return analyzeGameplayBehavior(game).signals;
}

// =====================================================
// TEST 1: VARIABLE HUMAN-LIKE TIMING
// =====================================================

test('Variable response intervals are not flagged', () => {
  const result = analyzeGameplayBehavior(
    monkey([950, 1450, 1120, 1780, 1280, 1600])
  );

  assert.deepEqual(result.signals, []);
  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// TEST 2: SLOW NETWORK RESPONSES
// =====================================================

test('Network delays do not trigger rapid-tap warnings', () => {
  const result = signals(
    monkey([1400, 2600, 1800, 3100, 1500, 2300])
  );

  assert.ok(!result.includes('UNUSUALLY_RAPID_TAPS'));
  assert.ok(!result.includes('BELOW_MINIMUM_ROUND_GAP'));
});

// =====================================================
// TEST 3: MISSED ROUNDS
// =====================================================

test('Skipped round numbers do not imply rapid tapping', () => {
  const result = signals(
    monkey(
      [3100, 1200, 3400, 1700],
      [1, 3, 4, 6, 7]
    )
  );

  assert.ok(!result.includes('BELOW_MINIMUM_ROUND_GAP'));
});

// =====================================================
// TEST 4: SKIPPED ROUND WITH SHORT GAP
// =====================================================

test('Nonconsecutive rounds bypass round-gap heuristic', () => {
  const result = signals(
    monkey([400, 1300], [1, 3, 5])
  );

  assert.ok(!result.includes('BELOW_MINIMUM_ROUND_GAP'));

  // This check confirms classifier behavior,
  // not that the timing represents valid gameplay.
});

// =====================================================
// TEST 5: LEGITIMATE FAST RESPONSE
// =====================================================

test('Consecutive taps above theoretical minimum pass', () => {
  const result = signals(
    monkey([560, 720, 890, 640])
  );

  assert.ok(!result.includes('BELOW_MINIMUM_ROUND_GAP'));
  assert.ok(!result.includes('UNUSUALLY_RAPID_TAPS'));
});

// =====================================================
// TEST 6: IMPOSSIBLE ROUND GAP
// =====================================================

test('Consecutive taps below minimum are flagged', () => {
  const result = signals(
    monkey([520, 720, 1150])
  );

  assert.ok(result.includes('BELOW_MINIMUM_ROUND_GAP'));
});

// =====================================================
// TEST 7: REGULAR CADENCE
// =====================================================

test('Mechanically regular intervals suggest review', () => {
  const result = analyzeGameplayBehavior(
    monkey([1200, 1200, 1200, 1200, 1200, 1200])
  );

  assert.ok(
    result.signals.includes('HIGHLY_REGULAR_TAP_CADENCE')
  );

  assert.equal(result.reviewSuggested, true);
  assert.equal(result.enforcementAllowed, false);
});

// =====================================================
// TEST 8: NETWORK JITTER
// =====================================================

test('Variable network jitter does not imply regular cadence', () => {
  const result = signals(
    monkey([800, 2100, 1100, 3000, 920, 1750])
  );

  assert.ok(!result.includes('HIGHLY_REGULAR_TAP_CADENCE'));
});

// =====================================================
// TEST 9: TOO LITTLE EVIDENCE
// =====================================================

test('Two taps do not trigger cadence classification', () => {
  const result = signals(monkey([1100]));

  assert.ok(!result.includes('HIGHLY_REGULAR_TAP_CADENCE'));
});

// =====================================================
// TEST 10: OBSERVATIONAL ONLY
// =====================================================

test('Suspicious timing never enables enforcement', () => {
  const result = analyzeGameplayBehavior(
    monkey([80, 80, 80, 80, 80, 80])
  );

  assert.equal(result.reviewSuggested, true);
  assert.equal(result.enforcementAllowed, false);

  assert.ok(
    result.signals.includes('UNUSUALLY_RAPID_TAPS')
  );

  assert.ok(
    result.signals.includes('BELOW_MINIMUM_ROUND_GAP')
  );
});

// =====================================================
// FINAL RESULT
// =====================================================

assert.equal(
  passed,
  EXPECTED_TESTS,
  'Unexpected number of behavioral tests'
);

console.log(
  `\nRESULT: ${passed}/${EXPECTED_TESTS} TESTS PASSED`
);
