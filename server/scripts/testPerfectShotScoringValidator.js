
'use strict';

const assert = require('node:assert/strict');

const {
  validateAndScoreShot,
} = require('../features/games/services/perfectShotScoringValidator');

const {
  positionAt,
  ratingForDistance,
} = require('../features/games/services/perfectShotGameplayService');

const motion = {
  phaseX: 1.2,
  phaseY: 0.7,
  speedX: 2.1,
  speedY: 1.4,
  amplitudeX: 30,
  amplitudeY: 20,
};

const started = 100000;
const expires = started + 3500;

function sample(overrides = {}) {
  const elapsed = 1100;
  const target = positionAt(elapsed, 0, motion);

  return {
    shot: 1,
    x: target.x,
    y: target.y,
    shotAt: started + elapsed,
    receivedAt: started + elapsed + 400,
    shotStartedAt: started,
    shotExpiresAt: expires,
    motion,
    positionAt,
    ratingForDistance,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS:', name);
  } catch (error) {
    failed++;
    console.log('FAIL:', name, error.message);
  }
}

console.log('\nHNC STEP 15F - SCORING VALIDATOR\n');

test('Valid center click earns 100 points', () => {
  const result = validateAndScoreShot(sample());

  assert.equal(result.accepted, true);
  assert.equal(result.score.points, 100);
  assert.equal(result.prizeEligible, false);
});

test('Invalid coordinates rejected', () => {
  const result = validateAndScoreShot(
    sample({ x: 150 })
  );

  assert.equal(result.accepted, false);
  assert.equal(result.code, 'INVALID_INPUT');
});

test('Excessive latency rejected', () => {
  const result = validateAndScoreShot(
    sample({ receivedAt: started + 2400 })
  );

  assert.equal(result.code, 'INVALID_LATENCY');
});

test('Too early click rejected', () => {
  const result = validateAndScoreShot(
    sample({ shotAt: started + 25 })
  );

  assert.equal(result.code, 'INVALID_SHOT_TIME');
});

test('High claimed latency flagged', () => {
  const result = validateAndScoreShot(
    sample({ receivedAt: started + 1900 })
  );

  assert.equal(result.accepted, true);
  assert.equal(result.risk.reviewRequired, true);

  assert.ok(
    result.risk.reasons.includes(
      'HIGH_CLAIMED_LATENCY'
    )
  );
});

test('Invalid motion rejected', () => {
  const result = validateAndScoreShot(
    sample({ motion: null })
  );

  assert.equal(result.code, 'INVALID_MOTION');
});

test('Forged timestamp vulnerability remains', () => {
  // A scripted client can choose an allowed time
  // and calculate the exact target coordinates.
  const elapsed = 1800;
  const target = positionAt(elapsed, 0, motion);

  const result = validateAndScoreShot(
    sample({
      shotAt: started + elapsed,
      receivedAt: started + elapsed + 400,
      x: target.x,
      y: target.y,
    })
  );

  assert.equal(result.accepted, true);
  assert.equal(result.score.points, 100);
  assert.equal(result.prizeEligible, false);

  console.log(
    '  WARNING: Browser timestamp can be forged.'
  );
});

test('Gameplay cannot directly issue prize', () => {
  const result = validateAndScoreShot(sample());

  assert.equal(result.prizeEligible, false);
});

console.log('\nRESULTS');
console.table({ passed, failed });

console.log(
  failed === 0
    ? 'HNC STEP 15F: PASS'
    : 'HNC STEP 15F: FAIL'
);

console.log(
  'No database records or attempts modified.'
);

console.log(
  'Prize allocation remains disabled.'
);

if (failed > 0) {
  process.exitCode = 1;
}
