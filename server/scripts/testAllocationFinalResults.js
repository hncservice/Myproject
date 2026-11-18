'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const Decision = require('../features/prizes/models/PrizeDecision');
const Award = require('../features/prizes/models/PrizeAward');
const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const id = () => new mongoose.Types.ObjectId().toHexString();
const ids = { user: id(), game: id(), prize: id(), admin: id() };
const session = {};
let state;
let flags;
let draws;
let passed = 0;

const plain = doc => doc.toObject({ flattenObjectIds: true });
const copy = value => structuredClone(value);

function query(value) {
  return {
    session(value) {
      assert.equal(value, session);
      return this;
    },
    lean() { return this; },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function writeOptions(options) {
  assert.equal(options.session, session);
}

function reset() {
  flags = {};
  draws = 0;
  state = {
    user: {
      _id: ids.user,
      emailVerified: true,
      hasSpun: false,
      prizeAllocationFence: 0,
    },
    game: {
      _id: ids.game,
      userId: ids.user,
      campaignId: CAMPAIGN_POLICY.campaignId,
      gameId: 'monkey',
      status: 'completed',
      outcome: 'qualified',
      gameState: {},
    },
    items: [{
      _id: ids.prize,
      title: 'Offline synthetic prize',
      isActive: true,
      probabilityWeight: 1,
      quantityTotal: 1,
      quantityAllocated: 0,
    }],
    spins: [],
    awards: [],
    decision: plain(new Decision({
      userId: ids.user,
      campaignId: CAMPAIGN_POLICY.campaignId,
      gameSessionId: ids.game,
      gameId: 'monkey',
      status: 'ready_for_draw',
      riskReasons: [],
    })),
  };
}

const mocks = {
  crypto: {
    randomBytes: crypto.randomBytes,
    randomInt(total) {
      draws++;
      return flags.forceNoPrize ? total - 1 : 0;
    },
  },
  mongoose: {
    isValidObjectId: mongoose.isValidObjectId,
    connection: {
      async transaction(callback) {
        const before = copy(state);
        try {
          const first = await callback(session);
          if (!flags.retryOnce) return first;

          // Discard the first simulated attempt and its result.
          state = copy(before);
          flags.retryOnce = false;
          flags.forceNoPrize = true;
          return await callback(session);
        } catch (error) {
          state = before;
          throw error;
        }
      },
    },
  },
  '../../../config/gameConfig': { CAMPAIGN_POLICY },
  '../../authentication/models/User': {
    findById: () => query(copy(state.user)),
    collection: {
      async updateOne(filter, update, options) {
        writeOptions(options);
        assert.equal(String(filter._id), ids.user);
        assert.equal(update.$inc.prizeAllocationFence, 1);
        state.user.prizeAllocationFence++;
        return { matchedCount: 1, modifiedCount: 1 };
      },
    },
    async updateOne(filter, update, options) {
      writeOptions(options);
      assert.equal(String(filter._id), ids.user);
      Object.assign(state.user, update.$set);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  },
  '../../games/models/GameSession': {
    findOne(filter) {
      assert.equal(String(filter._id), ids.game);
      assert.equal(String(filter.userId), ids.user);
      assert.equal(filter.campaignId, CAMPAIGN_POLICY.campaignId);
      assert.equal(filter.status, 'completed');
      assert.equal(filter.outcome, 'qualified');
      return query(copy(state.game));
    },
    async updateOne(filter, update, options) {
      writeOptions(options);
      assert.equal(String(filter._id), ids.game);
      assert.equal(filter['gameState.prizeDecision'].$exists, false);
      if (flags.sessionConflict || state.game.gameState.prizeDecision) {
        return { modifiedCount: 0 };
      }
      state.game.gameState.prizeDecision =
        copy(update.$set['gameState.prizeDecision']);
      return { modifiedCount: 1 };
    },
  },
  '../models/PrizeDecision': {
    findOne(filter) {
      assert.equal(String(filter.gameSessionId), ids.game);
      assert.equal(String(filter.userId), ids.user);
      assert.equal(filter.campaignId, CAMPAIGN_POLICY.campaignId);
      assert.equal(filter.gameId, 'monkey');

      const doc = new Decision(copy(state.decision));
      doc.save = async options => {
        writeOptions(options);
        await doc.validate();
        if (flags.saveFailure) throw new Error('FORCED_FINAL_SAVE_FAILURE');
        state.decision = plain(doc);
        return doc;
      };
      return query(doc);
    },
  },
  '../models/WheelItem': {
    find: () => query(copy(state.items)),
    async updateOne(filter, update, options) {
      writeOptions(options);
      assert.equal(String(filter._id), ids.prize);
      assert.equal(update.$inc.quantityAllocated, 1);
      assert.ok(filter.$expr);

      const item = state.items[0];
      if (
        flags.stockConflict ||
        item.quantityAllocated >= item.quantityTotal
      ) return { modifiedCount: 0 };

      item.quantityAllocated++;
      return { modifiedCount: 1 };
    },
  },
  '../../games/models/Spin': {
    async create(records, options) {
      writeOptions(options);
      const spin = { _id: id(), ...records[0] };
      state.spins.push(copy(spin));
      return [spin];
    },
  },
  '../models/PrizeAward': {
    findOne: () => query(state.awards[0] || null),
    async create(records, options) {
      writeOptions(options);
      const doc = new Award(records[0]);
      await doc.validate();
      const award = plain(doc);
      state.awards.push(award);
      return [award];
    },
  },
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
  { Buffer, Date, console, process: { env: { ALLOCATION_ENABLED: 'false' } } }
);

factory(name => {
  if (!Object.hasOwn(mocks, name)) {
    throw new Error(`Unexpected dependency: ${name}`);
  }
  return mocks[name];
}, isolated, isolated.exports);

const allocate = () => isolated.exports.testTransaction({
  userId: ids.user,
  gameSessionId: ids.game,
});

async function test(name, callback) {
  reset();
  await callback();
  passed++;
  console.log(`PASS: ${name}`);
}

async function expectRollback(expectedCode, expectedMessage) {
  const before = copy(state);
  await assert.rejects(allocate, error =>
    expectedCode
      ? error.code === expectedCode
      : error.message === expectedMessage
  );
  assert.deepEqual(state, before);
}

async function main() {
  await test('No Prize persists both results and cannot reroll', async () => {
    state.items = [];
    const result = await allocate();
    assert.equal(result.status, 'NO_PRIZE');
    assert.equal(state.decision.status, 'no_prize');
    assert.equal(state.decision.decision, 'NO_PRIZE');
    assert.equal(state.decision.prizeAwardId, null);
    assert.ok(state.decision.decidedAt);
    assert.equal(state.game.gameState.prizeDecision.result, 'NO_PRIZE');
    assert.equal(state.spins.length, 0);
    assert.equal(state.awards.length, 0);
    assert.equal(state.user.hasSpun, false);

    const beforeDraws = draws;
    assert.equal((await allocate()).status, 'ALREADY_RESOLVED');
    assert.equal(draws, beforeDraws);
  });

  await test('Winning result saves one source and a redemption link', async () => {
    const result = await allocate();
    assert.equal(result.status, 'PRIZE_AWARDED');
    assert.equal(state.decision.status, 'prize_awarded');
    assert.equal(state.decision.decision, 'PRIZE_AWARDED');
    assert.equal(state.awards.length, 1);
    assert.equal(state.spins.length, 1);
    assert.equal(state.awards[0].spinId, null);
    assert.equal(state.awards[0].gameSessionId, ids.game);
    assert.equal(state.awards[0].redemptionSpinId, state.spins[0]._id);
    assert.equal(state.decision.prizeAwardId, state.awards[0]._id);
    assert.equal(state.game.gameState.prizeDecision.result, 'PRIZE_AWARDED');
    assert.equal(String(state.game.gameState.prizeDecision.awardId), state.awards[0]._id);
    assert.equal(state.items[0].quantityAllocated, 1);
    assert.equal(state.user.hasSpun, true);

    const beforeDraws = draws;
    assert.equal((await allocate()).status, 'ALREADY_RESOLVED');
    assert.equal(draws, beforeDraws);
    assert.equal(state.awards.length, 1);
  });

  await test('Final result preserves administrator review metadata', async () => {
    state.decision.status = 'approved';
    state.decision.reviewedByAdminId = ids.admin;
    state.decision.reviewedAt = new Date();
    state.decision.riskReasons = ['SYNTHETIC_REVIEWED_RISK'];
    await allocate();
    assert.equal(state.decision.reviewedByAdminId, ids.admin);
    assert.ok(state.decision.reviewedAt);
    assert.deepEqual(state.decision.riskReasons, ['SYNTHETIC_REVIEWED_RISK']);
  });

  await test('No Prize save failure rolls back simulated writes', async () => {
    state.items = [];
    flags.saveFailure = true;
    await expectRollback(null, 'FORCED_FINAL_SAVE_FAILURE');
  });

  await test('Award save failure rolls back all simulated writes', async () => {
    flags.saveFailure = true;
    await expectRollback(null, 'FORCED_FINAL_SAVE_FAILURE');
  });

  await test('Stock conflict leaves no partial result', async () => {
    flags.stockConflict = true;
    await expectRollback('STOCK_CONFLICT');
  });

  await test('Session update conflict leaves no partial award', async () => {
    flags.sessionConflict = true;
    await expectRollback('DECISION_CONFLICT');
  });

  await test('Returned result belongs to the committed retry', async () => {
    flags.retryOnce = true;
    const result = await allocate();
    assert.equal(draws, 2);
    assert.equal(result.status, 'NO_PRIZE');
    assert.equal(state.decision.status, 'no_prize');
    assert.equal(state.spins.length, 0);
    assert.equal(state.awards.length, 0);
    assert.equal(state.items[0].quantityAllocated, 0);
    assert.equal(state.user.prizeAllocationFence, 1);
  });

  await assert.rejects(
    () => isolated.exports.allocatePrize({ userId: ids.user, gameSessionId: ids.game }),
    error => error.code === 'PRIZE_ALLOCATION_DISABLED'
  );
  assert.equal(mongoose.connection.readyState, 0);

  console.log(`\nFINAL ALLOCATION RESULTS: PASS (${passed}/8)`);
  console.log('Offline mocks only; rollback and retries are simulated.');
  console.log('Public allocation remains disabled; no MongoDB connection.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
