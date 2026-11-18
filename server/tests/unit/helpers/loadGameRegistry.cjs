'use strict';
const load = require('./loadIsolatedService.cjs');
module.exports = function loadGameRegistry(environment = {}) {
  const factory = load('features/games/registry/gameRegistryFactory.js', {});
  // Assessment modules remain explicit VM source dependencies, never live requires.
  let integrity, behavior;
  const registry = load('features/games/registry/gameRegistry.js', {
    './gameRegistryFactory': factory,
    '../../fraud-monitoring/services/prizeFraudAssessmentService': { assessPrizeRisk: session => integrity.assessPrizeRisk(session) },
    '../../fraud-monitoring/services/gameplayBehaviorSignalsService': { analyzeGameplayBehavior: session => behavior.analyzeGameplayBehavior(session) },
  });
  const config = load('config/gameConfig.js', { '../features/games/registry/gameRegistry': registry }, environment);
  return { ...factory, registry, config,
    loadAssessments() {
      integrity = load('features/fraud-monitoring/services/prizeFraudAssessmentService.js', { '../../../config/gameConfig': config });
      behavior = load('features/fraud-monitoring/services/gameplayBehaviorSignalsService.js', {});
    } };
};
