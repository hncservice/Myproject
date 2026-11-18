'use strict';
const Joi = require('joi');
const GameSession = require('../../games/models/GameSession');
const Spin = require('../../games/models/Spin');
const AdminAuditLog = require('../models/AdminAuditLog');
const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');
const registry = require('../../games/registry/gameRegistry');

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  sort: Joi.string().valid('newest', 'oldest').default('newest'),
  q: Joi.string().trim().max(100).allow('').default(''),
}).unknown(false);
const literal = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const id = value => value == null ? null : String(value);

// Projections and explicit serializers prevent new model fields leaking into reports.
const definitions = {
  sessions: { model: GameSession, fields: 'userId campaignId gameId status outcome score startedAt expiresAt completedAt createdAt', search: ['gameId', 'status'],
    filter: () => ({ campaignId: CAMPAIGN_POLICY.campaignId }),
    serialize: r => ({ id: id(r._id), userId: id(r.userId), gameId: r.gameId, status: r.status, outcome: r.outcome, score: r.score, startedAt: r.startedAt, expiresAt: r.expiresAt, completedAt: r.completedAt }) },
  redemptions: { model: Spin, fields: 'userId wheelItemId redeemedByVendorId redemptionStatus redeemedAt createdAt', search: ['redemptionStatus'],
    filter: () => ({ redemptionStatus: 'redeemed' }),
    serialize: r => ({ id: id(r._id), userId: id(r.userId), prizeId: id(r.wheelItemId), vendorId: id(r.redeemedByVendorId), status: r.redemptionStatus, redeemedAt: r.redeemedAt }) },
  audit: { model: AdminAuditLog, fields: 'adminId action targetType targetId createdAt', search: ['action', 'targetType'], filter: () => ({}),
    serialize: r => ({ id: id(r._id), adminId: id(r.adminId), action: r.action, targetType: r.targetType, targetId: id(r.targetId), createdAt: r.createdAt }) },
};
for (const [name, definition] of Object.entries(definitions)) exports[name] = async (req, res) => {
  const { error, value } = querySchema.validate(req.query || {});
  if (error) return res.status(400).json({ code: 'INVALID_REPORT_QUERY', message: 'Invalid report parameters' });
  try {
    const filter = definition.filter();
    if (value.q) filter.$or = definition.search.map(field => ({ [field]: { $regex: literal(value.q), $options: 'i' } }));
    const direction = value.sort === 'oldest' ? 1 : -1;
    const [rows, total] = await Promise.all([
      definition.model.find(filter).select(definition.fields).sort({ createdAt: direction, _id: direction }).skip((value.page - 1) * value.limit).limit(value.limit).lean(),
      definition.model.countDocuments(filter),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({ items: rows.map(definition.serialize), total, page: value.page, pages: Math.max(1, Math.ceil(total / value.limit)) });
  } catch { return res.status(500).json({ message: 'Unable to load report' }); }
};
exports.configuration = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json({ readOnly: true, campaign: CAMPAIGN_POLICY, games: registry.discover() });
};
