'use strict';
const registry = require('../registry/gameRegistry');
const { immutableData, record, fail } = require('../registry/gameRegistryFactory');
const { decodeSession } = require('./gameSessionStoreFactory');
const legacyBehavior = require('../../fraud-monitoring/services/gameplayBehaviorSignalsService').analyzeGameplayBehavior;
const ASSESSMENT_VERSION = 2;
const BEHAVIOR_VERSION = 1;
function canonicalSession(game, session) {
  if (game.execution === 'legacy') return session;
  const canonical = session.gameState ? decodeSession(session) : session;
  if (canonical.configVersion !== game.version) throw fail('CONFIG_VERSION_CONFLICT', 'Original validator version required for assessment');
  return canonical;
}
function assessPrizeRisk(session) {
  const game = registry.find(session?.gameId);
  if (!game) return { assessmentVersion: ASSESSMENT_VERSION, reviewRequired: true, riskReasons: [session && typeof session === 'object' ? 'UNKNOWN_GAME' : 'INVALID_SESSION'] };
  const canonical = canonicalSession(game, session);
  const result = immutableData(game.handlers.assessIntegrity(canonical));
  record(result, ['assessmentVersion', 'reviewRequired', 'riskReasons'], 'INVALID_ASSESSMENT');
  if (result.assessmentVersion !== ASSESSMENT_VERSION || typeof result.reviewRequired !== 'boolean' || !Array.isArray(result.riskReasons) || result.riskReasons.length > 20 || result.riskReasons.some(value => typeof value !== 'string' || value.length > 200)) throw fail('INVALID_ASSESSMENT', 'Invalid Integrity V2 contract');
  return result;
}
function analyzeGameplayBehavior(session) {
  const game = registry.find(session?.gameId);
  if (!game) return immutableData(legacyBehavior(session));
  const canonical = canonicalSession(game, session);
  const result = immutableData(game.handlers.assessBehavior(canonical));
  record(result, ['behaviorVersion', 'reviewSuggested', 'signals', 'enforcementAllowed'], 'INVALID_ASSESSMENT');
  if (result.behaviorVersion !== BEHAVIOR_VERSION || typeof result.reviewSuggested !== 'boolean' || result.enforcementAllowed !== false || !Array.isArray(result.signals) || result.signals.length > 20 || result.signals.some(value => typeof value !== 'string' || value.length > 200)) throw fail('INVALID_ASSESSMENT', 'Invalid Behavioral V1 contract');
  return result;
}
module.exports = { assessPrizeRisk, ASSESSMENT_VERSION, analyzeGameplayBehavior, BEHAVIOR_VERSION };
