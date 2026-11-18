'use strict';
// Preparation only. There is intentionally no driver, socket, environment read,
// listener, filesystem, application import, or switch that grants live execution.
const { validateIntegrationTarget } = require('../../infrastructure/testing/integrationTargetPolicy');
const { assertOfflineRuntime } = require('./offlineRuntime');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function record(value, keys) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('INVALID_HARNESS_CONFIG');
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || names.some(key => !keys.includes(key))) fail('INVALID_HARNESS_CONFIG');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('INVALID_HARNESS_CONFIG');
  }
}
function bounded(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_HARNESS_CONFIG');
  return value;
}
function validateHarnessConfig(input) {
  record(input, ['target', 'runId', 'connectionTimeoutMs', 'requestTimeoutMs', 'durationMs', 'maxConcurrency', 'maxCases']);
  const target = validateIntegrationTarget(input.target);
  const mongo = new URL(input.target.mongoUri), http = new URL(input.target.httpBaseUrl);
  // Stronger than the shared policy: no DNS, alternate IP spelling, credentials,
  // encoded path or implicit port in this preparation configuration.
  if (mongo.hostname !== '127.0.0.1' || http.hostname !== '127.0.0.1' || mongo.username || mongo.password ||
      mongo.port === http.port || mongo.port.length === 0 || Number(mongo.port) < 1024 || Number(mongo.port) > 65535 ||
      input.target.httpBaseUrl !== http.origin ||
      input.target.mongoUri !== `mongodb://127.0.0.1:${mongo.port}/hnc_step15q_sandbox?replicaSet=${mongo.searchParams.get('replicaSet')}&authSource=hnc_step15q_sandbox`) fail('UNSAFE_HARNESS_TARGET');
  if (typeof input.runId !== 'string' || !/^[a-f0-9]{18}$/.test(input.runId)) fail('INVALID_HARNESS_CONFIG');
  const connectionTimeoutMs = bounded(input.connectionTimeoutMs, 1, 5000);
  const requestTimeoutMs = bounded(input.requestTimeoutMs, 1, 5000);
  const durationMs = bounded(input.durationMs, Math.max(connectionTimeoutMs, requestTimeoutMs), 300000);
  return freeze({ target, runId: input.runId, connectionTimeoutMs, requestTimeoutMs, durationMs,
    maxConcurrency: bounded(input.maxConcurrency, 1, 20), maxCases: bounded(input.maxCases, 1, 100),
    mongoPort: Number(mongo.port), replicaSet: mongo.searchParams.get('replicaSet'),
    connectionOptions: { dbName: 'hnc_step15q_sandbox', autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: connectionTimeoutMs, connectTimeoutMS: connectionTimeoutMs,
      socketTimeoutMS: requestTimeoutMs, maxPoolSize: 5 }, execution: 'offline-only' });
}
const SCENARIOS = freeze([
  { id: 'otp-issue', invariant: 'one replacement challenge and memory delivery' },
  { id: 'otp-verify', invariant: 'one consume; at most five comparisons' },
  { id: 'token-revoke', invariant: 'one version increment; no token revival' },
  { id: 'game-start', invariant: 'one active session; consumed attempts retained' },
  { id: 'game-complete', invariant: 'one terminal transition and validated score' },
  { id: 'prize-decision', invariant: 'one preliminary decision; no allocation' },
  { id: 'recovery', invariant: 'exclusive live lease; no reroll or allocation' },
  { id: 'qr-fence', invariant: 'one synthetic historical claim and inventory increment' },
  { id: 'campaign', invariant: 'one revision and audit; participation remains disabled' },
  { id: 'admin-write', invariant: 'revoked actor cannot commit; audit is atomic' },
]);
// Cooperative deadlines are not a security boundary for arbitrary callback code.
// The guarded child process supplies the hard wall-clock/CPU termination boundary.
async function withDeadline(task, { timeoutMs, signal, clock }) {
  assertOfflineRuntime();
  bounded(timeoutMs, 1, 300000);
  if (typeof task !== 'function' || !clock || typeof clock.setTimeout !== 'function' || typeof clock.clearTimeout !== 'function') fail('MISSING_ISOLATION_CONTROL');
  if (signal?.aborted) fail('HARNESS_CANCELLED');
  const controller = new AbortController();
  let timer, onAbort;
  const stop = new Promise((_, reject) => {
    const cancel = code => {
      // Settle before notifying callbacks so cancellation cannot win as success.
      reject(Object.assign(new Error(code), { code }));
      controller.abort();
    };
    onAbort = () => cancel('HARNESS_CANCELLED');
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = clock.setTimeout(() => cancel('HARNESS_TIMEOUT'), timeoutMs);
  });
  try { return await Promise.race([stop, Promise.resolve().then(() => {
    if (controller.signal.aborted) fail('HARNESS_CANCELLED');
    return task(controller.signal);
  })]); }
  finally { clock.clearTimeout(timer); signal?.removeEventListener('abort', onAbort); controller.abort(); }
}
async function runConcurrent(tasks, { maxConcurrency, timeoutMs, signal, clock }) {
  bounded(maxConcurrency, 1, 20);
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 100 ||
      tasks.some(task => typeof task !== 'function') || Object.keys(tasks).length !== tasks.length) fail('INVALID_CONCURRENCY_BATCH');
  return withDeadline(async batchSignal => {
    let next = 0, stopped = false;
    const results = new Array(tasks.length);
    const worker = async () => {
      while (!stopped && !batchSignal.aborted && next < tasks.length) {
        const index = next++;
        try { results[index] = await tasks[index](batchSignal); }
        catch { stopped = true; fail('HARNESS_TASK_FAILED'); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(maxConcurrency, tasks.length) }, worker));
    if (batchSignal.aborted) fail('HARNESS_CANCELLED');
    return results;
  }, { timeoutMs, signal, clock });
}
function createBarrier(parties) {
  bounded(parties, 1, 20);
  let arrivals = 0, release, reject, closed = false;
  const wait = new Promise((resolve, failWait) => { release = resolve; reject = failWait; });
  // An explicitly cancelled barrier may precede arrivals.
  wait.catch(() => {});
  return Object.freeze({
    arrive() {
      if (closed || arrivals >= parties) fail('INVALID_BARRIER_STATE');
      arrivals++;
      if (arrivals === parties) { closed = true; release(); }
      return wait;
    },
    cancel() { if (!closed) { closed = true; reject(Object.assign(new Error('HARNESS_CANCELLED'), { code: 'HARNESS_CANCELLED' })); } },
  });
}
function createOfflineHarness(input) {
  assertOfflineRuntime();
  const config = validateHarnessConfig(input);
  let terminated = false, sequence = 0, cases = 0, runClock = null, startedAt = null, lastNow = null;
  const fixtures = [], evidence = [];
  const running = new Set();
  const terminate = () => { terminated = true; for (const controller of running) controller.abort(); };
  const active = () => { if (terminated) fail('HARNESS_TERMINATED'); };
  const deny = () => fail('LIVE_INTEGRATION_NOT_AUTHORIZED');
  function assertTarget(kind, destination) {
    active();
    if (kind === 'mongo' && destination === `127.0.0.1:${config.mongoPort}/hnc_step15q_sandbox`) return true;
    if (kind === 'http' && destination === config.target.httpBaseUrl) return true;
    fail('HARNESS_EGRESS_DENIED');
  }
  const harness = Object.freeze({
    config, scenarios: SCENARIOS,
    // Target inspection grants no socket capability; live ports stay unavailable.
    assertTarget, connect: deny, listen: deny, request: deny, sendEmail: deny, deliverQr: deny,
    allocatePrize: deny, activateCampaign: deny, executeCleanup: deny,
    fixture(kind) {
      active();
      if (!['user', 'campaign', 'game-session'].includes(kind) || sequence >= 100) fail('INVALID_SYNTHETIC_FIXTURE');
      const id = config.runId + (++sequence).toString(16).padStart(6, '0');
      const user = fixtures.find(item => item.kind === 'user');
      const campaign = fixtures.find(item => item.kind === 'campaign');
      if (kind === 'game-session' && (!user || !campaign)) fail('MISSING_SYNTHETIC_DEPENDENCY');
      const data = kind === 'user' ? { _id: id, name: 'Synthetic harness user', email: `${id}@example.invalid`,
        passwordHash: 'OFFLINE_PLACEHOLDER_NOT_A_VALID_HASH', emailVerified: false, isActive: true, tokenVersion: 0 } :
        kind === 'campaign' ? { _id: id, campaignId: `synthetic-${id}`, name: 'Synthetic campaign', enabled: false,
          gameIds: ['monkey', 'perfect-shot'], startsAt: '2030-01-01T00:00:00.000Z', endsAt: '2030-01-02T00:00:00.000Z',
          eligibility: { verifiedEmailRequired: true, minAccountAgeHours: 0 },
          participation: { maxSessionsPerUser: 3, maxConcurrentSessions: 1, allowPriorWinners: false },
          prizeItemIds: [], revision: 1, lastRequestId: `synthetic-${id}`, lastFingerprint: '0'.repeat(64) } :
        { _id: id, userId: user.data._id, campaignId: campaign.data.campaignId, gameId: 'monkey', attemptNumber: 1,
          sessionTokenHash: 'OFFLINE_PLACEHOLDER_NOT_A_CREDENTIAL', status: 'active', score: 0,
          startedAt: '2030-01-01T00:00:00.000Z', expiresAt: '2030-01-01T00:01:00.000Z' };
      const fixture = freeze({ kind, runId: config.runId, data });
      fixtures.push(fixture);
      return fixture;
    },
    cleanupPlan(target, receipt) {
      active();
      record(target, ['databaseName', 'host', 'port', 'replicaSet']);
      if (target.databaseName !== 'hnc_step15q_sandbox' || target.host !== '127.0.0.1' || target.port !== config.mongoPort || target.replicaSet !== config.replicaSet) fail('UNSAFE_CLEANUP_TARGET');
      if (!Array.isArray(receipt) || receipt.length === 0 || receipt.length > 100 || new Set(receipt).size !== receipt.length || receipt.some(item => !fixtures.includes(item))) fail('UNSAFE_CLEANUP_RECEIPT');
      // No filters/options/collection names supplied by a caller; no drop/reset API.
      const collections = { user: 'users', campaign: 'campaigndefinitions', 'game-session': 'gamesessions' };
      return freeze({ executable: false, requiresSeparateAuthorization: true, databaseName: target.databaseName,
        records: receipt.map(item => ({ collection: collections[item.kind], id: item.data._id })) });
    },
    async runCase(id, task, { signal, clock } = {}) {
      active();
      if (!SCENARIOS.some(item => item.id === id) || cases >= config.maxCases) fail('INVALID_HARNESS_CASE');
      cases++;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      running.add(controller);
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) controller.abort();
      try {
        if (!clock || typeof clock.now !== 'function' || (runClock && runClock !== clock)) fail('MISSING_ISOLATION_CONTROL');
        const now = clock.now();
        if (!Number.isSafeInteger(now) || now < 0 || (lastNow !== null && now < lastNow)) fail('INVALID_HARNESS_CLOCK');
        runClock = clock; lastNow = now; startedAt ??= now;
        const remaining = config.durationMs - (now - startedAt);
        if (remaining <= 0) fail('HARNESS_TIMEOUT');
        await withDeadline(task, { timeoutMs: Math.min(config.requestTimeoutMs, remaining), signal: controller.signal, clock });
        active();
        evidence.push(freeze({ case: id, status: 'PASS' }));
        return true;
      } catch (error) {
        terminate();
        evidence.push(freeze({ case: id, status: 'FAIL', code: ['HARNESS_TIMEOUT', 'HARNESS_CANCELLED'].includes(error?.code) ? error.code : 'HARNESS_CASE_FAILED' }));
        return false;
      } finally { running.delete(controller); signal?.removeEventListener('abort', cancel); }
    },
    async runWave(id, tasks, { signal, clock } = {}) {
      active();
      if (!SCENARIOS.some(item => item.id === id) || !Array.isArray(tasks) || tasks.length < 1 ||
          tasks.length > config.maxCases - cases || Object.keys(tasks).length !== tasks.length ||
          tasks.some(task => typeof task !== 'function')) fail('INVALID_CONCURRENCY_BATCH');
      return runConcurrent(tasks.map(task => async batchSignal => {
        if (!await harness.runCase(id, task, { signal: batchSignal, clock })) fail('HARNESS_CASE_FAILED');
        return true;
      }), { maxConcurrency: config.maxConcurrency, timeoutMs: config.durationMs, signal, clock });
    },
    report() { return freeze({ runId: config.runId, mode: 'offline-only', liveExecutionAuthorized: false,
      terminated, passed: evidence.filter(item => item.status === 'PASS').length,
      failed: evidence.filter(item => item.status === 'FAIL').length, cases: evidence.slice() }); },
    terminate,
  });
  return harness;
}
module.exports = { validateHarnessConfig, createOfflineHarness, withDeadline, runConcurrent, createBarrier };
