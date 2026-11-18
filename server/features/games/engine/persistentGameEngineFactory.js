'use strict';
const { createGameEngine } = require('./sharedGameEngine');
const { createGameSessionStore } = require('./gameSessionStoreFactory');
const { fail } = require('../registry/gameRegistryFactory');

// Explicit composition only; never imports models, authentication, DB config or dotenv.
function createPersistentGameEngine({ registry, GameSession, checkCustomerEligibility, processQualifiedCompletion, secret, clock } = {}) {
  if (typeof checkCustomerEligibility !== 'function' || typeof processQualifiedCompletion !== 'function') throw fail('INVALID_ENGINE', 'Existing eligibility and preliminary-decision adapters required');
  return createGameEngine({ registry, store: createGameSessionStore({ GameSession }), secret, clock,
    eligibility: async scope => { await checkCustomerEligibility(scope.userId, scope.campaignId); return { allowed: true }; },
    decisions: async session => {
      const result = await processQualifiedCompletion({ _id: session.id, userId: session.userId, campaignId: session.campaignId, gameId: session.gameId, status: session.status, outcome: session.outcome });
      if (!result || result.failed || result.attempted !== true) throw fail(result?.errorCode || 'DECISION_FAILED', 'Preliminary decision pending recovery');
    },
  });
}
module.exports = { createPersistentGameEngine };
