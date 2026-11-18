'use strict';

const mongoose = require('mongoose');
const PrizeDecision = require('../models/PrizeDecision');
const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');

function fail(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

const MESSAGES = Object.freeze({
  pending_review: 'Your game result is awaiting review.',
  ready_for_draw: 'Your game result is ready for the prize draw.',
  approved: 'Your game result has been approved for the prize draw.',
  rejected: 'Your game result was not approved.',
  no_prize: 'The prize draw is complete. No prize was awarded.',
  prize_awarded: 'The prize draw is complete. You won a prize.',
});

async function getPrizeDecisionStatus({ userId, gameSessionId }) {
  if (
    !mongoose.isObjectIdOrHexString(userId) ||
    typeof gameSessionId !== 'string' ||
    !/^[a-f0-9]{24}$/i.test(gameSessionId)
  ) {
    throw fail(400, 'INVALID_IDENTIFIERS', 'Invalid customer or game session ID');
  }

  const decision = await PrizeDecision.findOne({
    userId,
    gameSessionId,
    campaignId: CAMPAIGN_POLICY.campaignId,
  })
    .select(
      '_id gameSessionId campaignId gameId status decision decidedAt'
    )
    .lean();

  if (!decision) {
    throw fail(404, 'DECISION_NOT_FOUND', 'Prize decision not found');
  }

  if (!Object.prototype.hasOwnProperty.call(MESSAGES, decision.status)) {
    throw fail(503, 'INVALID_DECISION_STATE', 'Prize status is unavailable');
  }

  const finalResult =
    decision.status === 'no_prize' ||
    decision.status === 'prize_awarded';

  if (
    (decision.status === 'no_prize' &&
      decision.decision !== 'NO_PRIZE') ||
    (decision.status === 'prize_awarded' &&
      decision.decision !== 'PRIZE_AWARDED') ||
    (finalResult && !decision.decidedAt) ||
    (!finalResult &&
      (decision.decision != null || decision.decidedAt != null))
  ) {
    throw fail(503, 'INVALID_DECISION_STATE', 'Prize status is unavailable');
  }

  return {
    decisionId: String(decision._id),
    gameSessionId: String(decision.gameSessionId),
    campaignId: decision.campaignId,
    gameId: decision.gameId,
    status: decision.status,
    message: MESSAGES[decision.status],
    drawExecuted: finalResult,
    prizeAllocated: decision.status === 'prize_awarded',
    decidedAt: decision.decidedAt || null,
  };
}

module.exports = { getPrizeDecisionStatus };
