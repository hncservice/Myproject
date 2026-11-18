'use strict';

const Joi = require('joi');
const GameSession = require('../../games/models/GameSession');
const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');
const { reviewEvidence } = require('../../prizes/services/prizeReviewEvidenceService');

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(25).default(20),
  gameId: Joi.string().valid('all', 'monkey', 'perfect-shot').default('all'),
  q: Joi.string().trim().max(100).allow('').default(''),
}).unknown(false);

// The evidence service needs internal gameplay fields. Only the summaries below leave the server.
const fields = 'userId campaignId gameId attemptNumber status outcome score startedAt expiresAt completedAt gameState events';

function codes(values) {
  if (!Array.isArray(values)) return [];
  return values.filter(value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,99}$/.test(value));
}

function serialize(session) {
  const evidence = session.status === 'completed' ? reviewEvidence(session) : null;
  const assessmentAvailable = evidence?.availability === 'available'
    && typeof evidence.integrity?.reviewRequired === 'boolean'
    && typeof evidence.behavior?.reviewSuggested === 'boolean'
    && Array.isArray(evidence.integrity?.riskReasons)
    && Array.isArray(evidence.behavior?.signals);

  return {
    sessionId: String(session._id),
    campaignId: session.campaignId,
    gameId: session.gameId,
    status: session.status,
    outcome: session.outcome,
    score: session.score,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    assessmentAvailable,
    integrity: assessmentAvailable ? {
      reviewRequired: evidence.integrity.reviewRequired,
      riskReasons: codes(evidence.integrity.riskReasons),
    } : null,
    behavior: assessmentAvailable ? {
      reviewSuggested: evidence.behavior.reviewSuggested,
      signals: codes(evidence.behavior.signals),
    } : null,
  };
}

exports.list = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { error, value } = querySchema.validate(req.query || {});
  if (error) {
    return res.status(400).json({ code: 'INVALID_REPORT_QUERY', message: 'Invalid report parameters' });
  }

  const { page, limit, gameId, q } = value;
  const campaignId = CAMPAIGN_POLICY.campaignId;
  const filter = { campaignId };
  if (gameId !== 'all') filter.gameId = gameId;
  const queryIsSessionId = /^[a-f0-9]{24}$/i.test(q);
  if (queryIsSessionId) filter._id = q;
  const campaignMatches = !q || campaignId.toLowerCase().includes(q.toLowerCase());

  try {
    if (!queryIsSessionId && !campaignMatches) {
      return res.json({ items: [], total: 0, page, pages: 1 });
    }
    const [sessions, total] = await Promise.all([
      GameSession.find(filter)
        .select(fields)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      GameSession.countDocuments(filter),
    ]);
    return res.json({
      items: sessions.map(serialize),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch {
    return res.status(500).json({ message: 'Unable to load gameplay monitoring' });
  }
};
