
'use strict';

require('dotenv').config();

const crypto = require('crypto');
const mongoose = require('mongoose');

const GameSession = require('../features/games/models/GameSession');
const PrizeAward = require('../features/prizes/models/PrizeAward');

const monkey = require('../features/games/services/monkeyGameplayService');
const perfectShot = require('../features/games/services/perfectShotGameplayService');

const { CAMPAIGN_POLICY } = require('../config/gameConfig');

// All database methods used during this test are mocked.
// No MongoDB connection is opened.

const originalFindOne = GameSession.findOne;
const originalAwardExists = PrizeAward.exists;
const originalSecret = process.env.JWT_SECRET;

process.env.JWT_SECRET =
  'hnc-isolated-prize-lock-test-secret';

const userId = new mongoose.Types.ObjectId();

let awardChecks = 0;

function makeSession(gameId) {
  const session = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId,
    status: 'active',
    expiresAt: new Date(Date.now() + 120000),
    gameState: null,
  };

  const sessionToken = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(
      `${session._id}:${session.userId}:${session.campaignId}:${session.gameId}`
    )
    .digest('hex');

  session.sessionTokenHash = crypto
    .createHash('sha256')
    .update(sessionToken)
    .digest('hex');

  return {
    session,
    credentials: {
      sessionId: String(session._id),
      sessionToken,
    },
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const monkeyData = makeSession('monkey');
  const shotData = makeSession('perfect-shot');

  GameSession.findOne = function (filter) {
    const selected =
      filter.gameId === 'monkey'
        ? monkeyData.session
        : shotData.session;

    return {
      select: async () => selected,
    };
  };

  // Simulate an already-issued prize.
  PrizeAward.exists = async () => {
    awardChecks++;
    return { _id: new mongoose.Types.ObjectId() };
  };

  async function test(name, action) {
    try {
      await action();

      failed++;
      console.log('FAIL:', name, '- gameplay was allowed');
    } catch (err) {
      if (
        err.status === 409 &&
        err.code === 'PRIZE_ALREADY_AWARDED'
      ) {
        passed++;
        console.log('PASS:', name);
      } else {
        failed++;
        console.log('FAIL:', name, {
          status: err.status,
          code: err.code,
          message: err.message,
        });
      }
    }
  }

  await test('Monkey next round', () =>
    monkey.nextRound(userId, monkeyData.credentials)
  );

  await test('Monkey hit', () =>
    monkey.hit(userId, {
      ...monkeyData.credentials,
      round: 1,
      targetIndex: 0,
    })
  );

  await test('Perfect Shot next shot', () =>
    perfectShot.nextShot(userId, shotData.credentials)
  );

  await test('Perfect Shot shoot', () =>
    perfectShot.shoot(userId, {
      ...shotData.credentials,
      shot: 1,
      x: 50,
      y: 50,
    })
  );

  console.log('\nHNC PRIZE-LOCK TEST RESULTS');
  console.table({
    passed,
    failed,
    awardChecks,
  });

  const success =
    passed === 4 &&
    failed === 0 &&
    awardChecks === 4;

  console.log(
    success
      ? 'HNC PRIZE-LOCK TEST: PASS'
      : 'HNC PRIZE-LOCK TEST: FAIL'
  );

  if (!success) {
    process.exitCode = 1;
  }
}

main()
  .catch(err => {
    console.error('TEST ERROR:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    GameSession.findOne = originalFindOne;
    PrizeAward.exists = originalAwardExists;

    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });
