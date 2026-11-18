'use strict';
const assert = require('node:assert/strict');
const load = require('./helpers/loadIsolatedService.cjs');
const { registry, config } = require('./helpers/loadGameRegistry.cjs')();
const { createLegacyGameEngine } = load('features/games/engine/legacyGameEngineFactory.js', {});
function setup() {
  const calls = [];
  const result = { unchanged: true };
  const service = name => (...args) => { calls.push({ name, args }); return result; };
  const ports = { registry, sessions: { getCurrentSession: service('session'), getHistory: service('history'), completeSession: service('complete') },
    start: { startGame: service('start') }, status: { getGameStatus: service('status') }, monkey: { nextRound: service('monkey-next'), hit: service('monkey-hit') }, perfectShot: { nextShot: service('shot-next'), shoot: service('shoot') } };
  return { ports, engine: createLegacyGameEngine(ports), calls, result };
}
const bodies = { sessionId: 'a'.repeat(24), sessionToken: 'synthetic-only', round: 1, targetIndex: 4, shot: 1, x: 50, y: 50 };
const cases = [
  ['legacy config exports retain exact values and shape', () => {
    assert.equal(JSON.stringify(config.GAMES), JSON.stringify({ monkey: { id: 'monkey', label: 'Whak the Monkey', maxAttempts: 3, sessionTtlMs: 120000, requiredHits: 7, maxRounds: 20 }, 'perfect-shot': { id: 'perfect-shot', label: 'Perfect Shot', maxAttempts: 3, sessionTtlMs: 120000, totalShots: 5, perShotTimeMs: 3500, scoreToQualify: 350 } }));
    assert.deepEqual(Object.keys(config), ['CAMPAIGN_POLICY', 'GAME_IDS', 'GAMES', 'getGameConfig']);
  }],
  ['shared legacy operations preserve arguments result and status service identity', () => { const f = setup(); const options = {}; for (const name of ['startGame', 'getCurrentSession', 'completeSession', 'getHistory']) { assert.equal(f.engine[name]('user', 'monkey', options), f.result); const call = f.calls.at(-1); assert.equal(call.args[0], 'user'); assert.equal(call.args[1], 'monkey'); assert.equal(call.args[2], options); } assert.equal(f.engine.getGameStatus, f.ports.status.getGameStatus); }],
  ['registering a future game cannot activate the legacy start or abandon endpoints', () => { const f = setup(); const modules = require('./helpers/loadGameRegistry.cjs')(); f.ports.registry = modules.createGameRegistry({ approvedGameIds: ['synthetic-proof'], definitions: [require('./helpers/syntheticGame.cjs')()] }); const engine = createLegacyGameEngine(f.ports); for (const name of ['startGame', 'getCurrentSession', 'completeSession', 'getHistory']) assert.throws(() => engine[name]('user', 'synthetic-proof', bodies), { code: 'SHARED_ENGINE_ADAPTER_REQUIRED' }); assert.equal(f.calls.length, 0); }],
  ['Monkey actions preserve body return and user identity', () => { const f = setup(); const user = {}; assert.equal(f.engine.monkey.nextRound(user, bodies), f.result); assert.equal(f.engine.monkey.hit(user, bodies), f.result); assert.equal(f.calls[0].args[0], user); assert.equal(f.calls[0].args[1], bodies); assert.equal(f.calls[1].args[1], bodies); }],
  ['Perfect Shot actions preserve body return and user identity', () => { const f = setup(); assert.equal(f.engine.perfectShot.nextShot('user', bodies), f.result); assert.equal(f.engine.perfectShot.shoot('user', bodies), f.result); assert.equal(f.calls[0].name, 'shot-next'); assert.equal(f.calls[1].name, 'shoot'); assert.equal(f.calls[1].args[1], bodies); }],
  ['original async errors propagate unchanged', async () => { const f = setup(); const error = new Error('synthetic'); f.ports.monkey.hit = async () => { throw error; }; const engine = createLegacyGameEngine(f.ports); await assert.rejects(engine.monkey.hit('user', bodies), value => value === error); }],
  ['no fake game or action is dispatched through compatibility facade', () => { const f = setup(); assert.throws(() => f.engine.submitEvidence('user', 'synthetic-proof', 'prove', bodies), { code: 'UNKNOWN_GAME' }); assert.throws(() => f.engine.submitEvidence('user', 'monkey', 'constructor', bodies), { code: 'UNKNOWN_ACTION' }); assert.equal(f.calls.length, 0); }],
  ['controller start retains status codes and response identity', async () => {
    for (const resumed of [false, true]) { const data = { resumed }; let code, body;
      const controller = load('features/games/controllers/gameController.js', { '../engine/legacyGameEngine': { startGame: async (user, game) => { assert.equal(user, 'user'); assert.equal(game, 'monkey'); return data; } } });
      await controller.start({ user: { _id: 'user' }, params: { gameId: 'monkey' } }, { status(value) { code = value; return this; }, json(value) { body = value; } }, error => { throw error; });
      assert.equal(code, resumed ? 200 : 201); assert.equal(body, data);
    }
  }],
  ['controller history preserves query and authenticated user arguments', async () => { let args; const data = {}; const controller = load('features/games/controllers/gameController.js', { '../engine/legacyGameEngine': { getHistory: async (...values) => { args = values; return data; } } }); let response;
    await controller.getHistory({ user: { _id: 'user' }, params: { gameId: 'perfect-shot' }, query: { limit: '9' } }, { json(value) { response = value; } }, error => { throw error; });
    assert.equal(args[0], 'user'); assert.equal(args[1], 'perfect-shot'); assert.equal(args[2].limit, '9'); assert.equal(response, data);
  }],
  ['gameplay controllers retain exports and forward service errors', async () => {
    const error = new Error('synthetic'); const monkey = load('features/games/controllers/monkeyGameplayController.js', { '../engine/legacyGameEngine': { monkey: { hit: async () => { throw error; } } } });
    assert.deepEqual(Object.keys(monkey), ['nextRound', 'hit']); let forwarded; await monkey.hit({ user: { _id: 'x' }, body: bodies }, {}, value => { forwarded = value; }); assert.equal(forwarded, error);
    const perfect = load('features/games/controllers/perfectShotGameplayController.js', { '../engine/legacyGameEngine': { perfectShot: { shoot: async () => { throw error; } } } });
    assert.deepEqual(Object.keys(perfect), ['nextShot', 'shoot']); await perfect.shoot({ user: { _id: 'x' }, body: bodies }, {}, value => { forwarded = value; }); assert.equal(forwarded, error);
  }],
  ['preliminary decision rejects unsupported and non-qualified sessions without calls', async () => { let calls = 0; const service = load('features/games/services/gameCompletionDecisionService.js', { '../registry/gameRegistry': registry, '../../prizes/services/prizeDecisionCreationService': { createPrizeDecision: async () => { calls++; } } }); assert.equal((await service.processQualifiedCompletion(null)).reason, 'NOT_QUALIFIED'); assert.equal((await service.processQualifiedCompletion({ status: 'completed', outcome: 'qualified', gameId: 'synthetic-proof' })).reason, 'UNSUPPORTED_GAME'); assert.equal(calls, 0); }],
  ['preliminary decision retains both existing game contracts and idempotent marker', async () => { for (const gameId of ['monkey', 'perfect-shot']) { let input; const service = load('features/games/services/gameCompletionDecisionService.js', { '../registry/gameRegistry': registry, '../../prizes/services/prizeDecisionCreationService': { createPrizeDecision: async value => { input = value; return { existing: true, decisionId: 'synthetic-decision', status: 'pending_review' }; } } }); const result = await service.processQualifiedCompletion({ _id: 'session', userId: 'user', status: 'completed', outcome: 'qualified', gameId }); assert.equal(input.gameSessionId, 'session'); assert.equal(input.userId, 'user'); assert.equal(result.created, false); assert.equal(result.status, 'pending_review'); } }],
  ['preliminary failure still preserves committed gameplay and reports bounded failure', async () => { const service = load('features/games/services/gameCompletionDecisionService.js', { '../registry/gameRegistry': registry, '../../prizes/services/prizeDecisionCreationService': { createPrizeDecision: async () => { throw Object.assign(new Error('synthetic'), { code: 'DECISION_CONFLICT' }); } } }); const result = await service.processQualifiedCompletion({ _id: 's', userId: 'u', status: 'completed', outcome: 'qualified', gameId: 'monkey' }); assert.equal(result.failed, true); assert.equal(result.errorCode, 'DECISION_CONFLICT'); }],
];
require('./helpers/runCases.cjs')('OFFLINE LEGACY ENGINE COMPATIBILITY', cases);
