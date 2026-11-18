'use strict';

// Compatibility boundary: preserve argument, return, and error identity.
function createLegacyGameEngine({
  registry, sessions, start, status, monkey, perfectShot,
}) {
  function legacy(operation, userId, gameId, ...args) {
    const game = registry.find(gameId);

    if (game && game.execution !== 'legacy') {
      throw Object.assign(
        new Error('Explicit shared-engine adapter required'),
        { code: 'SHARED_ENGINE_ADAPTER_REQUIRED', status: 409 }
      );
    }

    return operation(userId, gameId, ...args);
  }

  const actions = Object.freeze({
    monkey: Object.freeze({
      next: monkey.nextRound,
      hit: monkey.hit,
    }),
    'perfect-shot': Object.freeze({
      next: perfectShot.nextShot,
      shoot: perfectShot.shoot,
    }),
  });

  function submitEvidence(userId, gameId, action, body, ...args) {
    const game = registry.require(gameId);

    if (!game.actions.includes(action)) {
      throw Object.assign(new Error('Unsupported action'), {
        code: 'UNKNOWN_ACTION',
        status: 400,
      });
    }

    const handler = actions[gameId]?.[action];

    if (typeof handler !== 'function') {
      throw Object.assign(new Error('No legacy adapter'), {
        code: 'UNSUPPORTED_ENGINE',
        status: 400,
      });
    }

    return handler(userId, body, ...args);
  }

  return Object.freeze({
    discover: () => registry.discover(),
    getGameStatus: status.getGameStatus,
    startGame: (user, game, ...args) =>
      legacy(start.startGame, user, game, ...args),
    getCurrentSession: (user, game, ...args) =>
      legacy(sessions.getCurrentSession, user, game, ...args),
    getHistory: (user, game, ...args) =>
      legacy(sessions.getHistory, user, game, ...args),
    completeSession: (user, game, ...args) =>
      legacy(sessions.completeSession, user, game, ...args),
    submitEvidence,
    monkey: Object.freeze({
      nextRound: (user, body) =>
        submitEvidence(user, 'monkey', 'next', body),
      hit: (user, body) =>
        submitEvidence(user, 'monkey', 'hit', body),
    }),
    perfectShot: Object.freeze({
      nextShot: (user, body) =>
        submitEvidence(user, 'perfect-shot', 'next', body),
      shoot: (user, body, ...args) =>
        submitEvidence(user, 'perfect-shot', 'shoot', body, ...args),
    }),
  });
}

module.exports = { createLegacyGameEngine };