'use strict';
const Joi = require('joi');
const registry = require('../../games/registry/gameRegistry');
const { immutableData } = require('../../games/registry/gameRegistryFactory');
const { LEGACY_CAMPAIGN_ID } = require('../../../config/gameConfig');
// Separate release gate: administrative availability never activates participation.
const CAMPAIGN_PARTICIPATION_ENABLED = false;
const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });
const campaignIdSchema = Joi.string().pattern(/^[a-z][a-z0-9-]{2,63}$/).required();
const schema = Joi.object({
  campaignId: campaignIdSchema,
  name: Joi.string().trim().min(2).max(100).required(),
  enabled: Joi.boolean().strict().required(),
  gameIds: Joi.array().items(Joi.string().max(64)).min(1).max(10).unique().required(),
  startsAt: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/).required(),
  endsAt: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/).required(),
  eligibility: Joi.object({ verifiedEmailRequired: Joi.boolean().valid(true).strict().required(), minAccountAgeHours: Joi.number().integer().min(0).max(8760).strict().required() }).unknown(false).required(),
  participation: Joi.object({ maxSessionsPerUser: Joi.number().integer().min(1).max(6).strict().required(), maxConcurrentSessions: Joi.number().valid(1).strict().required(), allowPriorWinners: Joi.boolean().valid(false).strict().required() }).unknown(false).required(),
  prizeItemIds: Joi.array().items(Joi.string().pattern(/^[a-f0-9]{24}$/)).max(50).unique().required(),
}).unknown(false);
function validId(value) { return !campaignIdSchema.validate(value).error; }
function validateDefinition(input) {
  let clean;
  try { clean = immutableData(input); } catch { throw fail('INVALID_CAMPAIGN'); }
  const { error, value } = schema.validate(clean, { convert: false });
  if (error) throw fail('INVALID_CAMPAIGN');
  if (value.campaignId === LEGACY_CAMPAIGN_ID) throw fail('LEGACY_CAMPAIGN_RESERVED');
  for (const key of ['startsAt', 'endsAt']) {
    const ms = Date.parse(value[key]);
    if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value[key].replace(/Z$/, value[key].includes('.') ? 'Z' : '.000Z')) throw fail('INVALID_CAMPAIGN_DATES');
  }
  if (Date.parse(value.startsAt) >= Date.parse(value.endsAt)) throw fail('INVALID_CAMPAIGN_DATES');
  if (value.gameIds.some(id => !registry.find(id))) throw fail('UNSUPPORTED_CAMPAIGN_GAME');
  const maxAttempts = value.gameIds.reduce((sum, id) => sum + registry.require(id).config.maxAttempts, 0);
  if (value.participation.maxSessionsPerUser > maxAttempts) throw fail('INVALID_PARTICIPATION_LIMIT');
  return immutableData({ ...value, gameIds: [...value.gameIds].sort(), prizeItemIds: [...value.prizeItemIds].sort(), startsAt: new Date(value.startsAt).toISOString(), endsAt: new Date(value.endsAt).toISOString() });
}
// Diagnostic only. Inputs must come from a trusted server account/count adapter.
// Neither this helper nor a browser-submitted count authorizes a gameplay session.
function evaluateDefinitionEligibility(definition, facts, now = Date.now()) {
  const d = validateDefinition(definition);
  const reasons = [];
  if (!Number.isSafeInteger(now) || !facts || !Number.isSafeInteger(facts.sessionsUsed) || facts.sessionsUsed < 0 || !Number.isSafeInteger(facts.activeSessions) || facts.activeSessions < 0 || typeof facts.hasPrize !== 'boolean' || typeof facts.emailVerified !== 'boolean' || typeof facts.isActive !== 'boolean' || !Number.isSafeInteger(facts.registeredAt) || facts.registeredAt < 0 || facts.registeredAt > now) throw fail('INVALID_ELIGIBILITY_FACTS');
  if (!d.enabled) reasons.push('CAMPAIGN_DISABLED');
  if (now < Date.parse(d.startsAt)) reasons.push('CAMPAIGN_NOT_STARTED');
  if (now >= Date.parse(d.endsAt)) reasons.push('CAMPAIGN_ENDED');
  if (!d.gameIds.includes(facts.gameId)) reasons.push('GAME_NOT_ASSIGNED');
  if (!facts.isActive || !facts.emailVerified) reasons.push('ACCOUNT_NOT_ELIGIBLE');
  if (now - facts.registeredAt < d.eligibility.minAccountAgeHours * 3600000) reasons.push('ACCOUNT_TOO_NEW');
  if (facts.hasPrize) reasons.push('PRIOR_PRIZE');
  if (facts.sessionsUsed >= d.participation.maxSessionsPerUser) reasons.push('PARTICIPATION_LIMIT');
  if (facts.activeSessions >= d.participation.maxConcurrentSessions) reasons.push('ACTIVE_SESSION');
  return immutableData({ eligibleByDefinition: reasons.length === 0, reasons });
}
function campaignAdmission(definition, facts, now) {
  const result = evaluateDefinitionEligibility(definition, facts, now);
  return immutableData({ allowed: CAMPAIGN_PARTICIPATION_ENABLED && result.eligibleByDefinition, reasons: [...(!CAMPAIGN_PARTICIPATION_ENABLED ? ['CAMPAIGN_RELEASE_DISABLED'] : []), ...result.reasons] });
}
module.exports = { validateDefinition, validId, evaluateDefinitionEligibility, campaignAdmission, CAMPAIGN_PARTICIPATION_ENABLED };
