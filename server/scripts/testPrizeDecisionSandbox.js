
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');

const DB_NAME = 'hnc_step15q_sandbox';

function safetyCheck() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('HNC_SANDBOX_MONGO_URI is missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname) !== `/${DB_NAME}`
  ) {
    throw new Error('Sandbox URI must target /' + DB_NAME);
  }

  if (process.env.ALLOCATION_ENABLED !== 'false') {
    throw new Error('ALLOCATION_ENABLED must be false');
  }

  return uri;
}

async function verifyPermissions() {
  const result = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const auth = result.authInfo || {};
  const roles = auth.authenticatedUserRoles || [];
  const inherited = auth.authenticatedUserPrivileges || [];

  if (
    roles.length !== 1 ||
    roles[0].role !== 'readWrite' ||
    roles[0].db !== DB_NAME
  ) {
    throw new Error(
      'Sandbox user must have only readWrite on ' + DB_NAME
    );
  }

  // Do not allow any privilege outside the sandbox.
  for (const privilege of inherited) {
    const resource = privilege.resource || {};

    if (
      resource.anyResource === true ||
      resource.cluster === true ||
      resource.db !== DB_NAME ||
      resource.collection === undefined
    ) {
      throw new Error(
        'MongoDB permissions extend beyond the sandbox'
      );
    }
  }
}

async function main() {
  const uri = safetyCheck();

  const insertedIds = [];
  let passed = 0;

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    assert.equal(mongoose.connection.name, DB_NAME);
    await verifyPermissions();

    console.log('PASS: Sandbox database and permissions verified');

    // Only after verifying effective permissions.
    await PrizeDecision.createCollection();
    await PrizeDecision.createIndexes();

    const indexes = await PrizeDecision.collection.indexes();

    const uniqueIndex = indexes.find(
      index =>
        index.name === 'unique_prize_decision_per_session' &&
        index.unique === true &&
        index.key?.gameSessionId === 1
    );

    assert.ok(uniqueIndex, 'Required unique index missing');

    console.log('PASS: Unique session index exists');

    const userId = new mongoose.Types.ObjectId();
    const sessionId = new mongoose.Types.ObjectId();
    const campaignId = 'sandbox-step15r20d';

    function documentFor(gameSessionId) {
      return {
        userId,
        campaignId,
        gameSessionId,
        gameId: 'monkey',
        status: 'pending_review',
      };
    }

    const first = await PrizeDecision.create(
      documentFor(sessionId)
    );

    insertedIds.push(first._id);
    passed++;

    console.log('PASS: First prize decision created');

    let duplicateRejected = false;

    try {
      const duplicate = await PrizeDecision.create(
        documentFor(sessionId)
      );

      insertedIds.push(duplicate._id);
    } catch (error) {
      if (error.code === 11000) {
        duplicateRejected = true;
      } else {
        throw error;
      }
    }

    assert.ok(
      duplicateRejected,
      'Duplicate session was unexpectedly accepted'
    );

    passed++;

    console.log('PASS: Duplicate session rejected by MongoDB');

    const second = await PrizeDecision.create(
      documentFor(new mongoose.Types.ObjectId())
    );

    insertedIds.push(second._id);
    passed++;

    console.log('PASS: Different session accepted');

    const count = await PrizeDecision.countDocuments({
      _id: { $in: insertedIds },
    });

    assert.equal(count, 2);
    passed++;

    console.log('PASS: Exactly two test decisions stored');

    console.log(
      `\nRESULT: ${passed}/4 DOCUMENT TESTS PASSED`
    );
  } finally {
    if (mongoose.connection.readyState === 1) {
      try {
        if (insertedIds.length) {
          await PrizeDecision.deleteMany({
            _id: { $in: insertedIds },
          });

          console.log('PASS: Test fixtures cleaned up');
        }
      } finally {
        await mongoose.disconnect();
      }
    }
  }
}

main().catch(error => {
  console.error('TEST FAILED:', error.message);
  process.exitCode = 1;
});
