'use strict';
const { immutableData, fail } = require('../registry/gameRegistryFactory');

// Existing GameSession fields and Mixed gameState; no schema/index/dependency changes.
function decodeSession(document) {
  if (!document) return null;
  const state = document.gameState;
  if (!state || state.engineVersion !== 1) throw fail('LEGACY_ADAPTER_REQUIRED', 'Session uses the existing gameplay adapter');
  const milliseconds = value => value == null ? null : new Date(value).getTime();
  return immutableData({ id: String(document._id), userId: String(document.userId), campaignId: document.campaignId, gameId: document.gameId,
    configVersion: state.configVersion, revision: state.revision, state: state.pluginState, status: document.status, outcome: document.outcome,
    score: document.score, startedAt: milliseconds(document.startedAt), expiresAt: milliseconds(document.expiresAt), completedAt: milliseconds(document.completedAt),
    sessionTokenHash: document.sessionTokenHash || null, events: document.events || [], lastCommand: state.lastCommand || null,
    assessments: state.assessments || null, decisionPending: state.decisionPending === true });
}
function createGameSessionStore({ GameSession } = {}) {
  if (!GameSession || ['updateMany', 'findOne', 'countDocuments', 'create', 'findOneAndUpdate', 'updateOne', 'find'].some(name => typeof GameSession[name] !== 'function')) throw fail('INVALID_STORE', 'Explicit GameSession model adapter required');
  const identity = (scope, id) => ({ userId: scope.userId, campaignId: scope.campaignId, gameId: scope.gameId, ...(id ? { _id: id } : {}) });
  const state = session => ({ engineVersion: 1, configVersion: session.configVersion, revision: session.revision, pluginState: session.state,
    lastCommand: session.lastCommand, assessments: session.assessments, decisionPending: session.decisionPending });
  const read = query => query.select('+sessionTokenHash').lean();
  return Object.freeze({
    async start(scope, initial, { now, maxAttempts }) {
      const filter = identity(scope);
      await GameSession.updateMany({ ...filter, status: 'active', expiresAt: { $lte: new Date(now) } }, { $set: { status: 'expired', outcome: 'not-qualified' } });
      const active = await read(GameSession.findOne({ ...filter, status: 'active' }));
      if (active) return { session: decodeSession(active), created: false };
      const used = await GameSession.countDocuments(filter);
      if (used >= maxAttempts) throw fail('NO_ATTEMPTS_LEFT', 'No attempts left for this game');
      try {
        const document = await GameSession.create({ ...filter, _id: initial.id, attemptNumber: used + 1, sessionTokenHash: initial.sessionTokenHash,
          status: 'active', outcome: null, score: 0, startedAt: new Date(initial.startedAt), expiresAt: new Date(initial.expiresAt),
          gameState: state(initial), events: [] });
        return { session: decodeSession(document), created: true };
      } catch (error) {
        if (error.code !== 11000) throw error;
        // Existing unique attempt/active indexes decide the winner; no retry insert.
        const winner = await read(GameSession.findOne({ ...filter, status: 'active', expiresAt: { $gt: new Date(now) } }));
        if (winner) return { session: decodeSession(winner), created: false };
        throw fail('START_CONFLICT', 'Concurrent start detected; refresh status and retry');
      }
    },
    async load(scope, id) { return decodeSession(await read(GameSession.findOne(identity(scope, id)))); },
    async commit(scope, id, expected, next) {
      const document = await GameSession.findOneAndUpdate({ ...identity(scope, id), status: 'active', expiresAt: { $gt: new Date(expected.now) },
        'gameState.engineVersion': 1, 'gameState.configVersion': next.configVersion, 'gameState.revision': expected.revision },
      { $set: { gameState: state(next), events: next.events, status: next.status, outcome: next.outcome, score: next.score,
        completedAt: next.completedAt == null ? null : new Date(next.completedAt) } }, { new: true });
      return Boolean(document);
    },
    async expire(scope, id, now) { await GameSession.updateOne({ ...identity(scope, id), status: 'active', expiresAt: { $lte: new Date(now) } }, { $set: { status: 'expired', outcome: 'not-qualified' } }); },
    async history(scope, limit) { return (await read(GameSession.find({ ...identity(scope), 'gameState.engineVersion': 1 }).sort({ startedAt: -1 }).limit(limit))).map(decodeSession); },
    async recordDecisionResult(scope, id, revision, result) {
      await GameSession.updateOne({ ...identity(scope, id), status: 'completed', 'gameState.engineVersion': 1, 'gameState.revision': revision, 'gameState.decisionPending': true },
        { $set: { 'gameState.decisionPending': !result.succeeded, 'gameState.decisionResult': result } });
    },
  });
}
module.exports = { createGameSessionStore, decodeSession };
