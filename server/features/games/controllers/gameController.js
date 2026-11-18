'use strict';

const { getGameStatus, startGame, getCurrentSession, getHistory, completeSession } = require('../engine/legacyGameEngine');

exports.getStatus = async (req, res, next) => {
  try { return res.json(await getGameStatus(req.user._id)); }
  catch (error) { return next(error); }
};
exports.start = async (req, res, next) => {
  try {
    const session = await startGame(req.user._id, req.params.gameId);
    return res.status(session.resumed ? 200 : 201).json(session);
  } catch (error) { return next(error); }
};
exports.getSession = async (req, res, next) => {
  try { return res.json(await getCurrentSession(req.user._id, req.params.gameId)); }
  catch (error) { return next(error); }
};
exports.getHistory = async (req, res, next) => {
  try { return res.json(await getHistory(req.user._id, req.params.gameId, { limit: req.query.limit })); }
  catch (error) { return next(error); }
};
exports.complete = async (req, res, next) => {
  try {
    const result = await completeSession(req.user._id, req.params.gameId, req.body);
    return res.json(result);
  } catch (error) { return next(error); }
};
