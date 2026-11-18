'use strict';
// Bounded pure-function microbenchmark, not an HTTP or campaign load test.
const assert = require('node:assert/strict');
const load = require('./helpers/loadIsolatedService.cjs');
const config = require('./helpers/loadGameRegistry.cjs')({ GAME_CAMPAIGN_ID: 'synthetic-benchmark-only' }).config;
const { assessPrizeRisk } = load('features/fraud-monitoring/services/prizeFraudAssessmentService.js', {
  '../../../config/gameConfig': config,
});
const base = Date.parse('2026-10-20T10:00:00.000Z');
const valid = {
  gameId: 'monkey', status: 'completed', outcome: 'qualified', score: 7,
  startedAt: new Date(base).toISOString(), completedAt: new Date(base + 30000).toISOString(), expiresAt: new Date(base + 120000).toISOString(),
  gameState: { phase: 'finished', revision: 20, round: 9, hits: 7, misses: 2 },
  events: Array.from({ length: 7 }, (_, index) => ({ type: 'tap', round: index + 1, success: true, serverAt: new Date(base + (index + 1) * 3000).toISOString() })),
};
const invalid = { ...valid, score: 99 };
const fixtures = [valid, invalid];
const beforeInput = JSON.stringify(fixtures);
assert.equal(assessPrizeRisk(valid).reviewRequired, false);
assert.equal(assessPrizeRisk(invalid).reviewRequired, true);
const warmup = 500;
const iterations = 10000;
for (let index = 0; index < warmup; index++) assessPrizeRisk(fixtures[index % 2]);
const samples = [];
let errors = 0;
const cpuStart = process.cpuUsage();
const heapStart = process.memoryUsage().heapUsed;
const elapsedStart = process.hrtime.bigint();
for (let index = 0; index < iterations; index++) {
  const started = process.hrtime.bigint();
  const result = assessPrizeRisk(fixtures[index % 2]);
  samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  if (result.reviewRequired !== Boolean(index % 2) || result.assessmentVersion !== 2) errors++;
}
const elapsedMs = Number(process.hrtime.bigint() - elapsedStart) / 1e6;
const cpu = process.cpuUsage(cpuStart);
const heapDeltaBytes = process.memoryUsage().heapUsed - heapStart;
samples.sort((a, b) => a - b);
const percentile = value => samples[Math.ceil(samples.length * value) - 1];
assert.equal(errors, 0);
assert.equal(JSON.stringify(fixtures), beforeInput, 'Benchmark must not mutate synthetic inputs');
console.log('__OFFLINE_BENCHMARK__' + JSON.stringify({
  node: process.version, platform: process.platform, architecture: process.arch,
  workload: 'one valid and one score-manipulated synthetic Monkey session, alternating deterministically; seven events per session',
  warmup, iterations, errors, elapsedMs, p50Ms: percentile(0.50), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
  serialIterationsPerSecond: iterations / (elapsedMs / 1000), cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000, heapDeltaBytes,
  limitations: 'Single-process synchronous pure-function microbenchmark with VM overhead; no HTTP, DB, concurrency, email, allocation, end-to-end throughput, event-loop-delay or campaign capacity measurement. Heap delta includes allocations/GC noise.',
}));
