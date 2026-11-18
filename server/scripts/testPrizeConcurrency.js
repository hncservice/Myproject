
'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const crypto = require('crypto');

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGO_URI is missing from .env');
}

const collectionName =
  '__hnc_prize_test_' + crypto.randomBytes(6).toString('hex');

const campaignId = 'hnc-concurrency-test';

const objectId = () => new mongoose.Types.ObjectId();

async function main() {
  await mongoose.connect(uri);

  const db = mongoose.connection.db;

  if (db.databaseName !== 'test') {
    throw new Error(
      `Safety check: expected test database, got ${db.databaseName}`
    );
  }

  const collection = db.collection(collectionName);

  try {
    await collection.createIndex(
      { userId: 1, campaignId: 1 },
      {
        unique: true,
        partialFilterExpression: { type: 'award' },
      }
    );

    await collection.createIndex(
      { gameSessionId: 1 },
      {
        unique: true,
        partialFilterExpression: { type: 'decision' },
      }
    );

    // A separate inventory record for each test.
    async function createInventory(quantity) {
      const id = objectId();

      await collection.insertOne({
        _id: id,
        type: 'inventory',
        quantityTotal: quantity,
        quantityAllocated: 0,
      });

      return id;
    }

    // Transaction retry for transient write conflicts.
    async function withRetry(callback) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const session = await mongoose.startSession();

        try {
          let result;

          await session.withTransaction(
            async () => {
              result = await callback(session);
            },
            {
              readConcern: { level: 'snapshot' },
              writeConcern: { w: 'majority' },
            }
          );

          return result;
        } catch (err) {
          const retryable =
            err.hasErrorLabel?.('TransientTransactionError') ||
            err.code === 11000;

          if (!retryable || attempt === 11) {
            throw err;
          }

          await new Promise(resolve =>
            setTimeout(resolve, 20 * (attempt + 1))
          );
        } finally {
          await session.endSession();
        }
      }
    }

    async function allocate({ userId, inventoryId }) {
      return withRetry(async session => {
        const existing = await collection.findOne(
          { type: 'award', userId, campaignId },
          { session }
        );

        if (existing) {
          return 'ALREADY_AWARDED';
        }

        const reserved = await collection.updateOne(
          {
            _id: inventoryId,
            type: 'inventory',
            $expr: {
              $lt: [
                '$quantityAllocated',
                '$quantityTotal',
              ],
            },
          },
          {
            $inc: { quantityAllocated: 1 },
          },
          { session }
        );

        if (reserved.modifiedCount !== 1) {
          return 'OUT_OF_STOCK';
        }

        await collection.insertOne(
          {
            _id: objectId(),
            type: 'award',
            userId,
            campaignId,
            inventoryId,
          },
          { session }
        );

        return 'AWARDED';
      });
    }

    // ==========================================
    // TEST 1: Same user, 8 simultaneous requests
    // ==========================================

    const inventory1 = await createInventory(1);
    const sameUserId = objectId();

    const test1 = await Promise.all(
      Array.from({ length: 8 }, () =>
        allocate({
          userId: sameUserId,
          inventoryId: inventory1,
        })
      )
    );

    const inventoryAfter1 =
      await collection.findOne({ _id: inventory1 });

    console.log('\nTEST 1: Same customer');
    console.log({
      results: test1,
      awarded: test1.filter(x => x === 'AWARDED').length,
      allocated: inventoryAfter1.quantityAllocated,
    });

    // ==========================================
    // TEST 2: Different users, one available prize
    // ==========================================

    const inventory2 = await createInventory(1);

    const test2 = await Promise.all(
      Array.from({ length: 8 }, () =>
        allocate({
          userId: objectId(),
          inventoryId: inventory2,
        })
      )
    );

    const inventoryAfter2 =
      await collection.findOne({ _id: inventory2 });

    console.log('\nTEST 2: Last available prize');
    console.log({
      awarded: test2.filter(x => x === 'AWARDED').length,
      outOfStock: test2.filter(
        x => x === 'OUT_OF_STOCK'
      ).length,
      allocated: inventoryAfter2.quantityAllocated,
    });

    // ==========================================
    // TEST 3: Forced transaction rollback
    // ==========================================

    const inventory3 = await createInventory(1);
    const rollbackSession = await mongoose.startSession();

    try {
      await rollbackSession.withTransaction(async () => {
        await collection.updateOne(
          { _id: inventory3 },
          { $inc: { quantityAllocated: 1 } },
          { session: rollbackSession }
        );

        throw new Error('EXPECTED_ROLLBACK');
      });
    } catch (err) {
      if (err.message !== 'EXPECTED_ROLLBACK') {
        throw err;
      }
    } finally {
      await rollbackSession.endSession();
    }

    const inventoryAfter3 =
      await collection.findOne({ _id: inventory3 });

    console.log('\nTEST 3: Transaction rollback');
    console.log({
      allocated: inventoryAfter3.quantityAllocated,
      rollbackPassed:
        inventoryAfter3.quantityAllocated === 0,
    });

    // ==========================================
    // TEST 4: No Prize decision is idempotent
    // ==========================================

    const sessionId = objectId();

    async function recordNoPrize() {
      return withRetry(async session => {
        const existing = await collection.findOne(
          { type: 'decision', gameSessionId: sessionId },
          { session }
        );

        if (existing) {
          return 'ALREADY_DECIDED';
        }

        await collection.insertOne(
          {
            _id: objectId(),
            type: 'decision',
            gameSessionId: sessionId,
            result: 'NO_PRIZE',
          },
          { session }
        );

        return 'NO_PRIZE';
      });
    }

    const decision1 = await recordNoPrize();
    const decision2 = await recordNoPrize();

    console.log('\nTEST 4: Repeat No Prize request');
    console.log({
      first: decision1,
      second: decision2,
    });

    // ==========================================
    // SUMMARY
    // ==========================================

    const passed =
      test1.filter(x => x === 'AWARDED').length === 1 &&
      test1.filter(
        x => x === 'ALREADY_AWARDED'
      ).length === 7 &&
      inventoryAfter1.quantityAllocated === 1 &&
      test2.filter(x => x === 'AWARDED').length === 1 &&
      test2.filter(x => x === 'OUT_OF_STOCK').length === 7 &&
      inventoryAfter2.quantityAllocated === 1 &&
      inventoryAfter3.quantityAllocated === 0 &&
      decision1 === 'NO_PRIZE' &&
      decision2 === 'ALREADY_DECIDED';

    console.log('\nHNC CONCURRENCY TEST:', passed ? 'PASS' : 'FAIL');

    if (!passed) process.exitCode = 1;
  } finally {
    // Only the uniquely named temporary test collection
    // created by this script is deleted.
    await db.collection(collectionName).drop().catch(err => {
      if (err.codeName !== 'NamespaceNotFound') throw err;
    });

    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('TEST ERROR:', err);
  process.exitCode = 1;
});
