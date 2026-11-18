
'use strict';
const gameRegistry = require('../registry/gameRegistry');

const { createPrizeDecision } = require(
  '../../prizes/services/prizeDecisionCreationService'
);

/**
 * Called only after an atomic gameplay completion
 * update has successfully committed.
 *
 * This service creates a preliminary decision only.
 * It never allocates a prize.
 */
async function processQualifiedCompletion(session) {
  if (
    !session ||
    session.status !== 'completed' ||
    session.outcome !== 'qualified'
  ) {
    return { attempted: false, reason: 'NOT_QUALIFIED' };
  }

  if (
    !gameRegistry.find(session.gameId)?.capabilities.preliminaryDecisions
  ) {
    return { attempted: false, reason: 'UNSUPPORTED_GAME' };
  }

  try {
    const decision = await createPrizeDecision({
      userId: session.userId,
      gameSessionId: session._id,
    });

    return {
      attempted: true,
      created: !decision.existing,
      decisionId: decision.decisionId,
      status: decision.status,
    };
  } catch (err) {
    // A decision failure must not undo a completed game.
    // Do not log tokens, credentials or private data.
    console.error('[PRELIMINARY_DECISION_FAILURE]', {
      gameId: session.gameId,
      code: typeof err.code === 'string'
        ? err.code
        : 'UNEXPECTED_ERROR',
    });

    return {
      attempted: true,
      created: false,
      failed: true,
      errorCode: typeof err.code === 'string'
        ? err.code
        : 'UNEXPECTED_ERROR',
    };
  }
}

module.exports = {
  processQualifiedCompletion,
};
