'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createInterface } = require('node:readline/promises');
const mongoose = require('mongoose');

const AdminUser = require('../features/administration/models/AdminUser');
const AdminAuditLog = require('../features/administration/models/AdminAuditLog');
const GameSession = require('../features/games/models/GameSession');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');

const {
  reviewPrizeDecision,
} = require('../features/prizes/services/prizeReviewService');

const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const DB_NAME = 'hnc_step15q_sandbox';
const BROWSER_TIMEOUT_MS = 10 * 60 * 1000;
const BROWSER_FIXTURE_LIFETIME_MS = BROWSER_TIMEOUT_MS + 60 * 1000;

const fixture = {
  adminIds: [],
  sessionIds: [],
  decisionIds: [],
};

let passed = 0;

function checkConfiguration() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error('HNC_SANDBOX_MONGO_URI missing');
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Invalid sandbox MongoDB URI');
  }

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    decodeURIComponent(parsed.pathname) !== `/${DB_NAME}` ||
    parsed.searchParams.getAll('dbName').some(name => name !== DB_NAME)
  ) {
    throw new Error('Sandbox URI/database mismatch');
  }

  if (process.env.ALLOCATION_ENABLED !== 'false') {
    throw new Error('Set ALLOCATION_ENABLED=false for the sandbox test');
  }

  return uri;
}

async function verifyPermissions() {
  assert.equal(mongoose.connection.name, DB_NAME);

  const result = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const auth = result.authInfo || {};
  const roles = auth.authenticatedUserRoles || [];
  const privileges = auth.authenticatedUserPrivileges || [];

  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'readWrite');
  assert.equal(roles[0].db, DB_NAME);
  assert.ok(privileges.length > 0, 'MongoDB did not report authenticated privileges');

  for (const privilege of privileges) {
    const resource = privilege.resource || {};

    if (
      resource.anyResource === true ||
      resource.cluster === true ||
      resource.db !== DB_NAME ||
      typeof resource.collection !== 'string'
    ) {
      throw new Error('MongoDB privileges extend beyond the sandbox');
    }
  }
}

async function createAdmin(overrides = {}) {
  const _id = new mongoose.Types.ObjectId();
  fixture.adminIds.push(_id);

  return AdminUser.create({
    _id,
    name: 'Sandbox Prize Review Admin',
    email: `review-${_id}@sandbox.invalid`,
    passwordHash: 'SANDBOX_TEST_NO_REAL_LOGIN',
    role: 'admin',
    isActive: true,
    tokenVersion: 0,
    prizeReviewFence: 0,
    ...overrides,
  });
}

async function createPendingDecision(lifetimeMs = 90000) {
  const userId = new mongoose.Types.ObjectId();
  const sessionId = new mongoose.Types.ObjectId();
  const decisionId = new mongoose.Types.ObjectId();

  fixture.sessionIds.push(sessionId);
  fixture.decisionIds.push(decisionId);

  const now = Date.now();

  await GameSession.create({
    _id: sessionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: 'monkey',
    attemptNumber: 1,
    sessionTokenHash: crypto.randomBytes(32).toString('hex'),
    status: 'completed',
    outcome: 'qualified',
    score: 7,
    startedAt: new Date(now - 30000),
    expiresAt: new Date(now + lifetimeMs),
    completedAt: new Date(now - 1000),
    gameState: {
      phase: 'finished',
      round: 7,
      hits: 7,
      misses: 0,
    },
    events: [],
  });

  await PrizeDecision.create({
    _id: decisionId,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameSessionId: sessionId,
    gameId: 'monkey',
    status: 'pending_review',
    riskReasons: ['SANDBOX_TEST_REVIEW'],
  });

  return { decisionId, sessionId };
}

function review(admin, decisionId, action) {
  return reviewPrizeDecision({
    decisionId,
    adminId: admin._id,
    adminTokenVersion: 0,
    action,
  });
}

function auditCount(decisionId) {
  return AdminAuditLog.countDocuments({
    targetType: 'PrizeDecision',
    targetId: decisionId,
  });
}

async function test(name, callback) {
  await callback();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}

async function expectFailure(operation, allowedStatuses) {
  await assert.rejects(
    operation,
    error => allowedStatuses.includes(error.status || error.statusCode)
  );
}

async function testConcurrent(admin, decisionId, actions) {
  const results = await Promise.allSettled(
    actions.map(action => review(admin, decisionId, action))
  );

  const successful = results.filter(result => result.status === 'fulfilled');

  assert.equal(
    successful.length,
    1,
    'Exactly one concurrent review must succeed'
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      const status = result.reason.status || result.reason.statusCode;

      assert.ok(
        [403, 409].includes(status),
        `Unexpected rejection: ${result.reason.message}`
      );
    }
  }

  assert.equal(await auditCount(decisionId), 1);

  const decision = await PrizeDecision.findById(decisionId).lean();
  assert.equal(decision.status, successful[0].value.status);
}

async function readBrowserReview(record) {
  const [decision, audits] = await Promise.all([
    PrizeDecision.findById(record.decisionId)
      .select('status reviewedByAdminId')
      .lean(),
    AdminAuditLog.find({
      targetType: 'PrizeDecision',
      targetId: record.decisionId,
    })
      .select('action adminId')
      .lean(),
  ]);

  return {
    ...record,
    status: decision?.status ?? 'missing',
    reviewedByAdminId: decision?.reviewedByAdminId,
    audits,
  };
}

async function runBrowserTest() {
  const approve = await createPendingDecision(BROWSER_FIXTURE_LIFETIME_MS);
  const reject = await createPendingDecision(BROWSER_FIXTURE_LIFETIME_MS);

  const records = [
    {
      ...approve,
      label: 'Approve',
      expectedStatus: 'approved',
      expectedAuditAction: 'PRIZE_REVIEW_APPROVED',
    },
    {
      ...reject,
      label: 'Reject',
      expectedStatus: 'rejected',
      expectedAuditAction: 'PRIZE_REVIEW_REJECTED',
    },
  ];

  console.log(`Sandbox database: ${DB_NAME}`);
  console.log(`Campaign: ${CAMPAIGN_POLICY.campaignId}`);

  for (const record of records) {
    console.log(`${record.label} session: ${record.sessionId}`);
  }

  console.log('Open Admin → Prize reviews and refresh the pending_review queue.');
  console.log('Match the session IDs shown above. You have 10 minutes.');

  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error('The 10-minute browser test window expired'));
  }, BROWSER_TIMEOUT_MS);

  terminal.once('SIGINT', () => {
    controller.abort(new Error('Browser test cancelled'));
  });

  terminal.once('close', () => {
    controller.abort(new Error('PowerShell input closed'));
  });

  try {
    while (true) {
      let answer;

      try {
        answer = await terminal.question(
          '\nPress Enter to check both reviews, or type q to cancel. ',
          { signal: controller.signal }
        );
      } catch (error) {
        if (controller.signal.aborted) {
          throw controller.signal.reason;
        }

        throw error;
      }

      if (answer.trim().toLowerCase() === 'q') {
        throw new Error('Browser test cancelled');
      }

      const results = await Promise.all(records.map(readBrowserReview));

      for (const result of results) {
        console.log(
          `${result.label} session ${result.sessionId} | ` +
          `actual ${result.status} | expected ${result.expectedStatus} | ` +
          `audit records ${result.audits.length}`
        );

        if (result.status === 'pending_review') {
          continue;
        }

        assert.ok(
          result.status === result.expectedStatus,
          `${result.label} session has status "${result.status}". ` +
          `Expected "${result.expectedStatus}".`
        );

        assert.equal(
          result.audits.length,
          1,
          `${result.label} session must have exactly one audit record`
        );

        const [audit] = result.audits;

        assert.equal(
          audit.action,
          result.expectedAuditAction,
          `${result.label} session has an unexpected audit action`
        );

        assert.ok(
          result.reviewedByAdminId &&
          String(audit.adminId) === String(result.reviewedByAdminId),
          `${result.label} session audit must match the reviewing admin`
        );
      }

      if (results.every(result => result.status === result.expectedStatus)) {
        console.log('PASS: Browser approval, rejection, and audit records verified');
        return;
      }

      console.log('Finish the pending reviews in the browser, then check again.');
    }
  } finally {
    clearTimeout(timer);
    terminal.close();
  }
}

async function cleanup() {
  const auditFilter = {
    targetType: 'PrizeDecision',
    targetId: { $in: fixture.decisionIds },
  };

  const decisionFilter = { _id: { $in: fixture.decisionIds } };
  const sessionFilter = { _id: { $in: fixture.sessionIds } };
  const adminFilter = { _id: { $in: fixture.adminIds } };

  await AdminAuditLog.deleteMany(auditFilter);
  await PrizeDecision.deleteMany(decisionFilter);
  await GameSession.deleteMany(sessionFilter);
  await AdminUser.deleteMany(adminFilter);

  const remaining = await Promise.all([
    AdminAuditLog.countDocuments(auditFilter),
    PrizeDecision.countDocuments(decisionFilter),
    GameSession.countDocuments(sessionFilter),
    AdminUser.countDocuments(adminFilter),
  ]);

  assert.ok(remaining.every(count => count === 0), 'Sandbox fixture cleanup incomplete');
  console.log('PASS: All test fixtures cleaned up');
}

async function runTransactionTests() {
  const admin = await createAdmin();

  await test('Administrator approval creates audit', async () => {
    const { decisionId } = await createPendingDecision();
    const result = await review(admin, decisionId, 'approve');

    assert.equal(result.status, 'approved');
    assert.equal(result.prizeAllocated, false);
    assert.equal(result.drawExecuted, false);
    assert.equal(await auditCount(decisionId), 1);
  });

  await test('Administrator rejection creates audit', async () => {
    const { decisionId } = await createPendingDecision();
    const result = await review(admin, decisionId, 'reject');

    assert.equal(result.status, 'rejected');
    assert.equal(await auditCount(decisionId), 1);
  });

  await test('Duplicate approval is blocked', async () => {
    const { decisionId } = await createPendingDecision();

    await review(admin, decisionId, 'approve');
    await expectFailure(() => review(admin, decisionId, 'approve'), [409]);

    assert.equal(await auditCount(decisionId), 1);
  });

  await test('Concurrent approvals allow one winner', async () => {
    const { decisionId } = await createPendingDecision();

    await testConcurrent(admin, decisionId, ['approve', 'approve', 'approve']);
  });

  await test('Approve/reject race allows one decision', async () => {
    const { decisionId } = await createPendingDecision();

    await testConcurrent(admin, decisionId, ['approve', 'reject']);
  });

  await test('Disabled administrator cannot review', async () => {
    const disabled = await createAdmin({
      isActive: false,
      disabledAt: new Date(),
    });
    const { decisionId } = await createPendingDecision();

    await expectFailure(() => review(disabled, decisionId, 'approve'), [403]);

    const decision = await PrizeDecision.findById(decisionId).lean();
    assert.equal(decision.status, 'pending_review');
    assert.equal(await auditCount(decisionId), 0);
  });

  await test('Revoked administrator token is rejected', async () => {
    const revoked = await createAdmin({ tokenVersion: 1 });
    const { decisionId } = await createPendingDecision();

    await expectFailure(() => review(revoked, decisionId, 'approve'), [403]);

    const decision = await PrizeDecision.findById(decisionId).lean();
    assert.equal(decision.status, 'pending_review');
    assert.equal(await auditCount(decisionId), 0);
  });

  await test('Unqualified game cannot be approved', async () => {
    const { decisionId, sessionId } = await createPendingDecision();

    await GameSession.updateOne(
      { _id: sessionId },
      { $set: { outcome: 'not-qualified' } }
    );

    await expectFailure(() => review(admin, decisionId, 'approve'), [409]);

    const decision = await PrizeDecision.findById(decisionId).lean();
    assert.equal(decision.status, 'pending_review');
    assert.equal(await auditCount(decisionId), 0);
  });

  await test('Audit failure rolls back review and fence', async () => {
    const { decisionId } = await createPendingDecision();
    const before = await AdminUser.findById(admin._id).lean();
    const originalCreate = AdminAuditLog.create;

    try {
      AdminAuditLog.create = async () => {
        throw new Error('SANDBOX_FORCED_AUDIT_FAILURE');
      };

      await assert.rejects(
        () => review(admin, decisionId, 'approve'),
        /SANDBOX_FORCED_AUDIT_FAILURE/
      );
    } finally {
      AdminAuditLog.create = originalCreate;
    }

    const decision = await PrizeDecision.findById(decisionId).lean();
    const after = await AdminUser.findById(admin._id).lean();

    assert.equal(decision.status, 'pending_review');
    assert.equal(after.prizeReviewFence, before.prizeReviewFence);
    assert.equal(await auditCount(decisionId), 0);
  });

  await test('Concurrent token revocation remains consistent', async () => {
    const racingAdmin = await createAdmin();
    const { decisionId } = await createPendingDecision();

    const [reviewResult, revocation] = await Promise.allSettled([
      review(racingAdmin, decisionId, 'approve'),
      AdminUser.updateOne(
        { _id: racingAdmin._id },
        { $inc: { tokenVersion: 1 } }
      ),
    ]);

    assert.equal(revocation.status, 'fulfilled');
    assert.equal(revocation.value.modifiedCount, 1);

    const finalAdmin = await AdminUser.findById(racingAdmin._id).lean();
    const decision = await PrizeDecision.findById(decisionId).lean();

    assert.equal(finalAdmin.tokenVersion, 1);

    if (reviewResult.status === 'fulfilled') {
      assert.equal(decision.status, 'approved');
      assert.equal(await auditCount(decisionId), 1);
    } else {
      const status = reviewResult.reason.status || reviewResult.reason.statusCode;

      assert.ok([403, 409].includes(status));
      assert.equal(decision.status, 'pending_review');
      assert.equal(await auditCount(decisionId), 0);
    }
  });

  console.log(`\nRESULT: ${passed}/10 TRANSACTION TESTS PASSED`);
}

async function main() {
  const uri = checkConfiguration();
  const browserMode = process.argv.includes('--browser');

  if (browserMode && !process.stdin.isTTY) {
    throw new Error('Run --browser directly in an interactive PowerShell window');
  }

  try {
    await mongoose.connect(uri, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 15000,
    });

    await verifyPermissions();
    console.log('PASS: Restricted sandbox permissions verified');

    const indexes = await PrizeDecision.collection.indexes();

    assert.ok(
      indexes.some(index =>
        index.name === 'unique_prize_decision_per_session' &&
        index.unique === true &&
        index.key?.gameSessionId === 1
      ),
      'Required PrizeDecision unique index is missing'
    );

    console.log('PASS: PrizeDecision unique index verified');

    try {
      if (browserMode) {
        await runBrowserTest();
      } else {
        await runTransactionTests();
      }
    } finally {
      await cleanup();
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(`\nTEST FAILED: ${error.message}`);
  process.exitCode = 1;
});