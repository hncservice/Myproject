
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Recovery = require(
  '../features/prizes/models/PrizeDecisionRecovery'
);

const DB_NAME = 'hnc_step15q_sandbox';

async function main() {
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
    throw new Error('Unsafe sandbox URI');
  }

  assert.equal(
    process.env.ALLOCATION_ENABLED,
    'false'
  );

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    assert.equal(
      mongoose.connection.name,
      DB_NAME
    );

    const auth = await mongoose.connection.db.command({
      connectionStatus: 1,
      showPrivileges: true,
    });

    const roles =
      auth.authInfo?.authenticatedUserRoles || [];

    const privileges =
      auth.authInfo?.authenticatedUserPrivileges || [];

    assert.equal(roles.length, 1);
    assert.equal(roles[0].role, 'readWrite');
    assert.equal(roles[0].db, DB_NAME);
    assert.ok(privileges.length > 0);

    for (const privilege of privileges) {
      assert.equal(
        privilege.resource?.db,
        DB_NAME
      );

      assert.equal(
        typeof privilege.resource?.collection,
        'string'
      );

      assert.notEqual(
        privilege.resource?.anyResource,
        true
      );

      assert.notEqual(
        privilege.resource?.cluster,
        true
      );
    }

    console.log(
      'PASS: Restricted sandbox permissions verified'
    );

    // Creates only the indexes declared by this
    // recovery model, inside the approved sandbox.
    //
    // This does not create recovery records.
    await Recovery.createIndexes();

    const indexes =
      await Recovery.collection.indexes();

    const required = [
      'unique_recovery_per_game_session',
      'recovery_due_queue',
      'recovery_expired_leases',
    ];

    for (const name of required) {
      const index = indexes.find(
        item => item.name === name
      );

      assert.ok(index, `Missing index: ${name}`);

      if (
        name ===
        'unique_recovery_per_game_session'
      ) {
        assert.equal(index.unique, true);
        assert.equal(
          index.key.gameSessionId,
          1
        );
      }

      console.log(`PASS: ${name}`);
    }

    console.log(
      '\nRESULT: 4/4 CHECKS PASSED'
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(
    '\nINDEX VERIFICATION FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
