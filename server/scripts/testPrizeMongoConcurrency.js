
'use strict';

/**
 * HNC PHASE 4 - STEP 15J
 * Isolated MongoDB Transaction Concurrency Test
 *
 * IMPORTANT:
 * - Uses a dedicated sandbox database.
 * - Does NOT call the live prize allocation service.
 * - Does NOT use real customers or campaign records.
 * - Does NOT drop a database or collection.
 * - Cleans up only records belonging to this test run.
 *
 * Tests actual MongoDB transactions and unique indexes.
 */

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const { MongoClient, ObjectId } = mongoose.mongo;

const DATABASE = 'hnc_step15j_sandbox';
const CAMPAIGN = 'step15j-isolated-campaign';

const runId = crypto.randomUUID();

const uri =
  process.env.HNC_SANDBOX_MONGO_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;

if (!uri) {
  console.error(
    'Missing MongoDB URI. Set HNC_SANDBOX_MONGO_URI.'
  );
  process.exit(1);
}

// Explicit database-name override prevents using
// the production application database name.
const client = new MongoClient(uri, {
  appName: 'HNC-Step15J-Sandbox',
  serverSelectionTimeoutMS: 10000,
});

let db;
let users;
let sessions;
let awards;
let inventory;
let decisions;

function createId() {
  return new ObjectId();
}

function pause(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

async function setup() {
  await client.connect();

  db = client.db(DATABASE);

  if (db.databaseName !== DATABASE) {
    throw new Error(
      'Database isolation verification failed'
    );
  }

  users = db.collection('step15j_users');
  sessions = db.collection('step15j_sessions');
  awards = db.collection('step15j_awards');
  inventory = db.collection('step15j_inventory');
  decisions = db.collection('step15j_decisions');

  await awards.createIndex(
    { userId: 1, campaignId: 1 },
    {
      unique: true,
      name: 'sandbox_one_prize_per_customer',
    }
  );

  await decisions.createIndex(
    { gameSessionId: 1 },
    {
      unique: true,
      name: 'sandbox_one_decision_per_session',
    }
  );

  console.log('Sandbox database:', db.databaseName);
  console.log('Test run:', runId);
}

async function createCustomer() {
  const userId = createId();

  await users.insertOne({
    _id: userId,
    runId,
    decisionFence: 0,
  });

  return userId;
}

async function createGameSession(userId, gameId) {
  const gameSessionId = createId();

  await sessions.insertOne({
    _id: gameSessionId,
    runId,
    userId,
    campaignId: CAMPAIGN,
    gameId,
    status: 'completed',
    outcome: 'qualified',
  });

  return gameSessionId;
}

async function createPrize(quantityTotal) {
  const prizeId = createId();

  await inventory.insertOne({
    _id: prizeId,
    runId,
    isActive: true,
    quantityTotal,
    quantityAllocated: 0,
  });

  return prizeId;
}

/**
 * Simulates the transaction structure:
 *
 * 1. Serialize decisions using a user-document write.
 * 2. Verify session and previous award/decision.
 * 3. Persist No Prize or reserve inventory.
 * 4. Create a unique award.
 * 5. Commit atomically.
 *
 * It deliberately does not perform a random draw:
 * desiredOutcome is test-controlled.
 */
async function simulateAllocation({
  userId,
  gameSessionId,
  prizeId = null,
  desiredOutcome = 'PRIZE',
  forceRollback = false,
}) {
  const mongoSession = client.startSession();

  try {
    return await mongoSession.withTransaction(
      async () => {
        // Per-customer transactional write fence.
        const fence = await users.updateOne(
          {
            _id: userId,
            runId,
          },
          {
            $inc: {
              decisionFence: 1,
            },
          },
          { session: mongoSession }
        );

        if (fence.modifiedCount !== 1) {
          throw new Error('USER_FENCE_FAILED');
        }

        // Encourage overlap between concurrent tests.
        await pause(15);

        const game = await sessions.findOne(
          {
            _id: gameSessionId,
            runId,
            userId,
            campaignId: CAMPAIGN,
            status: 'completed',
            outcome: 'qualified',
          },
          { session: mongoSession }
        );

        if (!game) {
          return 'NOT_QUALIFIED';
        }

        const existingDecision = await decisions.findOne(
          {
            gameSessionId,
            runId,
          },
          { session: mongoSession }
        );

        if (existingDecision) {
          return 'ALREADY_DECIDED';
        }

        const existingAward = await awards.findOne(
          {
            userId,
            campaignId: CAMPAIGN,
          },
          { session: mongoSession }
        );

        if (existingAward) {
          return 'ALREADY_AWARDED';
        }

        if (desiredOutcome === 'NO_PRIZE') {
          await decisions.insertOne(
            {
              _id: createId(),
              runId,
              userId,
              gameSessionId,
              result: 'NO_PRIZE',
            },
            { session: mongoSession }
          );

          return 'NO_PRIZE';
        }

        // Reserve limited inventory inside transaction.
        const reserved = await inventory.updateOne(
          {
            _id: prizeId,
            runId,
            isActive: true,
            $expr: {
              $lt: [
                '$quantityAllocated',
                '$quantityTotal',
              ],
            },
          },
          {
            $inc: {
              quantityAllocated: 1,
            },
          },
          { session: mongoSession }
        );

        if (reserved.modifiedCount !== 1) {
          return 'OUT_OF_STOCK';
        }

        if (forceRollback) {
          throw new Error('FORCED_ROLLBACK');
        }

        await awards.insertOne(
          {
            _id: createId(),
            runId,
            userId,
            campaignId: CAMPAIGN,
            gameSessionId,
            prizeId,
          },
          { session: mongoSession }
        );

        await decisions.insertOne(
          {
            _id: createId(),
            runId,
            userId,
            gameSessionId,
            result: 'PRIZE_AWARDED',
          },
          { session: mongoSession }
        );

        return 'AWARDED';
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );
  } finally {
    await mongoSession.endSession();
  }
}

async function testSameCustomer() {
  const userId = await createCustomer();

  const prizeId = await createPrize(10);

  const monkey = await createGameSession(
    userId,
    'monkey'
  );

  const perfectShot = await createGameSession(
    userId,
    'perfect-shot'
  );

  const results = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      simulateAllocation({
        userId,
        gameSessionId:
          index % 2 === 0 ? monkey : perfectShot,
        prizeId,
      })
    )
  );

  const awarded = results.filter(
    value => value === 'AWARDED'
  ).length;

  const count = await awards.countDocuments({
    runId,
    userId,
  });

  const prize = await inventory.findOne({
    _id: prizeId,
    runId,
  });

  assert.equal(awarded, 1);
  assert.equal(count, 1);
  assert.equal(prize.quantityAllocated, 1);

  console.log(
    'PASS: Concurrent Monkey and Perfect Shot requests'
  );
  console.log('Results:', results);
}

async function testLastPrize() {
  const prizeId = await createPrize(1);

  const fixtures = [];

  for (let i = 0; i < 8; i++) {
    const userId = await createCustomer();

    const gameSessionId =
      await createGameSession(
        userId,
        'perfect-shot'
      );

    fixtures.push({
      userId,
      gameSessionId,
      prizeId,
    });
  }

  const results = await Promise.all(
    fixtures.map(simulateAllocation)
  );

  const awarded = results.filter(
    result => result === 'AWARDED'
  ).length;

  const prize = await inventory.findOne({
    _id: prizeId,
    runId,
  });

  assert.equal(awarded, 1);
  assert.equal(prize.quantityAllocated, 1);

  console.log(
    'PASS: Eight customers competing for one prize'
  );
}

async function testNoPrize() {
  const userId = await createCustomer();

  const gameSessionId =
    await createGameSession(
      userId,
      'monkey'
    );

  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      simulateAllocation({
        userId,
        gameSessionId,
        desiredOutcome: 'NO_PRIZE',
      })
    )
  );

  assert.equal(
    results.filter(r => r === 'NO_PRIZE').length,
    1
  );

  assert.equal(
    results.filter(
      r => r === 'ALREADY_DECIDED'
    ).length,
    4
  );

  const prizeId = await createPrize(1);

  const nextGame = await createGameSession(
    userId,
    'perfect-shot'
  );

  const nextResult = await simulateAllocation({
    userId,
    gameSessionId: nextGame,
    prizeId,
  });

  assert.equal(nextResult, 'AWARDED');

  console.log(
    'PASS: No Prize cannot reroll; next qualified attempt remains eligible'
  );
}

async function testRollback() {
  const userId = await createCustomer();

  const gameSessionId =
    await createGameSession(
      userId,
      'monkey'
    );

  const prizeId = await createPrize(1);

  await assert.rejects(
    () =>
      simulateAllocation({
        userId,
        gameSessionId,
        prizeId,
        forceRollback: true,
      }),
    /FORCED_ROLLBACK/
  );

  const prize = await inventory.findOne({
    _id: prizeId,
    runId,
  });

  const awardCount = await awards.countDocuments({
    runId,
    userId,
  });

  const decisionCount =
    await decisions.countDocuments({
      runId,
      gameSessionId,
    });

  assert.equal(prize.quantityAllocated, 0);
  assert.equal(awardCount, 0);
  assert.equal(decisionCount, 0);

  console.log(
    'PASS: Failed transaction rolls back inventory and award'
  );
}

async function cleanup() {
  if (!db) return;

  // Only delete records belonging to this run.
  const collections = [
    decisions,
    awards,
    sessions,
    inventory,
    users,
  ];

  for (const collection of collections) {
    if (collection) {
      await collection.deleteMany({ runId });
    }
  }
}

async function main() {
  try {
    await setup();

    await testSameCustomer();
    await testLastPrize();
    await testNoPrize();
    await testRollback();

    console.log('\nHNC STEP 15J: PASS');
    console.log('Real prize allocation remains disabled.');
  } catch (error) {
    console.error('\nHNC STEP 15J: FAIL');
    console.error(error);

    process.exitCode = 1;
  } finally {
    try {
      await cleanup();

      console.log(
        'Sandbox test records cleaned up.'
      );
    } catch (error) {
      console.error(
        'Sandbox cleanup failed:',
        error.message
      );

      process.exitCode = 1;
    }

    await client.close();
  }
}

main();
