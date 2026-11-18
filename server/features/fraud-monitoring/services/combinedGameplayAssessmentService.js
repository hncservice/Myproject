
'use strict';

const {
  assessPrizeRisk,
  ASSESSMENT_VERSION,
} = require('../../games/engine/registeredGameAssessments');

const {
  analyzeGameplayBehavior,
  BEHAVIOR_VERSION,
} = require('../../games/engine/registeredGameAssessments');

/**
 * Read-only combined gameplay assessment.
 *
 * Integrity assessment:
 * Existing V2 fraud and consistency checks.
 *
 * Behavioral assessment:
 * Advisory-only timing signals.
 *
 * This service does not:
 * - Modify gameplay
 * - Update PrizeDecision
 * - Reject customers
 * - Allocate prizes
 * - Generate QR codes
 */
function assessGameplayCombined(gameSession) {
  const integrity = assessPrizeRisk(gameSession);
  const behavior = analyzeGameplayBehavior(gameSession);

  return {
    integrity: {
      assessmentVersion: ASSESSMENT_VERSION,
      reviewRequired: integrity.reviewRequired,
      riskReasons: [...integrity.riskReasons],
    },

    behavior: {
      behaviorVersion: BEHAVIOR_VERSION,
      reviewSuggested: behavior.reviewSuggested,
      signals: [...behavior.signals],
      enforcementAllowed: false,
    },

    // Only the existing integrity assessment
    // controls preliminary review status.
    preliminaryReviewRequired:
      integrity.reviewRequired,

    // Behavioral warnings must not independently
    // change a preliminary prize decision.
    behaviorAffectsPrizeDecision: false,

    readOnly: true,
  };
}

module.exports = {
  assessGameplayCombined,
};
