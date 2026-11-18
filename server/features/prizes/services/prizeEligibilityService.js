'use strict';
/**
 * Read-only compatibility service for PHASE 2.
 * Do NOT treat this as a concurrency-safe award authorization.
 * PHASE 3 must create awards/inventory/spins atomically in a transaction.
 */
const User = require('../../authentication/models/User');
const Spin = require('../../games/models/Spin');
const PrizeAward = require('../models/PrizeAward');
const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');

async function getPrizeEligibility(userId, campaignId = CAMPAIGN_POLICY.campaignId) {
  const [user, recordedAward, legacyWin] = await Promise.all([
    User.findById(userId).select('emailVerified hasSpun').lean(),
    PrizeAward.findOne({ userId, campaignId }).select('_id spinId').lean(),
    Spin.findOne({ userId, status: 'won' }).select('_id').lean(),
  ]);
  if (!user) return { eligible: false, reason: 'USER_NOT_FOUND', gamesLocked: true };
  if (!user.emailVerified) return { eligible: false, reason: 'EMAIL_NOT_VERIFIED', gamesLocked: true };
  // Legacy hasSpun and historic Spin wins are conservative compatibility guards.
  // Future multi-campaign support must scope all guards by campaign.
  if (recordedAward || legacyWin || user.hasSpun) {
    return { eligible: false, reason: 'PRIZE_ALREADY_AWARDED', gamesLocked: true };
  }
  return { eligible: true, reason: null, gamesLocked: false };
}
module.exports = { getPrizeEligibility };
