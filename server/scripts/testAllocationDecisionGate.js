'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const userId = new mongoose.Types.ObjectId();
const gameId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

let decision;
let fence = 0;
let awardChecks = 0;
let passed = 0;

function query(value) {
  return {
    session() { return this; },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

const STOP = 'OFFLINE_GATE_ACCEPTED';

const mocks = {
  crypto,
  mongoose: {
    isValidObjectId: mongoose.isValidObjectId,
    connection: {
      transaction: async callback => {
        const before = fence;
        try {
          return await callback({});
        } catch (error) {
          fence = before;
          throw error;
        }
      },
    },
  },
  '../../../config/gameConfig': { CAMPAIGN_POLICY },
  '../../authentication/models/User': {
    findById: () => query({
      _id: userId,
      emailVerified: true,
    }),
    collection: {
      updateOne: async () => {
        fence++;
        return { matchedCount: 1, modifiedCount: 1 };
      },
    },
  },
  '../../games/models/GameSession': {
    findOne: () => query({
      _id: gameId,
      userId,
      campaignId: CAMPAIGN_POLICY.campaignId,
      gameId: 'monkey',
      status: 'completed',
      outcome: 'qualified',
      gameState: {},
    }),
  },
  '../models/PrizeDecision': {
    findOne: filter => {
      assert.equal(String(filter.gameSessionId), String(gameId));
      assert.equal(String(filter.userId), String(userId));
      assert.equal(filter.campaignId, CAMPAIGN_POLICY.campaignId);
      assert.equal(filter.gameId, 'monkey');
      return query(decision);
    },
  },
  '../models/PrizeAward': {
    findOne: () => {
      awardChecks++;
      throw new Error(STOP);
    },
  },
  '../models/WheelItem': {},
  '../../games/models/Spin': {},
};

const source = fs.readFileSync(
  path.join(__dirname, '../features/prizes/services/prizeAllocationService.js'),
  'utf8'
);

assert.match(source, /const ALLOCATION_ENABLED = false;/);

const isolated = { exports: {} };
const factory = vm.runInNewContext(
  `(function(require,module,exports){${source}
module.exports.testTransaction = performAllocationTransaction;
})`,
  { Buffer, Date, console, process: { env: { ALLOCATION_ENABLED: 'false' } } },
  { filename: 'offline-prizeAllocationService.js' }
);

factory(name => {
  if (!Object.hasOwn(mocks, name)) {
    throw new Error(`Unexpected dependency: ${name}`);
  }
  return mocks[name];
}, isolated, isolated.exports);

function document(overrides = {}) {
  return new PrizeDecision({
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameSessionId: gameId,
    gameId: 'monkey',
    status: 'ready_for_draw',
    riskReasons: [],
    ...overrides,
  });
}

async function check(name, doc, expected) {
  decision = doc;
  fence = 0;
  awardChecks = 0;

  await assert.rejects(
    () => isolated.exports.testTransaction({
      userId,
      gameSessionId: gameId,
    }),
    error => expected === STOP
      ? error.message === STOP
      : error.code === expected
  );

  assert.equal(awardChecks, expected === STOP ? 1 : 0);
  assert.equal(fence, 0);
  passed++;
  console.log(`PASS: ${name}`);
}

async function main() {
  await check(
    'Missing decision blocked',
    null,
    'PRIZE_DECISION_REQUIRED'
  );
  await check(
    'Pending review blocked',
    document({ status: 'pending_review' }),
    'PRIZE_DECISION_NOT_DRAWABLE'
  );
  await check(
    'Rejected review blocked',
    document({
      status: 'rejected',
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
    }),
    'PRIZE_DECISION_NOT_DRAWABLE'
  );
  await check(
    'Ready decision with risk reasons blocked',
    document({ riskReasons: ['SYNTHETIC_RISK'] }),
    'INVALID_PRIZE_DECISION'
  );
  await check(
    'Approval without administrator details blocked',
    document({ status: 'approved' }),
    'INVALID_PRIZE_DECISION'
  );
  await check(
    'Clean ready decision reaches next eligibility check',
    document(),
    STOP
  );
  await check(
    'Valid administrator approval reaches next eligibility check',
    document({
      status: 'approved',
      reviewedByAdminId: adminId,
      reviewedAt: new Date(),
      riskReasons: ['SYNTHETIC_REVIEWED_RISK'],
    }),
    STOP
  );

  await assert.rejects(
    () => isolated.exports.allocatePrize({ userId, gameSessionId: gameId }),
    error => error.code === 'PRIZE_ALLOCATION_DISABLED'
  );
  assert.equal(mongoose.connection.readyState, 0);

  console.log(`\nDECISION GATE: PASS (${passed}/7)`);
  console.log('Public allocation disabled; no database connection or prizes.');
  console.log('Stops before draw; transaction rollback is simulated.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
