
'use strict';

// HNC Step 15K
// Tests actual prize allocation transactions in a sandbox.
// Never starts the application server or enables public allocation.

require('dotenv').config();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const { CAMPAIGN_POLICY } = require('../config/gameConfig');
const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const WheelItem = require('../features/prizes/models/WheelItem');
const Spin = require('../features/games/models/Spin');
const PrizeAward = require('../features/prizes/models/PrizeAward');

const DB_NAME = 'hnc_step15k_sandbox';

const uri =
  process.env.HNC_SANDBOX_MONGO_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;

const runId = crypto.randomUUID();

const created = {
  users: [],
  gamesessions: [],
  wheelitems: [],
  spins: [],
  prizeawards: [],
};

const campaignId = CAMPAIGN_POLICY.campaignId;

let allocation;

function loadPrivateTransaction() {
  const file = path.resolve(
    __dirname,
    '../features/prizes/services/prizeAllocationService.js'
  );

  let source = fs.readFileSync(file, 'utf8');

  if (
    !source.includes('const ALLOCATION_ENABLED = false;') ||
    !source.includes(
      'async function performAllocationTransaction('
    ) ||
    !source.includes('prizeAllocationFence')
  ) {
    throw new Error(
      'Unexpected allocation service or allocation is not disabled'
    );
  }

  // Expose the private transaction only inside this test process.
  // The original service file is not modified.
  source += `
module.exports.__sandboxTransaction =
  performAllocationTransaction;
`;

  const mod = new Module(file, module);

  mod.filename = file;
  mod.paths = Module._nodeModulePaths(
    path.dirname(file)
  );

  mod._compile(source, file);

  return mod.exports;
}

function remember(model, doc) {
  created[model.collection.name].push(doc._id);
  return doc;
}

async function createUser() {
  return remember(
    User,
    await User.create({
      name: 'Step15K Fixture',
      email:
        `step15k-${runId}-${crypto.randomUUID()}@example.invalid`,
      passwordHash: 'test-not-a-real-password',
      emailVerified: true,
    })
  );
}

async function createGame(
  user,
  gameId = 'monkey',
  attemptNumber = 1
) {
  return remember(
    GameSession,
    await GameSession.create({
      userId: user._id,
      campaignId,
      gameId,
      attemptNumber,

      sessionTokenHash:
        crypto.randomBytes(32).toString('hex'),

      status: 'completed',
      outcome: 'qualified',
      score: gameId === 'monkey' ? 7 : 400,

      startedAt: new Date(Date.now() - 5000),
      expiresAt: new Date(Date.now() + 60000),
      completedAt: new Date(),

      gameState: {
        revision: 1,
      },
    })
  );
}

async function createPrize(quantityTotal = 1) {
  return remember(
    WheelItem,
    await WheelItem.create({
      title: `Step15K ${runId}`,
      probabilityWeight: 100000000,
      quantityTotal,
      quantityAllocated: 0,
      quantityRedeemed: 0,
      isActive: true,
    })
  );
}

async function awardsFor(user) {
  return PrizeAward.find({
    userId: user._id,
    campaignId,
  }).lean();
}

// TEST 1: SAME CUSTOMER, BOTH GAMES

async function testOneUser() {
  const user = await createUser();

  const monkey = await createGame(user, 'monkey');
  const perfect = await createGame(user, 'perfect-shot');
  const prize = await createPrize(2);

  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) =>
      allocation({
        userId: user._id,
        gameSessionId:
          i % 2 ? perfect._id : monkey._id,
      })
    )
  );

  const awards = await awardsFor(user);
  const stock = await WheelItem.findById(
    prize._id
  ).lean();

  assert.equal(awards.length, 1);
  assert.equal(stock.quantityAllocated, 1);

  assert.equal(
    await Spin.countDocuments({
      _id: awards[0].spinId,
    }),
    1
  );

  assert.ok(
    results.some(
      result =>
        result.status === 'fulfilled' &&
        result.value.status === 'PRIZE_AWARDED'
    )
  );

  const repeat = await allocation({
    userId: user._id,
    gameSessionId: monkey._id,
  });

  assert.ok(
    ['ALREADY_RESOLVED', 'ALREADY_AWARDED']
      .includes(repeat.status)
  );

  await WheelItem.updateOne(
    { _id: prize._id },
    { $set: { isActive: false } }
  );

  console.log(
    'PASS: Same customer concurrency and Spin linkage'
  );
}

// TEST 2: LAST AVAILABLE PRIZE

async function testLastItem() {
  const prize = await createPrize(1);

  const fixtures = [];

  for (let i = 0; i < 8; i++) {
    const user = await createUser();

    fixtures.push({
      user,
      game: await createGame(
        user,
        'perfect-shot'
      ),
    });
  }

  await Promise.allSettled(
    fixtures.map(({ user, game }) =>
      allocation({
        userId: user._id,
        gameSessionId: game._id,
      })
    )
  );

  const stock = await WheelItem.findById(
    prize._id
  ).lean();

  const issued =
    await PrizeAward.countDocuments({
      wheelItemId: prize._id,
    });

  assert.equal(stock.quantityAllocated, 1);
  assert.equal(issued, 1);

  await WheelItem.updateOne(
    { _id: prize._id },
    { $set: { isActive: false } }
  );

  console.log(
    'PASS: Eight customers competing for one prize'
  );
}

// TEST 3: NO PRIZE AND NEXT QUALIFIED GAME

async function testNoPrizeThenWin() {
  // Earlier fixture prizes have been deactivated.
  const user = await createUser();

  const first = await createGame(
    user,
    'monkey'
  );

  const firstResult = await allocation({
    userId: user._id,
    gameSessionId: first._id,
  });

  assert.equal(firstResult.status, 'NO_PRIZE');

  const duplicate = await allocation({
    userId: user._id,
    gameSessionId: first._id,
  });

  assert.equal(
    duplicate.status,
    'ALREADY_RESOLVED'
  );

  const prize = await createPrize(1);

  const second = await createGame(
    user,
    'perfect-shot'
  );

  const secondResult = await allocation({
    userId: user._id,
    gameSessionId: second._id,
  });

  assert.equal(
    secondResult.status,
    'PRIZE_AWARDED'
  );

  assert.equal(
    (await awardsFor(user)).length,
    1
  );

  await WheelItem.updateOne(
    { _id: prize._id },
    { $set: { isActive: false } }
  );

  console.log(
    'PASS: No Prize cannot reroll; next game can win'
  );
}

// TEST 4: TRANSACTION ROLLBACK

async function testRollback() {
  const user = await createUser();

  const game = await createGame(
    user,
    'monkey'
  );

  const prize = await createPrize(1);

  const originalCreate = PrizeAward.create;

  try {
    // Force an error after the transaction has started.
    PrizeAward.create = async () => {
      throw new Error(
        'STEP15K_FORCED_ROLLBACK'
      );
    };

    await assert.rejects(
      () =>
        allocation({
          userId: user._id,
          gameSessionId: game._id,
        }),
      /STEP15K_FORCED_ROLLBACK/
    );
  } finally {
    PrizeAward.create = originalCreate;
  }

  const stock = await WheelItem.findById(
    prize._id
  );

  assert.equal(
    stock.quantityAllocated,
    0
  );

  assert.equal(
    (await awardsFor(user)).length,
    0
  );

  assert.equal(
    await Spin.countDocuments({
      userId: user._id,
    }),
    0
  );

  await WheelItem.updateOne(
    { _id: prize._id },
    { $set: { isActive: false } }
  );

  console.log(
    'PASS: Transaction rollback protects inventory and Spin'
  );
}

// CLEANUP: DELETE ONLY THE FIXTURES CREATED BY THIS RUN

async function cleanup() {
  const models = [
    PrizeAward,
    Spin,
    GameSession,
    WheelItem,
    User,
  ];

  for (const model of models) {
    const ids = created[
      model.collection.name
    ];

    if (ids.length) {
      await model.deleteMany({
        _id: { $in: ids },
      });
    }
  }
}

async function main() {
  if (!uri) {
    throw new Error(
      'Missing MongoDB connection URI'
    );
  }

  const service = loadPrivateTransaction();

  allocation = service.__sandboxTransaction;

  // Confirm public allocation is disabled.
  await assert.rejects(
    () =>
      service.allocatePrize({
        userId:
          new mongoose.Types.ObjectId(),
        gameSessionId:
          new mongoose.Types.ObjectId(),
      }),
    error =>
      error.code ===
      'PRIZE_ALLOCATION_DISABLED'
  );

  // Force a separate sandbox database.
  await mongoose.connect(uri, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 10000,
  });

  if (
    mongoose.connection.name !== DB_NAME ||
    mongoose.connection.name === 'test'
  ) {
    throw new Error(
      'DATABASE SAFETY CHECK FAILED'
    );
  }

  console.log(
    'ISOLATED DATABASE:',
    mongoose.connection.name,
    'RUN:',
    runId
  );

  // Create actual Mongoose model indexes in sandbox.
  for (const model of [
    User,
    GameSession,
    WheelItem,
    Spin,
    PrizeAward,
  ]) {
    await model.createIndexes();
  }

  try {
    await testOneUser();
    await testLastItem();
    await testNoPrizeThenWin();
    await testRollback();

    console.log(
      'HNC STEP 15K: PASS (actual allocation transaction)'
    );
  } finally {
    await cleanup();

    console.log(
      'Sandbox fixture records removed'
    );
  }
}

main()
  .catch(error => {
    console.error(
      'HNC STEP 15K: FAIL',
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
