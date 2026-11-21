'use strict';
const { createLegacyGameEngine } = require('./legacyGameEngineFactory');
module.exports = createLegacyGameEngine({
  registry: require('../registry/gameRegistry'),
  sessions: require('../services/gameSessionService'), start: require('../services/gameStartService'), status: require('../services/gameStatusService'),
  burgerRun: require('../services/burgerRunGameplayService'),
  monkey: require('../services/monkeyGameplayService'), perfectShot: require('../services/perfectShotGameplayService'),
});
