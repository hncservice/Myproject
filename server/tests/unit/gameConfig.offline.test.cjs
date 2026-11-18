'use strict';
const assert = require('node:assert/strict');
const loadRegistry = require('./helpers/loadGameRegistry.cjs');
const load = (file, dependencies, environment) => loadRegistry(environment).config;
const config = load('config/gameConfig.js', {}, { GAME_CAMPAIGN_ID: 'synthetic-config-only' });
const cases = [
  ['registered games retain configuration and identity', () => {
    assert.deepEqual(Object.keys(config.GAMES), ['monkey', 'perfect-shot']);
    assert.equal(config.getGameConfig('monkey'), config.GAMES.monkey);
    assert.equal(config.getGameConfig('perfect-shot'), config.GAMES['perfect-shot']);
    assert.equal(config.GAMES.monkey.maxAttempts, 3);
    assert.equal(config.GAMES['perfect-shot'].totalShots, 5);
  }],
  ['unknown and inherited game names fail closed', () => {
    for (const name of ['unknown', 'constructor', '__proto__', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']) {
      assert.equal(config.getGameConfig(name), null, name);
    }
  }],
  ['non-string game identifiers fail closed without coercion', () => {
    for (const name of [undefined, null, 0, true, ['monkey'], { toString() { throw new Error('must not coerce'); } }]) {
      assert.equal(config.getGameConfig(name), null);
    }
  }],
  ['case and surrounding whitespace do not silently change identifiers', () => {
    for (const name of ['Monkey', 'MONKEY', ' monkey', 'perfect-shot ']) assert.equal(config.getGameConfig(name), null);
  }],
  ['configuration remains immutable', () => {
    assert.equal(Object.isFrozen(config.GAMES), true);
    assert.equal(Object.isFrozen(config.GAMES.monkey), true);
    assert.equal(Object.isFrozen(config.GAME_IDS), true);
    assert.equal(Object.isFrozen(config.CAMPAIGN_POLICY), true);
    assert.throws(() => { config.GAMES.monkey.maxAttempts = 99; });
  }],
  ['campaign uses only explicit synthetic environment', () => {
    assert.equal(config.CAMPAIGN_POLICY.campaignId, 'synthetic-config-only');
    assert.equal(load('config/gameConfig.js', {}).CAMPAIGN_POLICY.campaignId, 'legacy-hnc-campaign');
    assert.equal(config.CAMPAIGN_POLICY.maxPrizeAwardsPerUser, 1);
  }],
];
let passed = 0;
for (const [name, test] of cases) {
  try { test(); passed++; console.log('PASS: ' + name); }
  catch (error) { process.exitCode = 1; console.error('FAIL: ' + name + '\n' + error.stack); }
}
console.log(`RESULT: ${passed}/${cases.length} OFFLINE GAME CONFIGURATION CASES PASSED`);
