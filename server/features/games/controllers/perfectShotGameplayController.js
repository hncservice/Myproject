
'use strict';

const perfectShot = require('../engine/legacyGameEngine').perfectShot;

exports.nextShot = async (req, res, next) => {
  try {
    const result = await perfectShot.nextShot(
      req.user._id,
      req.body
    );

    return res.status(200).json({
      ...result,
      serverNow: Date.now(),
    });
  } catch (error) {
    return next(error);
  }
};

exports.shoot = async (req, res, next) => {
  try {
    const result = await perfectShot.shoot(
      req.user._id,
      req.body,
      req.perfectShotRouteEnteredMs
    );

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};