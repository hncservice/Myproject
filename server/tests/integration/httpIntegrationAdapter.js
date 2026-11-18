'use strict';
const { fail, exact, ownedFixtures, createGate } = require('./adapterSafety');
// Pure bounded JSON copying: no getters, prototype keys, functions or HTML use.
function copyJson(value, depth = 0) {
  if (depth > 6) fail('ADAPTER_PAYLOAD_REJECTED');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length <= 8192) return value;
  if (Array.isArray(value)) {
    if (value.length > 50 || Reflect.ownKeys(value).length !== value.length + 1) fail('ADAPTER_PAYLOAD_REJECTED');
    return Object.freeze(Array.from({ length: value.length }, (_, index) => {
      const property = Object.getOwnPropertyDescriptor(value, String(index));
      if (!property || !property.enumerable || !Object.hasOwn(property, 'value')) fail('ADAPTER_PAYLOAD_REJECTED');
      return copyJson(property.value, depth + 1);
    }));
  }
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length > 50) fail('ADAPTER_PAYLOAD_REJECTED');
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype', 'enablePrizeAllocation', 'allocationEnabled', 'campaignParticipationEnabled'].includes(key) ||
        !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('ADAPTER_PAYLOAD_REJECTED');
    if (/email/i.test(key) && typeof descriptor.value === 'string' && !descriptor.value.endsWith('@example.invalid')) fail('ADAPTER_PAYLOAD_REJECTED');
    result[key] = copyJson(descriptor.value, depth + 1);
  }
  return Object.freeze(result);
}
function createHttpIntegrationAdapter(input = {}) {
  exact(input, ['config', 'enabled', 'authorization', 'ports', 'clock'], true);
  let { config, enabled = false, authorization = null, ports, clock } = input;
  const gate = createGate({ config, enabled, authorization, clock }, 'http-mock');
  const cfg = gate.config, owned = new Set();
  const resources = new Set(), disposals = new Set();
  const port = Number(new URL(cfg.target.httpBaseUrl).port);
  let listener = null, pending = null, closed = false, closeFailed = false;
  function ready() {
    gate.check();
    if (closed) fail('ADAPTER_CLOSED');
    exact(ports, ['buildApp', 'openListener', 'describeListener', 'dispatch', 'closeListener']);
    if (Object.values(ports).some(value => typeof value !== 'function')) fail('MISSING_ISOLATION_CONTROL');
    ports = Object.freeze({ ...ports });
  }
  function identity(actual) {
    exact(actual, ['host', 'port']);
    if (actual.host !== '127.0.0.1' || actual.port !== port) fail('ADAPTER_IDENTITY_REJECTED');
  }
  const dispose = async resource => {
    if (!resources.delete(resource)) return;
    const work = gate.dispose(ports.closeListener, resource); disposals.add(work);
    try { if (!await work) closeFailed = true; } finally { disposals.delete(work); }
  };
  const closeOwned = async () => { await Promise.all([...resources].map(dispose)); await Promise.all([...disposals]); };
  async function open() {
    ready();
    if (listener) return Object.freeze({ ready: true, mode: 'synthetic-offline' });
    if (pending) return pending;
    pending = gate.run('game-start', async signal => {
      const app = await ports.buildApp(signal);
      if (closed || signal.aborted) fail('ADAPTER_CANCELLED');
      const resource = await ports.openListener(app, Object.freeze({ host: '127.0.0.1', port }), signal);
      if (resource) resources.add(resource);
      try {
        if (!resource || closed || signal.aborted) fail('ADAPTER_CANCELLED');
        identity(await ports.describeListener(resource, signal));
        if (closed || signal.aborted) fail('ADAPTER_CANCELLED');
        listener = resource;
        return Object.freeze({ ready: true, mode: 'synthetic-offline' });
      } catch (error) { if (resource) await dispose(resource); throw error; }
    }, cfg.connectionTimeoutMs).catch(async error => {
      closed = true; listener = null; await closeOwned(); throw error;
    }).finally(() => { pending = null; });
    return pending;
  }
  async function request(input) {
    ready();
    exact(input, ['method', 'path', 'body', 'fixtures']);
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(input.method) || typeof input.path !== 'string' || input.path.length > 200 ||
        !/^(?:\/|\/api\/health|\/api\/(?:auth|spin|vendor|admin|games)(?:\/[A-Za-z0-9_-]+)*)$/.test(input.path)) fail('ADAPTER_HTTP_TARGET_REJECTED');
    const fixtures = ownedFixtures(input.fixtures, owned, input.body === null ? 0 : 1);
    const body = copyJson(input.body);
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 8192) fail('ADAPTER_PAYLOAD_REJECTED');
    if (!listener) fail('ADAPTER_NOT_LISTENING');
    return gate.run('game-complete', async signal => {
      identity(await ports.describeListener(listener, signal));
      if (closed || signal.aborted) fail('ADAPTER_CANCELLED');
      const response = await ports.dispatch(listener, Object.freeze({ method: input.method, url: cfg.target.httpBaseUrl + input.path,
        body, fixtureIds: Object.freeze(fixtures.map(f => f.data._id)), redirect: 'error', proxy: false,
        timeoutMs: cfg.requestTimeoutMs, maxResponseBytes: 8192 }), signal);
      if (closed || signal.aborted) fail('ADAPTER_CANCELLED');
      exact(response, ['statusCode', 'body']);
      if (!Number.isInteger(response.statusCode) || response.statusCode < 100 || response.statusCode > 599) fail('ADAPTER_RECEIPT_REJECTED');
      const result = copyJson(response.body);
      if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 8192) fail('ADAPTER_PAYLOAD_REJECTED');
      return Object.freeze({ statusCode: response.statusCode, body: result });
    }).catch(async error => {
      if (error.code === 'ADAPTER_OPERATION_FAILED') { closed = true; listener = null; await closeOwned(); }
      throw error;
    });
  }
  return Object.freeze({ open, request,
    fixture(kind) { ready(); const fixture = gate.harness.fixture(kind); owned.add(fixture); return fixture; },
    cleanup() { fail('ADAPTER_CLEANUP_DISABLED'); },
    async close() { closed = true; gate.harness.terminate(); listener = null; await closeOwned(); },
    diagnostics: () => Object.freeze({ mode: 'synthetic-offline', closed, closeFailed, ...gate.harness.report() }),
  });
}
module.exports = { createHttpIntegrationAdapter };
