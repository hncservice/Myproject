'use strict';
const crypto = require('node:crypto');
const load = require('./loadIsolatedService.cjs');
const { createGameRegistry, immutableData, record, fail } = require('./loadGameRegistry.cjs')();
const synthetic = require('./syntheticGame.cjs');
const { createGameEngine } = load('features/games/engine/sharedGameEngine.js', {
  'node:crypto': crypto, '../registry/gameRegistryFactory': { immutableData, record, fail },
});
module.exports = function createEngineFixture(configure = () => {}) {
  const definition = synthetic(); configure(definition);
  const registry = createGameRegistry({ approvedGameIds: ['synthetic-proof'], definitions: [definition] });
  const actor = { userId: 'a'.repeat(24), campaignId: 'synthetic-campaign' };
  const records = new Map();
  const calls = { start: 0, commit: 0, expire: 0, decisions: 0, bookkeeping: 0 };
  const options = { now: 100, eligible: true, decisionError: null, bookkeepingError: false };
  const clone = value => JSON.parse(JSON.stringify(value));
  const matches = (row, scope) => Object.keys(scope).every(key => row[key] === scope[key]);
  const store = {
    async start(scope, initial, { maxAttempts, now }) {
      calls.start++;
      const owned = [...records.values()].filter(row => matches(row, scope));
      for (const row of owned) if (row.status === 'active' && row.expiresAt <= now) row.status = 'expired';
      const active = owned.find(row => row.status === 'active');
      if (active) return { session: clone(active), created: false };
      if (owned.length >= maxAttempts) throw Object.assign(new Error('No attempts'), { code: 'NO_ATTEMPTS_LEFT' });
      records.set(initial.id, clone(initial)); return { session: clone(initial), created: true };
    },
    async load(scope, id) { const row = records.get(id); return row && matches(row, scope) ? clone(row) : null; },
    async commit(scope, id, expected, next) {
      calls.commit++;
      const row = records.get(id);
      if (!row || !matches(row, scope) || row.status !== expected.status || row.revision !== expected.revision || row.expiresAt <= expected.now) return false;
      records.set(id, clone(next)); return true;
    },
    async expire(scope, id, now) { calls.expire++; const row = records.get(id); if (row && matches(row, scope) && row.status === 'active' && row.expiresAt <= now) row.status = 'expired'; },
    async history(scope, limit) { return [...records.values()].filter(row => matches(row, scope)).slice(-limit).map(clone); },
    async recordDecisionResult(scope, id, revision, completion) {
      calls.bookkeeping++; if (options.bookkeepingError) throw new Error('synthetic bookkeeping failure');
      const row = records.get(id); if (matches(row, scope) && row.revision === revision) { row.decisionPending = !completion.succeeded; row.decisionResult = clone(completion); }
    },
  };
  const engine = createGameEngine({ registry, store, secret: 'offline-synthetic-engine-secret-only', clock: () => options.now,
    eligibility: async () => ({ allowed: options.eligible }), decisions: async () => { calls.decisions++; if (options.decisionError) throw options.decisionError; } });
  const request = session => ({ sessionId: session.sessionId, sessionToken: session.sessionToken, commandId: 'synthetic-command-1', revision: session.revision, action: 'prove', evidence: { answer: 'synthetic-proof' } });
  const credentials = session => ({ sessionId: session.sessionId, sessionToken: session.sessionToken });
  return { engine, actor, store, records, calls, options, request, credentials, definition, registry, createGameEngine };
};
