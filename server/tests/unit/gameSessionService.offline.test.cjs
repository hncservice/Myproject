'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const load = require('./helpers/loadIsolatedService.cjs');
const USER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SESSION = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const SECRET = 'synthetic-unit-fixture-only';
const CAMPAIGN = 'synthetic-offline-campaign';
const token = crypto.createHmac('sha256', SECRET)
  .update(`${SESSION}:${USER}:${CAMPAIGN}:monkey`).digest('hex');
const digest = crypto.createHash('sha256').update(token).digest('hex');

function fixture(options = {}) {
  const session = {
    _id: SESSION, userId: USER, campaignId: CAMPAIGN, gameId: 'monkey',
    status: 'active', outcome: null, score: 0, attemptNumber: 1,
    startedAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 60000),
    sessionTokenHash: digest, ...options.session,
  };
  const calls = { find: 0, updates: [], expiries: [] };
  const model = {
    findOne() {
      calls.find++;
      const value = calls.find > 1 && Object.hasOwn(options, 'afterRace') ? options.afterRace : session;
      return { select: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
    },
    async findOneAndUpdate(filter, update) {
      calls.updates.push({ filter, update });
      if (options.race) return null;
      return { ...session, ...update.$set };
    },
    async updateMany(filter, update) { calls.expiries.push({ filter, update }); },
  };
  class ObjectId { constructor(value) { this.value = value; } toString() { return this.value; } }
  const service = load('features/games/services/gameSessionService.js', {
    crypto,
    mongoose: { Types: { ObjectId }, isValidObjectId: value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value) },
    '../models/GameSession': model,
    '../../../config/gameConfig': { CAMPAIGN_POLICY: { campaignId: CAMPAIGN }, getGameConfig: id => id === 'monkey' ? {} : null },
  }, { JWT_SECRET: SECRET });
  return { session, calls, service };
}
const cases = [];
const test = (name, action) => cases.push({ name, action });

test('valid completion uses the supplied credential and never trusts client score', async () => {
  const { service, calls } = fixture();
  const result = await service.completeSession(USER, 'monkey', { sessionId: SESSION, sessionToken: token, score: 999, outcome: 'qualified' });
  assert.equal(result.status, 'completed');
  assert.equal(result.outcome, 'not-qualified');
  assert.equal(result.score, 0);
  assert.equal(result.idempotent, false);
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].filter.status, 'active');
  assert.ok(Number.isFinite(calls.updates[0].filter.expiresAt.$gt.getTime()));
});
test('wrong credential rejects before any write', async () => {
  const { service, calls } = fixture();
  await assert.rejects(service.completeSession(USER, 'monkey', { sessionId: SESSION, sessionToken: 'c'.repeat(64) }), e => e.code === 'INVALID_SESSION_TOKEN');
  assert.equal(calls.updates.length, 0);
  assert.equal(calls.expiries.length, 0);
});
test('saved credential hash mismatch rejects before writes', async () => {
  const { service, calls } = fixture({ session: { sessionTokenHash: 'wrong' } });
  await assert.rejects(service.completeSession(USER, 'monkey', { sessionId: SESSION, sessionToken: token }), e => e.code === 'INVALID_SESSION_TOKEN');
  assert.equal(calls.updates.length, 0);
});
test('invalid session identifier never queries a model', async () => {
  const { service, calls } = fixture();
  await assert.rejects(service.completeSession(USER, 'monkey', { sessionId: 'invalid', sessionToken: token }), e => e.code === 'INVALID_SESSION');
  assert.equal(calls.find, 0);
});
test('already completed request is idempotent without another write', async () => {
  const { service, calls } = fixture({ session: { status: 'completed', outcome: 'not-qualified' } });
  const result = await service.completeSession(USER, 'monkey', { sessionId: SESSION, sessionToken: token });
  assert.equal(result.idempotent, true);
  assert.equal(calls.updates.length, 0);
});
test('expired session is expired rather than completed', async () => {
  const { service, calls } = fixture({ session: { expiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(service.completeSession(USER, 'monkey', { sessionId: SESSION, sessionToken: token }), e => e.code === 'SESSION_EXPIRED');
  assert.equal(calls.updates.length, 0);
  assert.equal(calls.expiries.length, 1);
});
test('concurrent completed response is returned idempotently after a lost CAS', async () => {
  const afterRace = { _id: SESSION, gameId: 'monkey', status: 'completed', outcome: 'not-qualified', score: 0 };
  const { service, calls } = fixture({ race: true, afterRace });
  const result = await service.completeSession(USER, 'monkey', { sessionId: SESSION, sessionToken: token });
  assert.equal(result.idempotent, true);
  assert.equal(calls.updates.length, 1);
});
test('a lost CAS cannot complete an expired or otherwise inactive session', async () => {
  const { service, calls } = fixture({ race: true, afterRace: { status: 'expired' } });
  await assert.rejects(service.completeSession(USER, 'monkey', { sessionId: SESSION, sessionToken: token }), e => e.code === 'SESSION_NOT_ACTIVE');
  assert.equal(calls.expiries.length, 1);
});

(async () => {
  let passed = 0;
  for (const { name, action } of cases) {
    try { await action(); passed++; console.log('PASS: ' + name); }
    catch (error) { console.error('FAIL: ' + name + '\n' + error.stack); process.exitCode = 1; }
  }
  console.log(`RESULT: ${passed}/${cases.length} OFFLINE GAME SESSION CASES PASSED`);
})();
