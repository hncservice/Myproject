'use strict';

const perfectShot = require('../engine/legacyGameEngine').perfectShot;
const { responseTiming } = require('../middleware/perfectShotRequestTiming');

function sendTimed(req, res, payload) {
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ ...payload, ...responseTiming(req) });
}

// Protected by authUser in gameRoutes. This reads timing only and consumes no attempt.
exports.timing = (req, res) => sendTimed(req, res, { ok: true });

// Same-path preflight warm-up for the real actions. Never enters the engine.
function probe(req, res) {
  if (Array.isArray(req.body) || Object.keys(req.body).length !== 1) {
    return res.status(400).json({ code: 'INVALID_TIMING_PROBE', message: 'Invalid timing probe' });
  }
  return sendTimed(req, res, { ok: true });
}

exports.nextShot = async (req, res, next) => {
  try {
    if (req.body?.timingProbe === true) return probe(req, res);
    const result = await perfectShot.nextShot(req.user._id, req.body);
    return sendTimed(req, res, result);
  } catch (error) {
    return next(error);
  }
};

exports.shoot = async (req, res, next) => {
  try {
    if (req.body?.timingProbe === true) return probe(req, res);
    const result = await perfectShot.shoot(
      req.user._id,
      req.body,
      req.perfectShotRouteEnteredMs
    );
    return sendTimed(req, res, result);
  } catch (error) {
    return next(error);
  }
};
