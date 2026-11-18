'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const USER = '111111111111111111111111';
const SESSION = '222222222222222222222222';
const AWARD = '333333333333333333333333';
const SPIN = '444444444444444444444444';
const ITEM = '555555555555555555555555';
const OTHER = '666666666666666666666666';
const CAMPAIGN = 'isolated-prize-details-test';
const TOKEN = 'a'.repeat(64);

let records;
let lookups;
let qrCalls;

function reset() {
  lookups = [];
  qrCalls = [];

  records = {
    decision: {
      userId: USER,
      gameSessionId: SESSION,
      campaignId: CAMPAIGN,
      status: 'prize_awarded',
      decision: 'PRIZE_AWARDED',
      prizeAwardId: AWARD,
      decidedAt: new Date(),
    },
    award: {
      _id: AWARD,
      userId: USER,
      gameSessionId: SESSION,
      campaignId: CAMPAIGN,
      spinId: null,
      redemptionSpinId: SPIN,
      wheelItemId: ITEM,
    },
    spin: {
      _id: SPIN,
      userId: USER,
      status: 'won',
      wheelItemId: {
        _id: ITEM,
        title: 'Test prize',
        description: 'Fixture only',
        imageUrl: null,
      },
      redemptionStatus: 'pending',
      qrToken: TOKEN,
      qrExpiry: new Date(Date.now() + 60000),
    },
  };
}

function model(name) {
  return {
    findOne(filter) {
      lookups.push({ name, filter });

      const query = {
        select() {
          return query;
        },
        populate() {
          return query;
        },
        async lean() {
          const record = records[name];

          if (!record) return null;

          const matches = Object.entries(filter).every(
            ([key, expected]) => {
              const actual = key === 'wheelItemId'
                ? record.wheelItemId?._id || record.wheelItemId
                : record[key];

              return String(actual) === String(expected);
            }
          );

          return matches ? record : null;
        },
      };

      return query;
    },
  };
}

const mocks = {
  mongoose: {
    isObjectIdOrHexString: value =>
      typeof value === 'string' &&
      /^[a-f0-9]{24}$/i.test(value),
  },
  '../models/PrizeDecision': model('decision'),
  '../models/PrizeAward': model('award'),
  '../../games/models/Spin': model('spin'),
  '../../../config/gameConfig': {
    CAMPAIGN_POLICY: { campaignId: CAMPAIGN },
  },
  './qrService': {
    async generateQrDataUrl(token) {
      qrCalls.push(token);
      return 'data:image/png;base64,TEST';
    },
  },
};

const filename = path.join(
  __dirname,
  '../features/prizes/services/prizeDecisionPrizeService.js'
);

const source = fs.readFileSync(filename, 'utf8');
const isolatedModule = { exports: {} };

const load = vm.runInNewContext(
  `(function(require, module, exports) {\n${source}\n})`,
  {},
  { filename }
);

load(
  name => {
    if (!Object.prototype.hasOwnProperty.call(mocks, name)) {
      throw new Error(`Unexpected dependency: ${name}`);
    }
    return mocks[name];
  },
  isolatedModule,
  isolatedModule.exports
);

const { getPrizeDecisionPrize } = isolatedModule.exports;

const read = () => getPrizeDecisionPrize({
  userId: USER,
  gameSessionId: SESSION,
});

async function rejected(code) {
  await assert.rejects(read, error => error.code === code);
  assert.equal(qrCalls.length, 0);
}

async function main() {
  let passed = 0;

  async function test(name, run) {
    reset();
    await run();
    passed++;
    console.log(`PASS: ${name}`);
  }

  await test('Owner receives this session prize and QR', async () => {
    const result = await read();

    assert.equal(result.gameSessionId, SESSION);
    assert.equal(result.prize.title, 'Test prize');
    assert.equal(result.qrDataUrl, 'data:image/png;base64,TEST');
    assert.equal(result.expired, false);
    assert.equal(qrCalls.length, 1);
    assert.equal(qrCalls[0], TOKEN);
    assert.equal('qrToken' in result, false);
  });

  await test('Malformed session rejected before lookup', async () => {
    await assert.rejects(
      () => getPrizeDecisionPrize({
        userId: USER,
        gameSessionId: 'invalid',
      }),
      error => error.code === 'INVALID_IDENTIFIERS'
    );

    assert.equal(lookups.length, 0);
    assert.equal(qrCalls.length, 0);
  });

  await test('Another customer cannot read the decision', async () => {
    records.decision.userId = OTHER;
    await rejected('DECISION_NOT_FOUND');
  });

  await test('Another session cannot supply the prize', async () => {
    records.decision.gameSessionId = OTHER;
    await rejected('DECISION_NOT_FOUND');
  });

  await test('Another campaign cannot supply the prize', async () => {
    records.decision.campaignId = 'other-campaign';
    await rejected('DECISION_NOT_FOUND');
  });

  await test('Nonwinning decision cannot return a QR', async () => {
    records.decision.status = 'pending_review';
    await rejected('PRIZE_NOT_AWARDED');
  });

  await test('Contradictory final decision is rejected', async () => {
    records.decision.decision = 'NO_PRIZE';
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Missing award link is rejected', async () => {
    records.decision.prizeAwardId = null;
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Award belonging to another customer is rejected', async () => {
    records.award.userId = OTHER;
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Award belonging to another session is rejected', async () => {
    records.award.gameSessionId = OTHER;
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Two award sources are rejected', async () => {
    records.award.spinId = OTHER;
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Missing redemption link is rejected', async () => {
    records.award.redemptionSpinId = null;
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Redemption record with wrong customer is rejected', async () => {
    records.spin.userId = OTHER;
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Redemption record with wrong prize is rejected', async () => {
    records.spin.wheelItemId._id = OTHER;
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Redeemed prize returns details without QR', async () => {
    records.spin.redemptionStatus = 'redeemed';

    const result = await read();

    assert.equal(result.prize.title, 'Test prize');
    assert.equal(result.redemptionStatus, 'redeemed');
    assert.equal(result.qrDataUrl, null);
    assert.equal(qrCalls.length, 0);
  });

  await test('Expired prize returns details without QR', async () => {
    records.spin.qrExpiry = new Date(Date.now() - 1000);

    const result = await read();

    assert.equal(result.expired, true);
    assert.equal(result.qrDataUrl, null);
    assert.equal(qrCalls.length, 0);
  });

  await test('Invalid expiry is rejected', async () => {
    records.spin.qrExpiry = 'invalid-date';
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  await test('Malformed QR token is rejected before rendering', async () => {
    records.spin.qrToken = 'invalid-token';
    await rejected('PRIZE_DETAILS_UNAVAILABLE');
  });

  console.log(
    `\nPRIZE DETAILS: PASS (${passed}/18)`
  );
  console.log(
    'Offline mocks only; no MongoDB connection, allocation, or real QR rendering.'
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});