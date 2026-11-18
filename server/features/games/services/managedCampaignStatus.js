'use strict';

const User = require('../../authentication/models/User');
const CampaignDefinition = require('../../campaigns/models/CampaignDefinition');
const { evaluateDefinitionEligibility } = require('../../campaigns/services/campaignPolicy');
const PrizeAward = require('../../prizes/models/PrizeAward');
const GameSession = require('../models/GameSession');
const { MANAGED_CAMPAIGN_ID } = require('../../../config/gameConfig');

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, statusCode: status, code });
}

async function loadCampaignStatus(userId, now) {
  const filter = { userId, campaignId: MANAGED_CAMPAIGN_ID };
  const [campaign, user, award, sessions] = await Promise.all([
    CampaignDefinition.findOne({ campaignId: MANAGED_CAMPAIGN_ID })
      .select('campaignId name enabled gameIds startsAt endsAt eligibility participation prizeItemIds -_id').lean(),
    User.findById(userId).select('createdAt emailVerified hasSpun isActive').lean(),
    PrizeAward.findOne(filter).select('_id').lean(),
    GameSession.find(filter)
      .select('userId campaignId gameId attemptNumber campaignAttemptNumber status startedAt expiresAt').lean(),
  ]);

  if (!campaign) {
    throw httpError(503, 'CAMPAIGN_NOT_CONFIGURED', 'Campaign definition unavailable');
  }
  if (!user) throw httpError(404, 'USER_NOT_FOUND', 'User not found');
  if (user.isActive === false) {
    throw httpError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  }

  const definition = { ...campaign, prizeItemIds: (campaign.prizeItemIds || []).map(String) };
  const facts = {
    emailVerified: user.emailVerified === true,
    isActive: user.isActive !== false,
    hasPrize: Boolean(award) || user.hasSpun === true,
    registeredAt: user.createdAt ? new Date(user.createdAt).getTime() : NaN,
    sessionsUsed: sessions.reduce(
      (used, row) => Math.max(used, row.campaignAttemptNumber || 0),
      sessions.length
    ),
    activeSessions: sessions.filter(
      row => row.status === 'active' && new Date(row.expiresAt).getTime() > now
    ).length,
  };

  return { definition, facts, sessions, now };
}

function readCampaignGame(state, config) {
  const { definition, facts, sessions, now } = state;
  const gameSessions = sessions.filter(row => row.gameId === config.id);
  const active = gameSessions.find(
    row => row.status === 'active' && new Date(row.expiresAt).getTime() > now
  );
  const attemptsUsed = gameSessions.reduce(
    (used, row) => Math.max(used, row.attemptNumber),
    gameSessions.length
  );
  const attemptsLeft = Math.max(0, Math.min(
    config.maxAttempts - attemptsUsed,
    definition.participation.maxSessionsPerUser - facts.sessionsUsed
  ));

  const reasons = evaluateDefinitionEligibility(definition, { ...facts, gameId: config.id }, now)
    .reasons.filter(reason => !(active && (
      reason === 'PARTICIPATION_LIMIT' ||
      (reason === 'ACTIVE_SESSION' && facts.activeSessions === 1)
    )));
  if (!active && attemptsUsed >= config.maxAttempts) reasons.push('NO_ATTEMPTS_LEFT');
  const lockReason = reasons[0] ?? null;

  return {
    active,
    view: {
      id: config.id,
      label: config.label,
      maxAttempts: config.maxAttempts,
      attemptsUsed,
      attemptsLeft,
      locked: lockReason !== null,
      lockReason,
    },
  };
}

module.exports = { loadCampaignStatus, readCampaignGame };
