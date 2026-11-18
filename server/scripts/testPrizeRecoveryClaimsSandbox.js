
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Recovery = require('../features/prizes/models/PrizeDecisionRecovery');

const {
  ensureRecoveryRecord,
  claimRecovery,
  finishRecovery,
} = require('../features/prizes/services/prizeRecoveryClaimService');

const DB_NAME = 'hnc_step15q_sandbox';

const owned = [];
let authorized = false;
let passed = 0;

function id() {
  return new mongoose.Types.ObjectId();
}

function checkEnvironment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('Sandbox URI missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname) !==
      `/${DB_NAME}`
  ) {
    throw new Error('Unsafe MongoDB URI');
  }

  assert.equal(process.env.ALLOCATION_ENABLED, 'false');
  assert.notEqual(process.env.NODE_ENV, 'production');

  return uri;
}

async function verifyPermissions() {
  assert.equal(mongoose.connection.name, DB_NAME);

  const response = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    response.authInfo?.authenticatedUserRoles || [];

  const privileges =
    response.authInfo?.authenticatedUserPrivileges || [];

  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'readWrite');
  assert.equal(roles[0].db, DB_NAME);
  assert.ok(privileges.length > 0);

  for (const privilege of privileges) {
    assert.equal(privilege.resource?.db, DB_NAME);
    assert.equal(
      typeof privilege.resource?.collection,
      'string'
    );
    assert.notEqual(privilege.resource?.anyResource, true);
    assert.notEqual(privilege.resource?.cluster, true);
  }

  authorized = true;
}

function identity() {
  const data = {
    gameSessionId: id(),
    userId: id(),
    campaignId: 'sandbox-recovery-claim-test',
  };

  owned.push(data.gameSessionId);

  return data;
}

async function test(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

async function cleanup() {
  if (
    !authorized ||
    mongoose.connection.readyState !== 1
  ) {
    return;
  }

  await Recovery.deleteMany({
    gameSessionId: { $in: owned },
    campaignId: 'sandbox-recovery-claim-test',
  });

  assert.equal(
    await Recovery.countDocuments({
      gameSessionId: { $in: owned },
    }),
    0
  );

  console.log('PASS: Sandbox claim fixtures cleaned up');
}

async function main() {
  const uri = checkEnvironment();

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    await verifyPermissions();

    const indexes = await Recovery.collection.indexes();

    assert.ok(indexes.some(index =>
      index.name === 'unique_recovery_per_game_session' &&
      index.unique === true &&
      index.key?.gameSessionId === 1
    ));

    console.log('PASS: Sandbox and unique recovery index verified');

    await test('Ensure creates recovery record', async () => {
      const data = identity();

      const record = await ensureRecoveryRecord(data);

      assert.equal(record.status, 'pending');
      assert.equal(record.attempts, 0);

      const again = await ensureRecoveryRecord(data);

      assert.equal(String(again._id), String(record._id));
    });

    await test('Only one simultaneous worker claims', async () => {
      const data = identity();

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          claimRecovery(data)
        )
      );

      assert.equal(
        results.filter(r => r.claimed).length,
        1
      );
    });

    await test('Valid worker completes claim', async () => {
      const data = identity();

      const claimed = await claimRecovery(data);

      assert.equal(claimed.claimed, true);

      const result = await finishRecovery({
        recoveryId: claimed.recoveryId,
        token: claimed.token,
      });

      assert.equal(result.status, 'completed');
      assert.equal(result.attempts, 1);
    });

    await test('Wrong worker token rejected', async () => {
      const data = identity();

      const claimed = await claimRecovery(data);

      await assert.rejects(
        () => finishRecovery({
          recoveryId: claimed.recoveryId,
          token: 'f'.repeat(64),
        }),
        error => error.code === 'CLAIM_EXPIRED'
      );
    });

    await test('Permanent eligibility failure held', async () => {
      const data = identity();

      const claimed = await claimRecovery(data);

      const result = await finishRecovery({
        recoveryId: claimed.recoveryId,
        token: claimed.token,
        errorCode: 'EMAIL_NOT_VERIFIED',
      });

      assert.equal(result.status, 'held');

      const retry = await claimRecovery(data);

      assert.equal(retry.claimed, false);
    });

    await test('Temporary failure schedules retry', async () => {
      const data = identity();

      const claimed = await claimRecovery(data);

      const result = await finishRecovery({
        recoveryId: claimed.recoveryId,
        token: claimed.token,
        errorCode: 'TEMPORARY_ERROR',
      });

      assert.equal(result.status, 'retry_scheduled');
      assert.ok(result.nextRetryAt instanceof Date);

      const retry = await claimRecovery(data);

      assert.equal(retry.claimed, false);
    });

    await test('Completed claim cannot be reused', async () => {
      const data = identity();

      const claimed = await claimRecovery(data);

      await finishRecovery({
        recoveryId: claimed.recoveryId,
        token: claimed.token,
      });

      await assert.rejects(
        () => finishRecovery({
          recoveryId: claimed.recoveryId,
          token: claimed.token,
        }),
        error => error.code === 'CLAIM_EXPIRED'
      );
    });

    await test('Invalid identities rejected', async () => {
      await assert.rejects(
        () => claimRecovery({
          gameSessionId: 'invalid',
          userId: 'invalid',
          campaignId: '',
        }),
        error =>
          error.code === 'INVALID_RECOVERY_IDENTITY'
      );
    });

    console.log(
      `\nRESULT: ${passed}/8 TESTS PASSED`
    );
  } finally {
    try {
      await cleanup();
    } finally {
      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(
    '\nCLAIM TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
