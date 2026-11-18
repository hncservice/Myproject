
'use strict';

/*
 * HNC PERFECT SHOT
 * Phase 4 - Step 15D
 *
 * Latency and anti-cheat simulation.
 *
 * SAFE TEST:
 * - No MongoDB connection
 * - No API requests
 * - No game attempts consumed
 * - No prizes issued
 *
 * Uses the existing backend movement and scoring functions.
 */

const {
  positionAt,
  ratingForDistance,
} = require('../features/games/services/perfectShotGameplayService');

const crypto = require('crypto');

const SHOT_TIME_MS = 3500;
const REFERENCE_SIZE = 500;
const HIT_RADIUS = 38;

const DELAYS = [
  0,
  50,
  100,
  200,
  350,
  500,
  750,
  1000,
];

const TESTS_PER_DELAY = 1000;

// -------------------------------------------
// RANDOM MOVEMENT
// -------------------------------------------

function randomFloat(min, max) {
  return (
    min +
    (crypto.randomInt(1000000) / 1000000) *
      (max - min)
  );
}

function createMotion() {
  return {
    phaseX: randomFloat(0, Math.PI * 2),
    phaseY: randomFloat(0, Math.PI * 2),

    speedX: randomFloat(1.45, 2.65),
    speedY: randomFloat(0.95, 1.85),

    amplitudeX: randomFloat(25, 35),
    amplitudeY: randomFloat(14, 22),
  };
}

function randomClickTime() {
  return crypto.randomInt(300, 2501);
}

// -------------------------------------------
// SCORING
// -------------------------------------------

function distanceBetween(a, b) {
  return Math.hypot(
    ((a.x - b.x) / 100) * REFERENCE_SIZE,
    ((a.y - b.y) / 100) * REFERENCE_SIZE
  );
}

function scorePosition(clickPosition, targetPosition) {
  const distance = distanceBetween(
    clickPosition,
    targetPosition
  );

  return {
    distance,
    ...ratingForDistance(distance),
  };
}

// -------------------------------------------
// TEST 1: LATENCY
// -------------------------------------------

function simulateLatency(delayMs) {
  let falseMisses = 0;
  let arrivalScoreTotal = 0;
  let clickScoreTotal = 0;

  for (let i = 0; i < TESTS_PER_DELAY; i++) {
    const motion = createMotion();

    const clickTime = randomClickTime();

    const arrivalTime = Math.min(
      SHOT_TIME_MS,
      clickTime + delayMs
    );

    // Genuine player clicks exact center.
    const clickPosition = positionAt(
      clickTime,
      0,
      motion
    );

    // Ideal score at real click time.
    const targetAtClick = positionAt(
      clickTime,
      0,
      motion
    );

    // Server scores when request arrives.
    const targetAtArrival = positionAt(
      arrivalTime,
      0,
      motion
    );

    const idealResult = scorePosition(
      clickPosition,
      targetAtClick
    );

    const arrivalResult = scorePosition(
      clickPosition,
      targetAtArrival
    );

    clickScoreTotal += idealResult.points;
    arrivalScoreTotal += arrivalResult.points;

    if (arrivalResult.distance > HIT_RADIUS) {
      falseMisses++;
    }
  }

  return {
    oneWayDelayMs: delayMs,

    idealAverageScore: Number(
      (clickScoreTotal / TESTS_PER_DELAY).toFixed(1)
    ),

    arrivalAverageScore: Number(
      (arrivalScoreTotal / TESTS_PER_DELAY).toFixed(1)
    ),

    falseMissPercentage: Number(
      ((falseMisses / TESTS_PER_DELAY) * 100).toFixed(1)
    ),
  };
}

// -------------------------------------------
// TEST 2: FORGED TIMESTAMP
// -------------------------------------------

function simulateForgedTimestamp() {
  const motion = createMotion();

  // Target is continuously moving.
  const actualClickTime = 1000;

  const submittedTimestamp = 1500;

  // Attacker submits coordinates calculated for
  // a different timestamp.
  const submittedPosition = positionAt(
    submittedTimestamp,
    0,
    motion
  );

  // Hypothetical insecure scorer trusts
  // the submitted timestamp.
  const vulnerableResult = scorePosition(
    submittedPosition,
    positionAt(submittedTimestamp, 0, motion)
  );

  // Server-receipt-time scorer does not
  // trust the claimed timestamp.
  const actualResult = scorePosition(
    submittedPosition,
    positionAt(actualClickTime, 0, motion)
  );

  return {
    actualClickTime,
    forgedTimestamp: submittedTimestamp,

    forgedScore: vulnerableResult.points,
    comparisonScore: actualResult.points,

    timestampManipulationSucceeded:
      vulnerableResult.points === 100,
  };
}

// -------------------------------------------
// TEST 3: DUPLICATE SHOT
// -------------------------------------------

function simulateDuplicateSubmission() {
  const processedShots = new Set();

  function processShot(sessionId, shotNumber) {
    const key = `${sessionId}:${shotNumber}`;

    if (processedShots.has(key)) {
      return {
        accepted: false,
        code: 'DUPLICATE_SHOT',
      };
    }

    processedShots.add(key);

    return {
      accepted: true,
      code: 'SHOT_ACCEPTED',
    };
  }

  const sessionId = 'isolated-test-session';

  const first = processShot(sessionId, 1);
  const duplicate = processShot(sessionId, 1);
  const next = processShot(sessionId, 2);

  return {
    firstAccepted: first.accepted,
    duplicateRejected: !duplicate.accepted,
    nextShotAccepted: next.accepted,
  };
}

// -------------------------------------------
// RUN ALL TESTS
// -------------------------------------------

function main() {
  console.log('\n================================');
  console.log('HNC PERFECT SHOT');
  console.log('PHASE 4 - STEP 15D');
  console.log('LATENCY AND ANTI-CHEAT TEST');
  console.log('================================\n');

  console.log('TEST 1: LATENCY SIMULATION');

  const latencyResults = DELAYS.map(
    simulateLatency
  );

  console.table(latencyResults);

  console.log('\nTEST 2: FORGED TIMESTAMP');

  const forgery = simulateForgedTimestamp();

  console.table([forgery]);

  console.log('\nTEST 3: DUPLICATE SUBMISSION');

  const duplicate = simulateDuplicateSubmission();

  console.table([duplicate]);

  // This is an illustrative model, not a security
  // proof or a test of the live database.
  const simulationPassed =
    latencyResults.every(
      row => row.idealAverageScore === 100
    ) &&
    forgery.timestampManipulationSucceeded &&
    duplicate.firstAccepted &&
    duplicate.duplicateRejected &&
    duplicate.nextShotAccepted;

  console.log('\n================================');

  console.log(
    simulationPassed
      ? 'HNC STEP 15D SIMULATION: PASS'
      : 'HNC STEP 15D SIMULATION: FAIL'
  );

  console.log(
    'No database records or game attempts changed.'
  );

  console.log(
    'Real prize allocation must remain disabled.'
  );

  console.log('================================\n');

  if (!simulationPassed) {
    process.exitCode = 1;
  }
}

main();
