'use strict';
// Standalone, read-only simulation. No MongoDB, API calls, or game attempts.
const assert = require('node:assert/strict');
const { randomInt } = require('node:crypto');
const REFERENCE_SIZE = 500;
const THRESHOLD = { perfect: 11, great: 23, hit: 38 };
const LATENCIES_MS = [0, 50, 100, 200, 350, 500, 750, 1000];
const SAMPLE_COUNT = 2000;
function randomBetween(min, max) {
  return min + (randomInt(1000000) / 1000000) * (max - min);
}
function randomMotion() {
  return {
    phaseX: randomBetween(0, Math.PI * 2),
    phaseY: randomBetween(0, Math.PI * 2),
    speedX: randomBetween(1.45, 2.65),
    speedY: randomBetween(0.95, 1.85),
    amplitudeX: randomBetween(25, 35),
    amplitudeY: randomBetween(14, 22),
  };
}
function positionAt(ms, m) {
  const t = Math.max(0, ms) / 1000;
  return {
    x: 50 + Math.sin(t * m.speedX + m.phaseX) * m.amplitudeX,
    y: 45 + Math.sin(t * m.speedY + m.phaseY) * m.amplitudeY,
  };
}
function distance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y) * REFERENCE_SIZE / 100; }
function points(d) { return d <= THRESHOLD.perfect ? 100 : d <= THRESHOLD.great ? 70 : d <= THRESHOLD.hit ? 40 : 0; }
function simulate(latency) {
  let hit=0,perfect=0,total=0,missedCenter=0,maxDrift=0;
  for (let i=0;i<SAMPLE_COUNT;i++) {
    const motion=randomMotion();
    // Click occurs with adequate time left even after transit.
    const clickAt=randomBetween(150,Math.max(151,3400-latency));
    const clickedCenter=positionAt(clickAt,motion);
    const arrivalPosition=positionAt(clickAt+latency,motion);
    const drift=distance(clickedCenter,arrivalPosition);
    const score=points(drift);
    hit+=Number(score>0); perfect+=Number(score===100); total+=score;
    missedCenter+=Number(score===0);
    maxDrift=Math.max(maxDrift,drift);
  }
  return {
    oneWayDelayMs: latency,
    exactCenterHitsScoredPct: +(100*hit/SAMPLE_COUNT).toFixed(1),
    perfectScoredPct: +(100*perfect/SAMPLE_COUNT).toFixed(1),
    falseMissPct: +(100*missedCenter/SAMPLE_COUNT).toFixed(1),
    meanScore: +(total/SAMPLE_COUNT).toFixed(1),
    maxPositionDriftPx: +maxDrift.toFixed(1),
  };
}
assert.equal(points(distance(positionAt(1000, {speedX:2,speedY:1,phaseX:0,phaseY:0,amplitudeX:30,amplitudeY:20}),positionAt(1000, {speedX:2,speedY:1,phaseX:0,phaseY:0,amplitudeX:30,amplitudeY:20}))),100);
const rows=LATENCIES_MS.map(simulate);
console.log('PERFECT SHOT – ARRIVAL-TIME SCORING SIMULATION');
console.log('Assumption: every user clicked the EXACT target center at click time.');
console.log('All scores use server-position at arrival time (insecure compensation OFF).');
console.table(rows);
console.log('This is a mathematical simulation, not proof of production security or observed network behavior.');
