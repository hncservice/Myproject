'use strict';

const mongoose = require('mongoose');

const PrizeDecision = require('../models/PrizeDecision');
const PrizeAward = require('../models/PrizeAward');
const Spin = require('../../games/models/Spin');

const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');
const { generateQrDataUrl } = require('./qrService');

function fail(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    statusCode: status,
    code,
  });
}

function sameId(left, right) {
  return left != null &&
    right != null &&
    String(left) === String(right);
}

function unavailable() {
  return fail(
    503,
    'PRIZE_DETAILS_UNAVAILABLE',
    'Prize details are unavailable'
  );
}

async function getPrizeDecisionPrize({
  userId,
  gameSessionId,
}) {
  if (
    !mongoose.isObjectIdOrHexString(userId) ||
    typeof gameSessionId !== 'string' ||
    !/^[a-f0-9]{24}$/i.test(gameSessionId)
  ) {
    throw fail(
      400,
      'INVALID_IDENTIFIERS',
      'Invalid customer or game session ID'
    );
  }

  const decision = await PrizeDecision.findOne({
    userId,
    gameSessionId,
    campaignId: CAMPAIGN_POLICY.campaignId,
  })
    .select(
      'userId gameSessionId campaignId status decision prizeAwardId decidedAt'
    )
    .lean();

  if (!decision) {
    throw fail(
      404,
      'DECISION_NOT_FOUND',
      'Prize decision not found'
    );
  }

  if (decision.status !== 'prize_awarded') {
    throw fail(
      409,
      'PRIZE_NOT_AWARDED',
      'This session has no awarded prize'
    );
  }

  if (
    decision.decision !== 'PRIZE_AWARDED' ||
    !decision.decidedAt ||
    !decision.prizeAwardId
  ) {
    throw unavailable();
  }

  const award = await PrizeAward.findOne({
    _id: decision.prizeAwardId,
    userId,
    gameSessionId: decision.gameSessionId,
    campaignId: decision.campaignId,
  })
    .select(
      'userId gameSessionId spinId redemptionSpinId wheelItemId'
    )
    .lean();

  if (
    !award ||
    award.spinId != null ||
    !award.redemptionSpinId ||
    !award.wheelItemId
  ) {
    throw unavailable();
  }

  const spin = await Spin.findOne({
    _id: award.redemptionSpinId,
    userId,
    wheelItemId: award.wheelItemId,
    status: 'won',
  })
    .populate(
      'wheelItemId',
      'title description imageUrl'
    )
    .lean();

  if (
    !spin ||
    !sameId(spin.userId, userId) ||
    !sameId(spin.wheelItemId?._id, award.wheelItemId) ||
    typeof spin.wheelItemId.title !== 'string' ||
    !['pending', 'redeemed'].includes(spin.redemptionStatus)
  ) {
    throw unavailable();
  }

  const expiryMs = spin.qrExpiry == null
    ? null
    : new Date(spin.qrExpiry).getTime();

  if (
    expiryMs !== null &&
    !Number.isFinite(expiryMs)
  ) {
    throw unavailable();
  }

  const expired =
    expiryMs !== null &&
    expiryMs <= Date.now();

  const redeemable =
    spin.redemptionStatus === 'pending' &&
    !expired;

  if (
    redeemable &&
    (
      typeof spin.qrToken !== 'string' ||
      !/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/i.test(spin.qrToken)
    )
  ) {
    throw unavailable();
  }

  const qrDataUrl = redeemable
    ? await generateQrDataUrl(spin.qrToken)
    : null;

  return {
    gameSessionId: String(decision.gameSessionId),
    prize: {
      title: spin.wheelItemId.title,
      description: spin.wheelItemId.description || '',
      imageUrl: spin.wheelItemId.imageUrl || null,
    },
    redemptionStatus: spin.redemptionStatus,
    qrExpiry: spin.qrExpiry || null,
    expired,
    qrDataUrl,
  };
}

module.exports = { getPrizeDecisionPrize };