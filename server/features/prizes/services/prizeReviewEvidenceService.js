'use strict';
const { assessPrizeRisk, analyzeGameplayBehavior } = require('../../games/engine/registeredGameAssessments');
const { immutableData } = require('../../games/registry/gameRegistryFactory');
// Read-only recomputation from server-owned gameplay. Never writes a decision.
function reviewEvidence(game) {
  if (!game) return immutableData({ availability: 'unavailable', reason: 'GAMEPLAY_MISSING', integrity: null, behavior: null });
  try {
    if ((Array.isArray(game.events) && game.events.length > 1000) || (Array.isArray(game.gameState?.history) && game.gameState.history.length > 1000) || Buffer.byteLength(JSON.stringify(game), 'utf8') > 131072) throw new Error('EVIDENCE_LIMIT');
    const integrity = assessPrizeRisk(game);
    const behavior = analyzeGameplayBehavior(game);
    if (integrity.assessmentVersion !== 2 || behavior.behaviorVersion !== 1 || behavior.enforcementAllowed !== false) throw new Error('INVALID_ASSESSMENT');
    return immutableData({ availability: 'available', source: 'server-recomputed', integrity, behavior, behaviorAffectsPrizeDecision: false });
  } catch { return immutableData({ availability: 'unavailable', reason: 'ASSESSMENT_UNAVAILABLE', integrity: null, behavior: null }); }
}
module.exports = { reviewEvidence };
