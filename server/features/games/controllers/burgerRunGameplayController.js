'use strict';
const game = require('../engine/legacyGameEngine');
for (const action of ['prepare', 'finish']) exports[action] = async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store'); return res.json(await game.burgerRun[action](req.user._id, req.body)); }
  catch (error) { return next(error); }
};
