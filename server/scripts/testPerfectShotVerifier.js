
'use strict';

const assert = require('node:assert/strict');

const {
  positionAt,
  ratingForDistance,
} = require('../features/games/services/perfectShotGameplayService');

const SETTINGS = {
  shotDurationMs: 3500,
  minimumReactionMs: 90,
  maxClaimedLatencyMs: 950,
  referenceSize: 500,
};

const motion = {
  phaseX: 1.2,
  phaseY: 0.7,
  speedX: 2.1,
  speedY: 1.4,
  amplitudeX: 30,
  amplitudeY: 20,
};

const sessionId = 'isolated-verifier-session';
const shotStartedMs = 100000;
const processed = new Set();

function validateShot(input) {
  const {
    shot,
    x,
    y,
    shotAt,
    receivedAt,
  } = input;

  if (
    !Number.isInteger(shot) ||
    shot < 1 ||
    shot > 5 ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 100 ||
    y < 0 ||
    y > 100 ||
    !Number.isFinite(shotAt) ||
    !Number.isFinite(receivedAt)
  ) {
    return { accepted: false, code: 'INVALID_INPUT' };
  }

  const elapsed = shotAt - shotStartedMs;
  const claimedLatency = receivedAt - shotAt;

  if (
    elapsed < SETTINGS.minimumReactionMs ||
    elapsed >= SETTINGS.shotDurationMs
  ) {
    return { accepted: false, code: 'INVALID_SHOT_TIME' };
  }

  if (
    claimedLatency < 0 ||
    claimedLatency > SETTINGS.maxClaimedLatencyMs
  ) {
    return { accepted: false, code: 'INVALID_LATENCY' };
  }

  const key = `${sessionId}:${shot}`;

  if (processed.has(key)) {
    return { accepted: false, code: 'DUPLICATE_SHOT' };
  }

  const target = positionAt(elapsed, shot - 1, motion);

  const distance = Math.hypot(
    (x - target.x) * SETTINGS.referenceSize / 100,
    (y - target.y) * SETTINGS.referenceSize / 100
  );

  const rating = ratingForDistance(distance);

  processed.add(key);

  return {
    accepted: true,
    code: 'SHOT_ACCEPTED',
    points: rating.points,
    category: rating.category,
    distance: Number(distance.toFixed(2)),
    claimedLatency,
    target,
  };
}

function test(name, fn) {
  try {
    fn();
    console.log('PASS:', name);
  } catch (error) {
    console.error('FAIL:', name, error.message);
    process.exitCode = 1;
  }
}

console.log('\nHNC PERFECT SHOT – STEP 15E\n');

test('Legitimate center click', () => {
  const clickAt = shotStartedMs + 1100;
  const target = positionAt(1100, 0, motion);

  const result = validateShot({
    shot: 1,
    x: target.x,
    y: target.y,
    shotAt: clickAt,
    receivedAt: clickAt + 650,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.points, 100);
});

test('Duplicate shot rejected', () => {
  const result = validateShot({
    shot: 1,
    x: 50,
    y: 50,
    shotAt: shotStartedMs + 1200,
    receivedAt: shotStartedMs + 1800,
  });

  assert.equal(result.code, 'DUPLICATE_SHOT');
});

test('Excessive claimed latency rejected', () => {
  const result = validateShot({
    shot: 2,
    x: 50,
    y: 50,
    shotAt: shotStartedMs + 1000,
    receivedAt: shotStartedMs + 2200,
  });

  assert.equal(result.code, 'INVALID_LATENCY');
});

test('Early shot rejected', () => {
  const result = validateShot({
    shot: 3,
    x: 50,
    y: 50,
    shotAt: shotStartedMs + 30,
    receivedAt: shotStartedMs + 500,
  });

  assert.equal(result.code, 'INVALID_SHOT_TIME');
});

test('Invalid coordinates rejected', () => {
  const result = validateShot({
    shot: 4,
    x: 150,
    y: 50,
    shotAt: shotStartedMs + 1100,
    receivedAt: shotStartedMs + 1600,
  });

  assert.equal(result.code, 'INVALID_INPUT');
});

test('Forged timestamp remains exploitable', () => {
  const forgedElapsed = 1700;
  const forgedAt = shotStartedMs + forgedElapsed;

  const target = positionAt(forgedElapsed, 4, motion);

  // A scripted client supplies both an advantageous
  // timestamp and the corresponding target coordinates.
  const result = validateShot({
    shot: 5,
    x: target.x,
    y: target.y,
    shotAt: forgedAt,
    receivedAt: forgedAt + 500,
  });

  // This demonstrates the limitation of bounded
  // client timestamps. The verifier cannot prove
  // that a human actually clicked at this time.
  assert.equal(result.accepted, true);
  assert.equal(result.points, 100);

  console.log(
    '  WARNING: Forged click passed timing constraints.'
  );
});

console.log('\nSTEP 15E COMPLETE');

if (process.exitCode) {
  console.log('VERIFIER TEST: FAIL');
} else {
  console.log('VERIFIER TEST: PASS');
}

console.log(
  'This is an in-memory test, not production anti-cheat.'
);
console.log(
  'Real prize allocation remains disabled.'
);
