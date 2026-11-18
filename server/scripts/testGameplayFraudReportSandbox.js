
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const Spin = require('../features/games/models/Spin');
const Recovery = require('../features/prizes/models/PrizeDecisionRecovery');

const {
  CAMPAIGN_POLICY,
} = require('../config/gameConfig');

const {
  generateGameplayFraudReport,
} = require('../features/fraud-monitoring/services/gameplayFraudReportService');

const DB_NAME = 'hnc_step15q_sandbox';
const EXPECTED_TESTS = 7;

const owned = {
  users: [],
  sessions: [],
};

let authorized = false;
let passed = 0;

function newId() {
  return new mongoose.Types.ObjectId();
}

function environment() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('Sandbox URI missing');
  }

  const parsed = new URL(uri);

  assert.ok(
    ['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)
  );

  assert.equal(
    decodeURIComponent(parsed.pathname),
    `/${DB_NAME}`
  );

  assert.equal(process.env.ALLOCATION_ENABLED, 'false');
  assert.notEqual(process.env.NODE_ENV, 'production');

  return uri;
}

async function verifyPermissions() {
  assert.equal(mongoose.connection.name, DB_NAME);

  const info = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    info.authInfo?.authenticatedUserRoles || [];

  const privileges =
    info.authInfo?.authenticatedUserPrivileges || [];

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

async function makeFixture(intervals) {
  const userId = newId();
  const sessionId = newId();

  owned.users.push(userId);
  owned.sessions.push(sessionId);

  await User.create({
    _id: userId,
    name: 'Fraud Report Sandbox Customer',
    email: `fraud-report-${userId}@sandbox.invalid`,
    passwordHash: 'SANDBOX_ONLY',
    emailVerified: true,
    hasSpun: false,
  });

  const started = Date.now() - 40000;
  let timestamp = started + 3000;

  const times = [timestamp];

  for (const interval of intervals) {
    timestamp += interval;
    times.push(timestamp);
  }

  const events = times.map((time, index) => ({
    type: 'tap',
    round: index + 1,
    success: true,
    serverAt: new Date(time),
  }));

  return GameSession.create({
    _id: sessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
    attemptNumber: 1,
    sessionTokenHash: crypto
      .randomBytes(32)
      .toString('hex'),
    status: 'completed',
    outcome: 'qualified',
    score: 7,
    startedAt: new Date(started),
    completedAt: new Date(timestamp + 1000),
    expiresAt: new Date(started + 120000),
    gameState: {
      revision: 14,
      phase: 'finished',
      round: 7,
      hits: 7,
      misses: 0,
    },
    events,
  });
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

  assert.equal(mongoose.connection.name, DB_NAME);

  if (
    owned.users.length === 0 ||
    owned.sessions.length === 0
  ) {
    return;
  }

  const filter = {
    gameSessionId: { $in: owned.sessions },
    userId: { $in: owned.users },
  };

  assert.equal(
    await PrizeAward.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected prize award'
  );

  assert.equal(
    await Spin.countDocuments({
      userId: { $in: owned.users },
    }),
    0,
    'Unexpected legacy spin'
  );

  // Defensive cleanup limited to test-owned IDs.
  await Recovery.deleteMany(filter);
  await PrizeDecision.deleteMany(filter);

  await GameSession.deleteMany({
    _id: { $in: owned.sessions },
    userId: { $in: owned.users },
  });

  await User.deleteMany({
    _id: { $in: owned.users },
  });

  const remaining = await Promise.all([
    GameSession.countDocuments({
      _id: { $in: owned.sessions },
    }),
    User.countDocuments({
      _id: { $in: owned.users },
    }),
    Recovery.countDocuments(filter),
    PrizeDecision.countDocuments(filter),
  ]);

  assert.ok(
    remaining.every(count => count === 0),
    'Fraud report fixture cleanup incomplete'
  );

  console.log('PASS: Fraud report fixtures cleaned up');
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

    console.log(
      'PASS: Restricted sandbox permissions verified'
    );

    const normal = await makeFixture([
      1100, 1600, 1250, 1950, 1450, 1800,
    ]);

    const regular = await makeFixture([
      1000, 1000, 1000, 1000, 1000, 1000,
    ]);

    await test('Normal gameplay report generated', async () => {
      const result = await generateGameplayFraudReport({
        sessionIds: [String(normal._id)],
      });

      assert.equal(result.found, 1);
      assert.equal(result.reports.length, 1);
      assert.equal(result.reports[0].gameId, 'monkey');
      assert.equal(result.reportType, 'observational');
    });

    await test('Behavior warnings appear separately', async () => {
      const result = await generateGameplayFraudReport({
        sessionIds: [String(regular._id)],
      });

      const report = result.reports[0];

      assert.equal(
        report.behavior.reviewSuggested,
        true
      );

      assert.ok(
        report.behavior.signals.includes(
          'HIGHLY_REGULAR_TAP_CADENCE'
        )
      );

      assert.equal(
        report.behaviorAffectsPrizeDecision,
        false
      );
    });

    await test('Integrity status remains independent', async () => {
      const result = await generateGameplayFraudReport({
        sessionIds: [
          String(normal._id),
          String(regular._id),
        ],
      });

      assert.equal(result.found, 2);

      for (const report of result.reports) {
        assert.equal(
          report.integrity.assessmentVersion,
          2
        );

        assert.equal(
          report.preliminaryReviewRequired,
          report.integrity.reviewRequired
        );
      }
    });

    await test('Report preserves explicit session order', async () => {
      const result = await generateGameplayFraudReport({
        sessionIds: [
          String(regular._id),
          String(normal._id),
        ],
      });

      assert.equal(
        result.reports[0].sessionId,
        String(regular._id)
      );

      assert.equal(
        result.reports[1].sessionId,
        String(normal._id)
      );
    });

    await test('Missing session handled safely', async () => {
      const unknownId = newId();

      const result = await generateGameplayFraudReport({
        sessionIds: [String(unknownId)],
      });

      assert.equal(result.found, 0);
      assert.equal(result.missing, 1);
      assert.equal(result.notFound[0], String(unknownId));
    });

    await test('Invalid filters and limits rejected', async () => {
      await assert.rejects(
        () => generateGameplayFraudReport({
          sessionIds: ['invalid'],
        }),
        error => error.code === 'INVALID_SESSION_FILTER'
      );

      await assert.rejects(
        () => generateGameplayFraudReport({
          sessionIds: [String(normal._id)],
          limit: 26,
        }),
        error => error.code === 'INVALID_REPORT_LIMIT'
      );

      await assert.rejects(
        () => generateGameplayFraudReport({
          sessionIds: [
            String(normal._id),
            String(normal._id),
          ],
        }),
        error => error.code === 'DUPLICATE_SESSION_IDS'
      );
    });

    await test('Reporting makes no database changes', async () => {
      const result = await generateGameplayFraudReport({
        sessionIds: [
          String(normal._id),
          String(regular._id),
        ],
      });

      assert.equal(result.databaseModified, false);
      assert.equal(result.prizeAllocated, false);
      assert.equal(result.decisionModified, false);

      assert.equal(
        await PrizeDecision.countDocuments({
          gameSessionId: {
            $in: owned.sessions,
          },
        }),
        0
      );

      assert.equal(
        await Recovery.countDocuments({
          gameSessionId: {
            $in: owned.sessions,
          },
        }),
        0
      );
    });

    assert.equal(passed, EXPECTED_TESTS);
    
    // =================================================
    // STEP 15R.22J — ACTUAL BACKEND CONTRACT EXPORT
    //
    // Explicit opt-in only.
    // Uses existing test-owned sandbox fixtures.
    // No customer data, prize awards or QR tokens.
    // =================================================

    if (process.env.HNC_EXPORT_FRAUD_CONTRACT === 'true') {
      const fs = require('node:fs');
      const path = require('node:path');

      const unknownId = newId();

      const actualReport = await generateGameplayFraudReport({
        sessionIds: [
          String(normal._id),
          String(regular._id),
          String(unknownId),
        ],
        limit: 3,
      });

      assert.equal(actualReport.found, 2);
      assert.equal(actualReport.missing, 1);
      assert.equal(actualReport.reportType, 'observational');
      assert.equal(actualReport.prizeAllocated, false);
      assert.equal(actualReport.decisionModified, false);

      const outputPath = path.join(
        __dirname,
        'fixtures',
        'fraudReportBackend.contract.json'
      );

      fs.mkdirSync(path.dirname(outputPath), {
        recursive: true,
      });

      // JSON serialization converts MongoDB dates to
      // the actual JSON representation used by clients.
      const serialized = JSON.stringify(
        actualReport,
        null,
        2
      );

      const parsed = JSON.parse(serialized);

      // Never export unexpected identifying fields.
      for (const session of parsed.reports) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(session, 'email'),
          false
        );

        assert.equal(
          Object.prototype.hasOwnProperty.call(
            session,
            'sessionTokenHash'
          ),
          false
        );

        assert.equal(
          Object.prototype.hasOwnProperty.call(
            session,
            'userId'
          ),
          false
        );
      }

      fs.writeFileSync(
        outputPath,
        serialized + '\n',
        {
          encoding: 'utf8',
          mode: 0o600,
        }
      );

      console.log(
        'PASS: Actual sandbox fraud report JSON exported'
      );
    }


    console.log(
      `\nRESULT: ${passed}/${EXPECTED_TESTS} TESTS PASSED`
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
    '\nFRAUD REPORT TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});

