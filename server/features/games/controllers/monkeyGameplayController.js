'use strict';
const service = require('../engine/legacyGameEngine').monkey;
exports.nextRound = async (req, res, next) => {
  try { res.json(await service.nextRound(req.user._id, req.body)); } catch (e) { next(e); }
};
exports.hit = async (req, res, next) => {
  try { res.json(await service.hit(req.user._id, req.body)); } catch (e) { next(e); }
};
