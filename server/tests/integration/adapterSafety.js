'use strict';
const { createOfflineHarness, withDeadline } = require('./offlineHarness');
const { assertOfflineRuntime } = require('./offlineRuntime');
const fail = code => { throw Object.assign(new Error(code), { code }); };
function exact(value, keys, optional = false) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      (!optional && Reflect.ownKeys(value).length !== keys.length)) fail('ADAPTER_INVALID_INPUT');
  for (const key of Reflect.ownKeys(value)) {
    const p = Object.getOwnPropertyDescriptor(value, key);
    if (!keys.includes(key) || !p.enumerable || !Object.hasOwn(p, 'value')) fail('ADAPTER_INVALID_INPUT');
  }
}
function literalList(value, expected) {
  if (!Array.isArray(value) || value.length !== expected.length || Reflect.ownKeys(value).length !== expected.length + 1) return false;
  return expected.every((item, index) => {
    const property = Object.getOwnPropertyDescriptor(value, String(index));
    return property && property.enumerable && Object.hasOwn(property, 'value') && property.value === item;
  });
}
function ownedFixtures(value, owned, min = 1) {
  if (!Array.isArray(value) || value.length < min || value.length > 10 || Reflect.ownKeys(value).length !== value.length + 1) fail('ADAPTER_FIXTURE_SCOPE_REJECTED');
  const items = Array.from({ length: value.length }, (_, index) => {
    const property = Object.getOwnPropertyDescriptor(value, String(index));
    if (!property || !property.enumerable || !Object.hasOwn(property, 'value') || !owned.has(property.value)) fail('ADAPTER_FIXTURE_SCOPE_REJECTED');
    return property.value;
  });
  if (new Set(items).size !== items.length) fail('ADAPTER_FIXTURE_SCOPE_REJECTED');
  return Object.freeze(items);
}
function createGate({ config, enabled = false, authorization = null, clock }, capability) {
  assertOfflineRuntime();
  const harness = createOfflineHarness(config), cfg = harness.config;
  if (typeof enabled !== 'boolean') fail('ADAPTER_INVALID_INPUT');
  let approved = null;
  let inFlight = 0;
  if (authorization !== null) {
    exact(authorization, ['mode', 'runId', 'databaseName', 'host', 'mongoPort', 'replicaSet', 'httpBaseUrl', 'capability']);
    const expected = { mode: 'synthetic-offline', runId: cfg.runId, databaseName: 'hnc_step15q_sandbox',
      host: '127.0.0.1', mongoPort: cfg.mongoPort, replicaSet: cfg.replicaSet, httpBaseUrl: cfg.target.httpBaseUrl, capability };
    if (Object.keys(expected).some(key => authorization[key] !== expected[key])) fail('ADAPTER_AUTHORIZATION_REJECTED');
    approved = Object.freeze({ ...expected });
  }
  const check = () => {
    assertOfflineRuntime();
    if (!enabled) fail('ADAPTER_DISABLED');
    if (!approved) fail('ADAPTER_AUTHORIZATION_REQUIRED');
    if (harness.report().terminated) fail('ADAPTER_TERMINATED');
    if (!clock || typeof clock.now !== 'function' || typeof clock.setTimeout !== 'function' || typeof clock.clearTimeout !== 'function') fail('MISSING_ISOLATION_CONTROL');
  };
  return Object.freeze({ config: cfg, harness, check,
    async run(id, task, timeoutMs = cfg.requestTimeoutMs) {
      check();
      if (inFlight >= cfg.maxConcurrency) fail('ADAPTER_CONCURRENCY_EXCEEDED');
      inFlight++;
      let result;
      try {
        const passed = await harness.runCase(id, async signal => {
          result = await withDeadline(task, { timeoutMs, signal, clock });
        }, { clock });
        if (!passed) fail('ADAPTER_OPERATION_FAILED');
        return result;
      } finally { inFlight--; }
    },
    async dispose(port, handle) {
      // Close only a handle returned by our own port; never a DB-wide reset.
      assertOfflineRuntime();
      try { await withDeadline(() => port(handle), { timeoutMs: cfg.requestTimeoutMs, clock }); return true; }
      catch { return false; }
    },
  });
}
module.exports = { fail, exact, literalList, ownedFixtures, createGate };
