'use strict';
const assert = require('node:assert/strict');
const load = require('./helpers/loadAuthSource.cjs');
const run = require('./helpers/runCases.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function runtimeGate(processPort = process, globalPort = globalThis) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../integration/offlineRuntime.js'), 'utf8');
  new vm.Script('(function(module,process,globalThis){' + source + '\n})').runInThisContext()(module, processPort, globalPort);
  return module.exports;
}
const policy = load('infrastructure/testing/integrationTargetPolicy.js', {});
const runtime = runtimeGate();
const api = load('tests/integration/offlineHarness.js', { '../../infrastructure/testing/integrationTargetPolicy': policy, './offlineRuntime': runtime });
const config = () => ({ target: { mongoUri: 'mongodb://127.0.0.1:27018/hnc_step15q_sandbox?replicaSet=hnc_isolated&authSource=hnc_step15q_sandbox',
  httpBaseUrl: 'http://127.0.0.1:5501', environment: 'integration-sandbox', emailAdapter: 'memory', allocationEnabled: false, campaignParticipationEnabled: false },
  runId: 'a'.repeat(18), connectionTimeoutMs: 100, requestTimeoutMs: 50, durationMs: 1000, maxConcurrency: 5, maxCases: 20 });
const harness = () => api.createOfflineHarness(config());
function clock() {
  let now = 0, sequence = 0;
  const timers = new Map();
  return { now: () => now, setTimeout(fn, ms) { const id = ++sequence; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); }, count: () => timers.size,
    advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } } };
}
const topology = () => ({ databaseName: 'hnc_step15q_sandbox', host: '127.0.0.1', port: 27018, replicaSet: 'hnc_isolated' });
const cases = [
  ['runtime requires installed guard and denied native capabilities', () => {
    runtime.assertOfflineRuntime();
    for (const [port, globals] of [[{}, globalThis], [process, {}], [{ permission: { has: () => true }, env: Object.freeze({}) }, globalThis],
      [{ permission: { has: () => false }, env: { MONGO_URI: 'synthetic' } }, globalThis]])
      assert.throws(() => runtimeGate(port, globals).assertOfflineRuntime(), { code: 'OFFLINE_HARNESS_GUARD_REQUIRED' });
  }],
  ['preparation module has only reviewed pure policy and runtime dependencies', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../integration/offlineHarness.js'), 'utf8');
    assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/g)].map(match => match[1]), ['../../infrastructure/testing/integrationTargetPolicy', './offlineRuntime']);
    assert.equal(/\b(?:fetch|import)\s*\(|process\.env|\.listen\s*\(/.test(source), false);
  }],
  ['missing configuration cannot inherit environment', () => { assert.throws(() => api.createOfflineHarness(), { code: 'INVALID_HARNESS_CONFIG' }); }],
  ['configuration is sanitized immutable and cannot grant execution', () => { const h = harness(); assert.equal(h.config.execution, 'offline-only'); assert.ok(Object.isFrozen(h.config.connectionOptions)); assert.equal(h.config.connectionOptions.autoIndex, false); assert.equal(h.config.connectionOptions.autoCreate, false); assert.equal(JSON.stringify(h.config).includes('mongodb:'), false); }],
  ['unknown configuration and prototype keys rejected', () => { for (const key of ['MONGO_URI', 'authorization', '__proto__', 'constructor', 'prototype']) { const c = config(); Object.defineProperty(c, key, { value: true, enumerable: true }); assert.throws(() => api.createOfflineHarness(c)); } }],
  ['accessors rejected before evaluation', () => { let reads = 0; const c = config(); Object.defineProperty(c, 'target', { get() { reads++; throw Error('secret'); }, enumerable: true }); assert.throws(() => api.createOfflineHarness(c)); assert.equal(reads, 0); }],
  ['malformed and incomplete objects rejected', () => { for (const c of [null, [], 'string', { ...config(), requestTimeoutMs: undefined }, Object.create(config())]) assert.throws(() => api.createOfflineHarness(c)); }],
  ['timeouts concurrency counts and run identifiers bounded', () => { for (const patch of [{ requestTimeoutMs: 0 }, { connectionTimeoutMs: 5001 }, { durationMs: 99 }, { durationMs: 300001 }, { maxConcurrency: 21 }, { maxCases: 101 }, { runId: 'customer@email.com' }]) assert.throws(() => api.createOfflineHarness({ ...config(), ...patch })); }],
  ['only pinned target descriptors pass preflight without granting connections', () => { const h = harness(); assert.equal(h.assertTarget('mongo', '127.0.0.1:27018/hnc_step15q_sandbox'), true); assert.equal(h.assertTarget('http', 'http://127.0.0.1:5501'), true); assert.throws(h.connect, { code: 'LIVE_INTEGRATION_NOT_AUTHORIZED' }); }],
  ['all live capabilities always denied', () => { const h = harness(); for (const name of ['connect', 'listen', 'request', 'sendEmail', 'deliverQr', 'allocatePrize', 'activateCampaign', 'executeCleanup']) assert.throws(() => h[name]({ authorized: true }), { code: 'LIVE_INTEGRATION_NOT_AUTHORIZED' }); }],
  ['external hosts redirect paths and wrong ports rejected', () => { const h = harness(); for (const [kind, target] of [['http', 'https://production.invalid'], ['http', 'http://127.0.0.1:5502'], ['http', 'http://127.0.0.1:5501/redirect'], ['mongo', '127.0.0.1:27018/test'], ['smtp', '127.0.0.1:25']]) assert.throws(() => h.assertTarget(kind, target), { code: 'HARNESS_EGRESS_DENIED' }); }],
  ['synthetic fixture relationships and disabled campaign retained', () => { const h = harness(), u = h.fixture('user'), c = h.fixture('campaign'), s = h.fixture('game-session'); assert.match(u.data.email, /@example.invalid$/); assert.equal(c.data.enabled, false); assert.equal(s.data.userId, u.data._id); assert.equal(s.data.campaignId, c.data.campaignId); assert.ok(Object.isFrozen(c.data.gameIds)); assert.notEqual(u.data._id, s.data._id); }],
  ['fixtures require scoped dependencies and reject arbitrary kinds', () => { const h = harness(); assert.throws(() => h.fixture('game-session'), { code: 'MISSING_SYNTHETIC_DEPENDENCY' }); assert.throws(() => h.fixture('prize')); }],
  ['fixture IDs separated between runs', () => { const a = harness(), b = api.createOfflineHarness({ ...config(), runId: 'b'.repeat(18) }); assert.notEqual(a.fixture('user').data._id, b.fixture('user').data._id); }],
  ['cleanup produces only non-executable exact receipt plan', () => { const h = harness(), u = h.fixture('user'); const plan = h.cleanupPlan(topology(), [u]); assert.equal(plan.executable, false); assert.equal(plan.requiresSeparateAuthorization, true); assert.deepEqual(plan.records, [{ collection: 'users', id: u.data._id }]); assert.ok(Object.isFrozen(plan.records)); }],
  ['cleanup rejects production names peers ports replica identity and overrides', () => { const h = harness(), u = h.fixture('user'); for (const patch of [{ databaseName: 'test' }, { databaseName: 'admin' }, { host: 'production.invalid' }, { port: 27017 }, { replicaSet: 'other' }, { query: {} }]) assert.throws(() => h.cleanupPlan({ ...topology(), ...patch }, [u])); }],
  ['cleanup rejects fabricated copied duplicate empty and foreign receipts', () => { const h = harness(), u = h.fixture('user'), other = harness().fixture('user'); for (const receipt of [[], [u, u], [{ ...u }], [other], [{ data: { _id: '$ne' } }]]) assert.throws(() => h.cleanupPlan(topology(), receipt), { code: 'UNSAFE_CLEANUP_RECEIPT' }); }],
  ['deadline success clears timer', async () => { const c = clock(); assert.equal(await api.withDeadline(async () => 7, { timeoutMs: 10, clock: c }), 7); assert.equal(c.count(), 0); }],
  ['deadline timeout aborts callback and clears timer', async () => { const c = clock(); let signal; const pending = api.withDeadline(s => { signal = s; return new Promise(() => {}); }, { timeoutMs: 10, clock: c }); await Promise.resolve(); c.advance(10); await assert.rejects(pending, { code: 'HARNESS_TIMEOUT' }); assert.equal(signal.aborted, true); assert.equal(c.count(), 0); }],
  ['external cancellation rejects and aborts callback', async () => { const c = clock(), control = new AbortController(); const pending = api.withDeadline(() => new Promise(() => {}), { timeoutMs: 10, clock: c, signal: control.signal }); control.abort(); await assert.rejects(pending, { code: 'HARNESS_CANCELLED' }); assert.equal(c.count(), 0); }],
  ['already cancelled work never begins', async () => { const control = new AbortController(); control.abort(); let calls = 0; await assert.rejects(api.withDeadline(() => calls++, { timeoutMs: 10, clock: clock(), signal: control.signal })); assert.equal(calls, 0); }],
  ['missing timer control cannot execute task', async () => { let calls = 0; await assert.rejects(api.withDeadline(() => calls++, { timeoutMs: 10 }), { code: 'MISSING_ISOLATION_CONTROL' }); assert.equal(calls, 0); }],
  ['barrier releases exactly the specified participants', async () => { const barrier = api.createBarrier(2); let released = false; const first = barrier.arrive().then(() => { released = true; }); await Promise.resolve(); assert.equal(released, false); await barrier.arrive(); await first; assert.equal(released, true); assert.throws(() => barrier.arrive()); }],
  ['cancelled barrier rejects blocked participants', async () => { const barrier = api.createBarrier(2); const first = barrier.arrive(); barrier.cancel(); await assert.rejects(first, { code: 'HARNESS_CANCELLED' }); }],
  ['concurrency bounded and results retain input order', async () => { let current = 0, peak = 0; const tasks = Array.from({ length: 8 }, (_, i) => async () => { peak = Math.max(peak, ++current); await Promise.resolve(); current--; return i; }); assert.deepEqual(await api.runConcurrent(tasks, { maxConcurrency: 2, timeoutMs: 20, clock: clock() }), [0,1,2,3,4,5,6,7]); assert.equal(peak, 2); }],
  ['concurrent failure stops scheduling and aborts sibling signal', async () => { let calls = 0, signal; const tasks = [async s => { signal = s; throw Error('private token'); }, async () => { calls++; }]; await assert.rejects(api.runConcurrent(tasks, { maxConcurrency: 1, timeoutMs: 20, clock: clock() }), { code: 'HARNESS_TASK_FAILED' }); assert.equal(calls, 0); assert.equal(signal.aborted, true); }],
  ['sparse malformed and over-budget batches rejected', async () => { for (const tasks of [[], new Array(2), [null], Array.from({ length: 101 }, () => () => {})]) await assert.rejects(api.runConcurrent(tasks, { maxConcurrency: 2, timeoutMs: 20, clock: clock() })); }],
  ['evidence success contains only whitelisted metadata', async () => { const h = harness(); assert.equal(await h.runCase('otp-verify', async () => 'private jwt', { clock: clock() }), true); const report = h.report(); assert.equal(report.passed, 1); assert.equal(report.liveExecutionAuthorized, false); assert.equal(JSON.stringify(report).includes('private'), false); assert.ok(Object.isFrozen(report.cases[0])); }],
  ['failed scenario redacts errors and terminates run', async () => { const h = harness(); assert.equal(await h.runCase('qr-fence', () => { throw Error('mongodb://secret'); }, { clock: clock() }), false); assert.equal(h.report().failed, 1); assert.equal(JSON.stringify(h.report()).includes('secret'), false); assert.throws(() => h.fixture('user'), { code: 'HARNESS_TERMINATED' }); }],
  ['termination cancels pending case and prevents late success', async () => { const h = harness(), c = clock(); const pending = h.runCase('recovery', () => new Promise(() => {}), { clock: c }); await Promise.resolve(); h.terminate(); assert.equal(await pending, false); assert.equal(h.report().passed, 0); assert.equal(c.count(), 0); }],
  ['case timeout fails closed and records fixed code', async () => { const h = harness(), c = clock(); const pending = h.runCase('game-start', () => new Promise(() => {}), { clock: c }); await Promise.resolve(); c.advance(50); assert.equal(await pending, false); assert.equal(h.report().cases[0].code, 'HARNESS_TIMEOUT'); }],
  ['total duration and clock substitution cannot evade budgets', async () => { const h = harness(), c = clock(); assert.equal(await h.runCase('campaign', async () => {}, { clock: c }), true); c.advance(1000); assert.equal(await h.runCase('campaign', async () => {}, { clock: c }), false); const b = harness(); await b.runCase('admin-write', async () => {}, { clock: clock() }); assert.equal(await b.runCase('admin-write', async () => {}, { clock: clock() }), false); }],
  ['case count and scenario identities enforced', async () => { const h = api.createOfflineHarness({ ...config(), maxCases: 1 }), c = clock(); await assert.rejects(h.runCase('arbitrary', async () => {}, { clock: c })); await h.runCase('otp-issue', async () => {}, { clock: c }); await assert.rejects(h.runCase('otp-issue', async () => {}, { clock: c })); assert.equal(h.scenarios.length, 10); }],
  ['configured wave enforces concurrency and captures each result', async () => { const h = api.createOfflineHarness({ ...config(), maxConcurrency: 2 }); let current = 0, peak = 0; const result = await h.runWave('token-revoke', Array.from({ length: 5 }, () => async () => { peak = Math.max(peak, ++current); await Promise.resolve(); current--; }), { clock: clock() }); assert.equal(peak, 2); assert.deepEqual(result, [true,true,true,true,true]); assert.equal(h.report().passed, 5); }],
  ['configured wave rejects over-budget work before invoking callbacks', async () => { const h = api.createOfflineHarness({ ...config(), maxCases: 1 }); let calls = 0; await assert.rejects(h.runWave('otp-issue', [() => calls++, () => calls++], { clock: clock() }), { code: 'INVALID_CONCURRENCY_BATCH' }); assert.equal(calls, 0); }],
  ['failed wave cancels siblings and stops the harness', async () => { const h = harness(), c = clock(); let sibling; const pending = h.runWave('game-complete', [async () => { throw Error('private'); }, async signal => { sibling = signal; return new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); }], { clock: c }); await assert.rejects(pending, { code: 'HARNESS_TASK_FAILED' }); assert.equal(sibling.aborted, true); assert.equal(h.report().terminated, true); assert.equal(h.report().passed, 0); assert.equal(c.count(), 0); }],
];
for (const [name, patch] of [
  ['production database', { mongoUri: config().target.mongoUri.replace('/hnc_step15q_sandbox?', '/test?') }],
  ['other database', { mongoUri: config().target.mongoUri.replace('/hnc_step15q_sandbox?', '/other?') }],
  ['remote production host', { mongoUri: config().target.mongoUri.replace('127.0.0.1', 'production.invalid') }],
  ['SRV discovery', { mongoUri: config().target.mongoUri.replace('mongodb:', 'mongodb+srv:') }],
  ['DNS loopback', { mongoUri: config().target.mongoUri.replace('127.0.0.1', 'localhost') }],
  ['credentials', { mongoUri: config().target.mongoUri.replace('mongodb://', 'mongodb://user:secret@') }],
  ['database override', { mongoUri: config().target.mongoUri + '&dbName=test' }],
  ['duplicate replica set', { mongoUri: config().target.mongoUri + '&replicaSet=other' }],
  ['missing replica set', { mongoUri: 'mongodb://127.0.0.1:27018/hnc_step15q_sandbox' }],
  ['HTTP production host', { httpBaseUrl: 'https://production.invalid:5501' }],
  ['HTTP redirect path', { httpBaseUrl: 'http://127.0.0.1:5501/redirect' }],
  ['email activation', { emailAdapter: 'smtp' }],
  ['prize activation', { allocationEnabled: true }],
  ['customer activation', { campaignParticipationEnabled: true }],
  ['unknown target control', { liveAuthorized: true }],
]) cases.push([name + ' fails closed without secret output', () => { const c = config(); c.target = { ...c.target, ...patch }; assert.throws(() => api.createOfflineHarness(c), error => !error.message.includes('secret') && !error.message.includes('mongodb:')); }]);
run('INTEGRATION HARNESS OFFLINE', cases);
