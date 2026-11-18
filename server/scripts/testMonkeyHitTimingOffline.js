'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { mock } = require('node:test');

require('dotenv').config({ quiet: true });

const GameSession = require('../features/games/models/GameSession');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const { hit } = require('../features/games/services/monkeyGameplayService');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';

const token = crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(
    `${sessionId}:${userId}:${CAMPAIGN_POLICY.campaignId}:monkey`
  )
  .digest('hex');

const sessionTokenHash = crypto
  .createHash('sha256')
  .update(token)
  .digest('hex');

const body = {
  sessionId,
  sessionToken: token,
  round: 1,
  targetIndex: 3,
};

let passed = 0;

async function runCase(label, fromOffset, untilOffset, delayMs, expected) {
  mock.restoreAll();

  const base = Date.now();
  const session = {
    _id: sessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
    status: 'active',
    outcome: null,
    score: 0,
    sessionTokenHash,
    expiresAt: new Date(base + 60000),
    gameState: {
      revision: 1,
      round: 1,
      hits: 0,
      misses: 0,
      phase: 'visible',
      targetIndex: 3,
      visibleFrom: new Date(base + fromOffset),
      visibleUntil: new Date(base + untilOffset),
      nextRoundAt: null,
    },
  };

  let writes = 0;

  mock.method(GameSession, 'findOne', () => ({
    select: async () => {
      if (delayMs) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      return session;
    },
  }));

  mock.method(PrizeAward, 'exists', async () => null);

  mock.method(GameSession, 'findOneAndUpdate', async (_filter, update) => {
    writes += 1;

    return {
      ...session,
      ...update.$set,
      gameState: update.$set.gameState,
    };
  });

  let actual = 'ACCEPTED';

  try {
    await hit(userId, body);
  } catch (err) {
    actual = err.code || err.message;
  }

  assert.equal(actual, expected, `${label}: unexpected result`);
  assert.equal(writes, expected === 'ACCEPTED' ? 1 : 0);

  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

(async () => {
  assert.equal(process.env.ALLOCATION_ENABLED, 'false');

  try {
    await runCase('Valid hit', -500, 1500, 0, 'ACCEPTED');

    await runCase('Too-fast hit', 200, 2700, 0, 'TOO_FAST');

    await runCase('Late hit', -4000, -1000, 0, 'TOO_LATE');

    await runCase(
      'Database delay does not invalidate arrival time',
      -500,
      80,
      250,
      'ACCEPTED'
    );

    console.log(`RESULT: ${passed}/4 TESTS PASSED`);
  } finally {
    mock.restoreAll();
  }
})().catch(err => {
  mock.restoreAll();
  console.error('FAIL:', err.message);
  process.exitCode = 1;
});
