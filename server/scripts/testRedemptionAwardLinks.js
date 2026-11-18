'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ids = {
  user: '111111111111111111111111',
  vendor: '222222222222222222222222',
  prize: '333333333333333333333333',
  spin: '444444444444444444444444',
  game: '555555555555555555555555',
  other: '666666666666666666666666',
};

let state;
let passed = 0;

function query(value) {
  return {
    session() { return this; },
    select() { return this; },
    limit(value) {
      assert.equal(value, 2);
      return this;
    },
    async lean() { return value; },
  };
}

function reset() {
  state = {
    vendor: { _id: ids.vendor, name: 'Synthetic vendor', redemptionFence: 0 },
    spin: {
      _id: ids.spin,
      userId: ids.user,
      wheelItemId: ids.prize,
      status: 'won',
      redemptionStatus: 'pending',
      qrExpiry: new Date(Date.now() + 60000),
    },
    prize: {
      _id: ids.prize,
      title: 'Synthetic prize',
      quantityAllocated: 1,
      quantityRedeemed: 0,
    },
    awards: [],
  };
}

function award(extra = {}) {
  return {
    userId: ids.user,
    wheelItemId: ids.prize,
    spinId: null,
    gameSessionId: null,
    redemptionSpinId: null,
    ...extra,
  };
}

const models = {
  Spin: {
    findOne: () => query(state.spin),
    updateOne: async () => {
      state.spin.redemptionStatus = 'redeemed';
      return { modifiedCount: 1 };
    },
  },
  WheelItem: {
    findById: () => query(state.prize),
    updateOne: async () => {
      if (state.prize.quantityAllocated <= state.prize.quantityRedeemed) {
        return { modifiedCount: 0 };
      }
      state.prize.quantityRedeemed++;
      return { modifiedCount: 1 };
    },
  },
  User: {
    findById: () => query({
      _id: ids.user,
      name: 'Synthetic customer',
      email: 'test@sandbox.invalid',
    }),
  },
  Vendor: {
    findOneAndUpdate: async () => {
      state.vendor.redemptionFence++;
      return state.vendor;
    },
  },
  PrizeAward: {
    find: filter => {
      assert.equal(filter.$or.length, 2);
      assert.equal(filter.$or[0].spinId, ids.spin);
      assert.equal(filter.$or[1].redemptionSpinId, ids.spin);
      const matches = state.awards.filter(item =>
        item.spinId === ids.spin || item.redemptionSpinId === ids.spin
      );
      return query(matches.slice(0, 2));
    },
  },
};

const mongooseStub = {
  isValidObjectId: value => /^[a-f0-9]{24}$/i.test(String(value)),
  connection: {
    readyState: 1,
    transaction: async callback => {
      const before = structuredClone(state);
      try {
        return await callback({});
      } catch (error) {
        state = before;
        throw error;
      }
    },
  },
};

const mocks = {
  mongoose: mongooseStub,
  '../../games/models/Spin': models.Spin,
  '../models/WheelItem': models.WheelItem,
  '../../authentication/models/User': models.User,
  '../models/PrizeAward': models.PrizeAward,
  '../../vendors/models/Vendor': models.Vendor,
};

const source = fs.readFileSync(
  path.join(__dirname, '../features/prizes/services/prizeRedemptionService.js'),
  'utf8'
);

const isolatedModule = { exports: {} };
const factory = vm.runInNewContext(
  `(function(require,module,exports){${source}\n})`,
  { Date, console },
  { filename: 'prizeRedemptionService.js' }
);

factory(name => {
  if (!Object.hasOwn(mocks, name)) {
    throw new Error(`Unexpected dependency: ${name}`);
  }
  return mocks[name];
}, isolatedModule, isolatedModule.exports);

const { redeemPrize } = isolatedModule.exports;
const redeem = () => redeemPrize({
  qrToken: 'a'.repeat(64),
  vendorId: ids.vendor,
  tokenVersion: 0,
});

async function check(name, setup, expectedError = null) {
  reset();
  setup();

  if (expectedError) {
    await assert.rejects(redeem, error => error.code === expectedError);
    assert.equal(state.spin.redemptionStatus, 'pending');
    assert.equal(state.prize.quantityRedeemed, 0);
    assert.equal(state.vendor.redemptionFence, 0);
  } else {
    const result = await redeem();
    assert.equal(result.spinId, ids.spin);
    assert.equal(state.spin.redemptionStatus, 'redeemed');
    assert.equal(state.prize.quantityRedeemed, 1);
    assert.equal(state.vendor.redemptionFence, 1);
  }

  passed++;
  console.log(`PASS: ${name}`);
}

async function main() {
  await check('Legacy Spin award redeems', () => {
    state.awards = [award({ spinId: ids.spin })];
  });

  await check('Game award redeems through redemptionSpinId', () => {
    state.awards = [award({
      gameSessionId: ids.game,
      redemptionSpinId: ids.spin,
    })];
  });

  await check('Wrong customer rejected', () => {
    state.awards = [award({
      gameSessionId: ids.game,
      redemptionSpinId: ids.spin,
      userId: ids.other,
    })];
  }, 'AWARD_MISMATCH');

  await check('Wrong prize rejected', () => {
    state.awards = [award({
      gameSessionId: ids.game,
      redemptionSpinId: ids.spin,
      wheelItemId: ids.other,
    })];
  }, 'AWARD_MISMATCH');

  await check('Two award sources rejected', () => {
    state.awards = [award({
      spinId: ids.spin,
      gameSessionId: ids.game,
    })];
  }, 'AWARD_MISMATCH');

  await check('Legacy award with extra redemption link rejected', () => {
    state.awards = [award({
      spinId: ids.spin,
      redemptionSpinId: ids.spin,
    })];
  }, 'AWARD_MISMATCH');

  await check('Ambiguous cross-field award links rejected', () => {
    state.awards = [
      award({ spinId: ids.spin }),
      award({ gameSessionId: ids.game, redemptionSpinId: ids.spin }),
    ];
  }, 'AWARD_MISMATCH');

  await check('Inventory failure rolls back simulated writes', () => {
    state.awards = [award({
      gameSessionId: ids.game,
      redemptionSpinId: ids.spin,
    })];
    state.prize.quantityAllocated = 0;
  }, 'INVENTORY_RECONCILIATION_REQUIRED');

  console.log(`\nAWARD LINK TESTS: PASS (${passed}/8)`);
  console.log('Offline mocks only; rollback simulated, not MongoDB-verified.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
