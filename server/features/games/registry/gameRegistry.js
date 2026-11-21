'use strict';

const { createGameRegistry } = require('./gameRegistryFactory');

// Static, code-reviewed registrations only.
// Assessment imports are deferred to avoid initialization cycles.
const assessIntegrity = (session) =>
  require('../../fraud-monitoring/services/prizeFraudAssessmentService')
    .assessPrizeRisk(session);

const assessBehavior = (session) =>
  require('../../fraud-monitoring/services/gameplayBehaviorSignalsService')
    .analyzeGameplayBehavior(session);

const verify = (session) => assessIntegrity(session);

const keys = (config, fields) =>
  Object.keys(config).length === fields.length &&
  fields.every((field) => Object.hasOwn(config, field));

const monkeyConfig = (config) =>
  keys(config, [
    'id',
    'label',
    'maxAttempts',
    'sessionTtlMs',
    'requiredHits',
    'maxRounds',
  ]) &&
  config.requiredHits === 7 &&
  config.maxRounds === 20;

const perfectConfig = (config) =>
  keys(config, [
    'id',
    'label',
    'maxAttempts',
    'sessionTtlMs',
    'totalShots',
    'perShotTimeMs',
    'scoreToQualify',
  ]) &&
  config.totalShots === 5 &&
  Number.isSafeInteger(config.perShotTimeMs) &&
  config.perShotTimeMs > 0 &&
  config.perShotTimeMs <= config.sessionTtlMs &&
  Number.isSafeInteger(config.scoreToQualify) &&
  config.scoreToQualify > 0 &&
  config.scoreToQualify <= config.totalShots * 100;

const registry = createGameRegistry({
  approvedGameIds: ['monkey', 'perfect-shot', 'burger-run'],
  definitions: [
    {
      id: 'monkey',
      version: 1,
      execution: 'legacy',
      preliminaryDecisions: true,
      config: {
        id: 'monkey',
        label: 'Whak the Monkey',
        maxAttempts: 3,
        sessionTtlMs: 120000,
        requiredHits: 7,
        maxRounds: 20,
      },
      actions: ['next', 'hit'],
      limits: {
        maxEvidenceBytes: 16384,
        maxEvents: 100,
      },
      handlers: {
        validateConfig: monkeyConfig,
        verify,
        assessIntegrity,
        assessBehavior,
      },
    },
    {
      id: 'perfect-shot',
      version: 1,
      execution: 'legacy',
      preliminaryDecisions: true,
      config: {
        id: 'perfect-shot',
        label: 'Perfect Shot',
        maxAttempts: 5,
        sessionTtlMs: 120000,
        totalShots: 5,
        perShotTimeMs: 3500,
        scoreToQualify: 250,
      },
      actions: ['next', 'shoot'],
      limits: {
        maxEvidenceBytes: 16384,
        maxEvents: 100,
      },
      handlers: {
        validateConfig: perfectConfig,
        verify,
        assessIntegrity,
        assessBehavior,
      },
    },
    {
      id: 'burger-run', version: 1, execution: 'legacy', preliminaryDecisions: true,
      config: { id: 'burger-run', label: 'HNC Burger Run', maxAttempts: 3, sessionTtlMs: 120000, requiredFood: 10, maxRunSeconds: 90 },
      actions: ['prepare', 'finish'], limits: { maxEvidenceBytes: 16384, maxEvents: 1 },
      handlers: {
        validateConfig: c => keys(c, ['id', 'label', 'maxAttempts', 'sessionTtlMs', 'requiredFood', 'maxRunSeconds']) && c.requiredFood === 10 && c.maxRunSeconds === 90,
        verify: session => require('../burger-run/burgerRunAssessment').assessIntegrity(session),
        assessIntegrity: session => require('../burger-run/burgerRunAssessment').assessIntegrity(session),
        assessBehavior: session => require('../burger-run/burgerRunAssessment').assessBehavior(session),
      },
    },
  ],
});

module.exports = registry;