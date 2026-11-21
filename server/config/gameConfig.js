'use strict';

const LEGACY_CAMPAIGN_ID =
  process.env.GAME_CAMPAIGN_ID || 'legacy-hnc-campaign';

const MANAGED_CAMPAIGN_ID =
  process.env.HNC_MANAGED_CAMPAIGN_ID?.trim() || null;

if (MANAGED_CAMPAIGN_ID && (
  !/^[a-z][a-z0-9-]{2,63}$/.test(MANAGED_CAMPAIGN_ID) ||
  MANAGED_CAMPAIGN_ID === LEGACY_CAMPAIGN_ID
)) {
  throw new Error('HNC_MANAGED_CAMPAIGN_ID must identify a separate managed campaign.');
}

const GAME_IDS = Object.freeze({ MONKEY: 'monkey', PERFECT_SHOT: 'perfect-shot', BURGER_RUN: 'burger-run' });
const gameRegistry = require('../features/games/registry/gameRegistry');
const GAMES = Object.freeze(Object.fromEntries(
  gameRegistry.list().map(game => [game.id, game.config])
));

const CAMPAIGN_POLICY = Object.freeze({
  campaignId: MANAGED_CAMPAIGN_ID || LEGACY_CAMPAIGN_ID,
  maxPrizeAwardsPerUser: 1,
});

function getGameConfig(gameId) {
  return typeof gameId === 'string' && Object.hasOwn(GAMES, gameId)
    ? GAMES[gameId]
    : null;
}

module.exports = {
  CAMPAIGN_POLICY,
  LEGACY_CAMPAIGN_ID,
  MANAGED_CAMPAIGN_ID,
  GAME_IDS,
  GAMES,
  getGameConfig,
};
