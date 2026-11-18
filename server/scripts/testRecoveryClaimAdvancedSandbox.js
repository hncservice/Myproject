
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Recovery = require('../features/prizes/models/PrizeDecisionRecovery');

const {
  claimRecovery,
  finishRecovery,
} = require('../features/prizes/services/prizeRecoveryClaimService');

const DB_NAME = 'hnc_step15q_sandbox';
const TEST_CAMPAIGN = 'sandbox-advanced-recovery-test';

const owned = [];
let authorized = false;
let passed = 0;

function id() {
  return new mongoose.Types.ObjectId();
}

function environment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) throw new Error('Sandbox URI missing');

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

  const result = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    result.authInfo?.authenticatedUserRoles || [];

  const privileges =
    result.authInfo?.authenticatedUserPrivileges || [];

  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'readWrite');
  assert.equal(roles[0].db, DB_NAME);
  assert.ok(privileges.length > 0);

  for (const p of privileges) {
    assert.equal(p.resource?.db, DB_NAME);
    assert.equal(typeof p.resource?.collection, 'string');
    assert.notEqual(p.resource?.anyResource, true);
    assert.notEqual(p.resource?.cluster, true);
  }

  authorized = true;
}

function identity() {
  const value = {
    gameSessionId: id(),
    userId: id(),
    campaignId: TEST_CAMPAIGN,
  };

  owned.push(value.gameSessionId);

  return value;
}

async function test(label, action) {
  await action();
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
    campaignId: TEST_CAMPAIGN,
  });

  assert.equal(
    await Recovery.countDocuments({
      gameSessionId: { $in: owned },
      campaignId: TEST_CAMPAIGN,
    }),
    0
  );

  console.log('PASS: Advanced sandbox fixtures cleaned up');
}

async function main() {
  const uri = environment();

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

    console.log('PASS: Sandbox permissions and index verified');

    await test('Expired lease allows takeover', async () => {
      const data = identity();

      const first = await claimRecovery(data);

      assert.equal(first.claimed, true);

      // Test-only simulated expiry.
      await Recovery.updateOne(
        {
          gameSessionId: data.gameSessionId,
          status: 'processing',
        },
        {
          $set: {
            leaseUntil: new Date(Date.now() - 1000),
          },
        }
      );

      const second = await claimRecovery(data);

      assert.equal(second.claimed, true);
      assert.notEqual(first.token, second.token);
      assert.equal(second.attempts, 2);
    });

    await test('Expired worker cannot finish after takeover', async () => {
      const data = identity();

      const first = await claimRecovery(data);

      await Recovery.updateOne(
        {
          gameSessionId: data.gameSessionId,
          status: 'processing',
        },
        {
          $set: {
            leaseUntil: new Date(Date.now() - 1000),
          },
        }
      );

      const second = await claimRecovery(data);

      await assert.rejects(
        () => finishRecovery({
          recoveryId: first.recoveryId,
          token: first.token,
        }),
        error => error.code === 'CLAIM_EXPIRED'
      );

      const result = await finishRecovery({
        recoveryId: second.recoveryId,
        token: second.token,
      });

      assert.equal(result.status, 'completed');
    });

    await test('Maximum five attempts enforced', async () => {
      const data = identity();

      for (let attempt = 1; attempt <= 5; attempt++) {
        const claimed = await claimRecovery(data);

        assert.equal(claimed.claimed, true);
        assert.equal(claimed.attempts, attempt);

        const finished = await finishRecovery({
          recoveryId: claimed.recoveryId,
          token: claimed.token,
          errorCode: 'TEMPORARY_ERROR',
        });

        if (attempt < 5) {
          assert.equal(
            finished.status,
            'retry_scheduled'
          );

          // Advance a test fixture's retry time.
          await Recovery.updateOne(
            {
              gameSessionId: data.gameSessionId,
              status: 'retry_scheduled',
            },
            {
              $set: {
                nextRetryAt: new Date(
                  Date.now() - 1000
                ),
              },
            }
          );
        } else {
          assert.equal(finished.status, 'held');
        }
      }

      const sixth = await claimRecovery(data);

      assert.equal(sixth.claimed, false);
    });

    await test('Concurrent takeover has one winner', async () => {
      const data = identity();

      await claimRecovery(data);

      await Recovery.updateOne(
        {
          gameSessionId: data.gameSessionId,
          status: 'processing',
        },
        {
          $set: {
            leaseUntil: new Date(Date.now() - 1000),
          },
        }
      );

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

    console.log(
      `\nRESULT: ${passed}/4 TESTS PASSED`
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
    '\nADVANCED CLAIM TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
