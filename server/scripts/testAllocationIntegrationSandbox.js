'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const DB = 'hnc_step15q_sandbox';
const uri = process.env.HNC_SANDBOX_MONGO_URI;
if (!uri) throw new Error('Sandbox URI missing');
const parsed = new URL(uri);

if (
  !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
  parsed.pathname !== '/' + DB ||
  (parsed.searchParams.has('dbName') &&
    parsed.searchParams.get('dbName') !== DB) ||
  process.env.ALLOCATION_ENABLED !== 'false' ||
  process.env.NODE_ENV === 'production'
) {
  throw new Error('Sandbox configuration rejected');
}

// Keep all outbound email in this test process.
const mailerPath = require.resolve('../config/mailer');
require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendMail: async () => ({
      accepted: [],
      rejected: [],
      messageId: 'sandbox-email-only',
    }),
  },
};

const Vendor = require('../features/vendors/models/Vendor');
const User = require('../features/authentication/models/User');
const GameSession = require('../features/games/models/GameSession');
const WheelItem = require('../features/prizes/models/WheelItem');
const Spin = require('../features/games/models/Spin');
const PrizeAward = require('../features/prizes/models/PrizeAward');
const PrizeDecision = require('../features/prizes/models/PrizeDecision');
const { CAMPAIGN_POLICY } = require('../config/gameConfig');

const models = [
  PrizeDecision,
  PrizeAward,
  Spin,
  GameSession,
  WheelItem,
  Vendor,
  User,
];

const tracked = new Map(models.map(model => [model, []]));
const run = crypto.randomUUID();
let allowedPrizes = [];
let connected = false;
let verified = false;
let passed = 0;

const originals = {
  find: WheelItem.find,
  spinCreate: Spin.create,
  awardCreate: PrizeAward.create,
  decisionSave: PrizeDecision.prototype.save,
};

function nextId(model) {
  const id = new mongoose.Types.ObjectId();
  tracked.get(model).push(id);
  return id;
}

function fixtureOnly(model, id) {
  assert.ok(tracked.get(model).some(value => String(value) === String(id)));
}

async function verifySandbox() {
  assert.equal(mongoose.connection.name, DB);

  const result = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles = result.authInfo?.authenticatedUserRoles || [];
  const privileges = result.authInfo?.authenticatedUserPrivileges || [];

  assert.equal(roles.length, 1);
  assert.equal(roles[0].role, 'readWrite');
  assert.equal(roles[0].db, DB);
  assert.ok(privileges.length > 0);

  for (const privilege of privileges) {
    assert.equal(privilege.resource?.db, DB);
    assert.equal(typeof privilege.resource?.collection, 'string');
    assert.notEqual(privilege.resource?.anyResource, true);
    assert.notEqual(privilege.resource?.cluster, true);
  }

  verified = true;
  console.log('PASS: Restricted sandbox verified');

  for (const [model, names] of [
    [PrizeDecision, ['unique_prize_decision_per_session']],
    [PrizeAward, [
      'one_prize_per_user_per_campaign',
      'unique_game_session_award',
      'unique_prize_spin',
      'unique_award_redemption_spin',
    ]],
  ]) {
    const indexes = await model.collection.indexes();

    for (const name of names) {
      assert.ok(indexes.some(index => index.name === name && index.unique));
    }
  }

  const spinIndexes = await Spin.collection.indexes();
  assert.ok(spinIndexes.some(index => index.key.qrToken === 1 && index.unique));
  console.log('PASS: Required unique indexes already exist');
}

function loadTestService() {
  const file = path.resolve(
    __dirname,
    '../features/prizes/services/prizeAllocationService.js'
  );
  const source = fs.readFileSync(file, 'utf8');
  // assert.match(source, /const ALLOCATION_ENABLED = false;/);

  const isolated = new Module(file, module);
  isolated.filename = file;
  isolated.paths = Module._nodeModulePaths(path.dirname(file));
  const normalRequire = isolated.require.bind(isolated);

  isolated.require = name => name === 'crypto'
    ? { ...crypto, randomInt: () => 0 }
    : normalRequire(name);

  isolated._compile(
    source + '\nmodule.exports.testTransaction = performAllocationTransaction;\n',
    file
  );

  return isolated.exports;
}

function installFixtureGuards() {
  WheelItem.find = function (filter, ...args) {
    return originals.find.call(this, {
      $and: [
        filter,
        { _id: { $in: allowedPrizes } },
      ],
    }, ...args);
  };

  Spin.create = async function (records, options) {
    assert.ok(Array.isArray(records));
    assert.ok(options?.session);

    for (const record of records) {
      fixtureOnly(User, record.userId);
      fixtureOnly(WheelItem, record.wheelItemId);
      assert.equal(record._id, undefined);
      record._id = nextId(Spin);
    }

    return originals.spinCreate.call(this, records, options);
  };

  PrizeAward.create = async function (records, options) {
    assert.ok(Array.isArray(records));
    assert.ok(options?.session);

    for (const record of records) {
      fixtureOnly(User, record.userId);
      fixtureOnly(GameSession, record.gameSessionId);
      fixtureOnly(Spin, record.redemptionSpinId);
      fixtureOnly(WheelItem, record.wheelItemId);
      assert.equal(record.spinId, undefined);
      assert.equal(record._id, undefined);
      record._id = nextId(PrizeAward);
    }

    return originals.awardCreate.call(this, records, options);
  };
}

async function customer() {
  const _id = nextId(User);

  await User.create({
    _id,
    name: 'Synthetic allocation customer',
    email: `allocation-${run}-${_id}@sandbox.invalid`,
    passwordHash: 'SYNTHETIC_NOT_A_LOGIN_PASSWORD',
    emailVerified: true,
    hasSpun: false,
  });

  return _id;
}

async function game(userId, gameId = 'monkey', status = 'ready_for_draw') {
  const _id = nextId(GameSession);
  const decisionId = nextId(PrizeDecision);
  const now = Date.now();

  await GameSession.create({
    _id,
    userId,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId,
    attemptNumber: 1,
    sessionTokenHash: crypto.randomBytes(32).toString('hex'),
    status: 'completed',
    outcome: 'qualified',
    score: gameId === 'monkey' ? 7 : 400,
    startedAt: new Date(now - 30000),
    completedAt: new Date(now - 1000),
    expiresAt: new Date(now + 60000),
    gameState: { revision: 1, phase: 'finished' },
    events: [],
  });

  await PrizeDecision.create({
    _id: decisionId,
    userId,
    gameSessionId: _id,
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId,
    status,
    riskReasons: [],
  });

  return { userId, gameSessionId: _id, decisionId };
}

async function prize() {
  const _id = nextId(WheelItem);

  await WheelItem.create({
    _id,
    title: `Synthetic allocation prize ${run}`,
    probabilityWeight: 1,
    quantityTotal: 1,
    quantityAllocated: 0,
    quantityRedeemed: 0,
    isActive: true,
  });

  allowedPrizes = [_id];
  return _id;
}

async function records(data) {
  return {
    user: await User.findById(data.userId).lean(),
    game: await GameSession.findById(data.gameSessionId).lean(),
    decision: await PrizeDecision.findById(data.decisionId).lean(),
    spins: await Spin.find({ userId: data.userId }).lean(),
    awards: await PrizeAward.find({ userId: data.userId }).lean(),
  };
}

async function check(name, callback) {
  allowedPrizes = [];
  await callback();
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}

async function checkHttpAllocation(allocate) {
  const express = require('express');
  const { signToken } = require('../config/jwt');
  const allocationService = require('../features/prizes/services/prizeAllocationService');
  const gameRoutes = require('../features/games/routes/gameRoutes');
  const vendorRoutes = require('../features/vendors/routes/vendorRoutes');
  const originalAllocate = allocationService.allocatePrize;

  const app = express();
  app.use(express.json());
  app.use('/api/games', gameRoutes);
  app.use('/api/vendor', vendorRoutes);

  app.use((error, req, res, next) => {
    res.status(error.status || error.statusCode || 500).json({
      code: error.code || 'UNEXPECTED_ERROR',
    });
  });

  const listener = await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });

  const baseUrl = `http://127.0.0.1:${listener.address().port}`;

  async function request(route, id, type, body) {
    const token = signToken({ id: String(id), type, tokenVersion: 0 }, '5m');
    const options = {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    };

    if (body !== undefined) {
      options.method = 'POST';
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(baseUrl + route, options);
    return { status: response.status, body: await response.json() };
  }

  function customerRequest(userId, gameSessionId, suffix = '', body) {
    fixtureOnly(User, userId);
    fixtureOnly(GameSession, gameSessionId);

    return request(
      `/api/games/prize-decision/${gameSessionId}${suffix}`,
      userId,
      'user',
      body
    );
  }

  function draw(userId, gameSessionId) {
    return customerRequest(userId, gameSessionId, '/draw', {});
  }

  async function checkRedemption(data, prizeId, spin) {
    fixtureOnly(WheelItem, prizeId);
    fixtureOnly(Spin, spin._id);
    assert.equal(String(spin.userId), String(data.userId));
    assert.equal(String(spin.wheelItemId), String(prizeId));

    const pending = await customerRequest(
      data.userId,
      data.gameSessionId,
      '/prize'
    );

    assert.equal(pending.status, 200, 'Could not read pending prize details');
    assert.equal(pending.body.gameSessionId, String(data.gameSessionId));
    assert.equal(pending.body.redemptionStatus, 'pending');
    assert.equal(pending.body.expired, false);
    assert.equal('qrToken' in pending.body, false);

    const inventory = await WheelItem.findById(prizeId).lean();
    assert.equal(pending.body.prize?.title, inventory.title);

    assert.ok(
      typeof pending.body.qrDataUrl === 'string' &&
        /^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(pending.body.qrDataUrl),
      'Expected a PNG QR image in the pending prize response'
    );
    assert.ok(
      typeof spin.qrToken === 'string' && spin.qrToken.length > 0,
      'Expected a token on the sandbox redemption record'
    );

    const vendorId = nextId(Vendor);
    await Vendor.create({
      _id: vendorId,
      name: 'Synthetic Perfect Shot redemption vendor',
      email: `redemption-${run}@sandbox.invalid`,
      passwordHash: 'sandbox-fixture-only',
      isActive: true,
      tokenVersion: 0,
      redemptionFence: 0,
    });

    const scan = () =>
      request('/api/vendor/scan', vendorId, 'vendor', { qrToken: spin.qrToken });

    const firstScan = await scan();
    assert.equal(
      firstScan.status,
      200,
      `First scan returned HTTP ${firstScan.status} (${firstScan.body.code ?? 'no code'})`
    );

    const duplicate = await scan();
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'ALREADY_REDEEMED');

    const redeemedStock = await WheelItem.findById(prizeId).lean();
    assert.equal(redeemedStock.quantityAllocated, 1);
    assert.equal(redeemedStock.quantityRedeemed, 1);

    const redeemed = await customerRequest(
      data.userId,
      data.gameSessionId,
      '/prize'
    );

    assert.equal(redeemed.status, 200);
    assert.equal(redeemed.body.gameSessionId, String(data.gameSessionId));
    assert.equal(redeemed.body.redemptionStatus, 'redeemed');
    assert.equal('qrToken' in redeemed.body, false);

    console.log('PASS: Perfect Shot QR retrieved, redeemed once, and read back');
  }

  async function assertDisabled(data) {
    const response = await draw(data.userId, data.gameSessionId);
    assert.equal(response.status, 503, JSON.stringify(response.body));
    assert.equal(response.body.code, 'PRIZE_ALLOCATION_DISABLED');
  }

  try {
    for (const winning of [true, false]) {
      const gameId = winning ? 'perfect-shot' : 'monkey';
      const expectedStatus = winning ? 'prize_awarded' : 'no_prize';
      const expectedResult = winning ? 'PRIZE_AWARDED' : 'NO_PRIZE';
      const expectedCount = winning ? 1 : 0;

      await check(
        `HTTP ${gameId} ${expectedStatus} is readable and persists on retry`,
        async () => {
          const data = await game(await customer(), gameId);
          const prizeId = winning ? await prize() : null;
          await assertDisabled(data);

          allocationService.allocatePrize = input => {
            fixtureOnly(User, input.userId);
            fixtureOnly(GameSession, input.gameSessionId);
            return allocate(input);
          };

          if (winning) {
            const otherUserId = await customer();
            const otherBefore = await User.findById(otherUserId).lean();
            const denied = await draw(otherUserId, data.gameSessionId);

            assert.ok(
              [403, 404].includes(denied.status),
              'Expected ownership rejection, got ' +
                denied.status + ': ' + JSON.stringify(denied.body)
            );

            const unchanged = await records(data);
            const otherAfter = await User.findById(otherUserId).lean();
            assert.equal(unchanged.decision.status, 'ready_for_draw');
            assert.equal(unchanged.awards.length, 0);
            assert.equal(unchanged.spins.length, 0);
            assert.equal(
              otherAfter.prizeAllocationFence ?? 0,
              otherBefore.prizeAllocationFence ?? 0
            );
            assert.equal(
              (await WheelItem.findById(prizeId).lean()).quantityAllocated,
              0
            );
          }

          const first = await draw(data.userId, data.gameSessionId);
          assert.equal(first.status, 200, JSON.stringify(first.body));
          assert.equal(first.body.status, expectedStatus);
          assert.equal(first.body.allocationStatus, expectedResult);
          assert.equal('qrToken' in first.body, false);

          const beforeRetry = await records(data);
          assert.equal(beforeRetry.decision.status, expectedStatus);
          assert.equal(beforeRetry.decision.decision, expectedResult);
          assert.equal(beforeRetry.awards.length, expectedCount);
          assert.equal(beforeRetry.spins.length, expectedCount);

          if (winning) {
            assert.equal(
              (await WheelItem.findById(prizeId).lean()).quantityAllocated,
              1
            );
          }

          const saved = await customerRequest(data.userId, data.gameSessionId);
          assert.equal(saved.status, 200, JSON.stringify(saved.body));
          assert.equal(saved.body.gameSessionId, String(data.gameSessionId));
          assert.equal(saved.body.gameId, gameId);
          assert.equal(saved.body.status, expectedStatus);
          assert.equal(saved.body.drawExecuted, true);
          assert.equal(saved.body.prizeAllocated, winning);

          const retry = await draw(data.userId, data.gameSessionId);
          assert.equal(retry.status, 200, JSON.stringify(retry.body));
          assert.equal(retry.body.status, expectedStatus);
          assert.equal(retry.body.allocationStatus, 'ALREADY_RESOLVED');

          const afterRetry = await records(data);
          assert.equal(afterRetry.decision.status, expectedStatus);
          assert.equal(afterRetry.decision.decision, expectedResult);
          assert.equal(
            afterRetry.decision.decidedAt.getTime(),
            beforeRetry.decision.decidedAt.getTime()
          );
          assert.deepEqual(
            afterRetry.awards.map(item => String(item._id)),
            beforeRetry.awards.map(item => String(item._id))
          );
          assert.deepEqual(
            afterRetry.spins.map(item => String(item._id)),
            beforeRetry.spins.map(item => String(item._id))
          );

          if (winning) {
            assert.equal(
              (await WheelItem.findById(prizeId).lean()).quantityAllocated,
              1
            );
          }

          allocationService.allocatePrize = originalAllocate;
          await assertDisabled(data);

          if (winning) {
            await checkRedemption(data, prizeId, afterRetry.spins[0]);
          }
        }
      );
    }
  } finally {
    allocationService.allocatePrize = originalAllocate;
    await new Promise((resolve, reject) => {
      listener.close(error => error ? reject(error) : resolve());
    });
  }
}

async function main() {
  try {
    await mongoose.connect(uri, {
      dbName: DB,
      autoIndex: false,
      autoCreate: false,
      serverSelectionTimeoutMS: 10000,
    });

    connected = true;
    await verifySandbox();
    installFixtureGuards();

    const service = loadTestService();
    const allocate = data => service.testTransaction({
      userId: data.userId,
      gameSessionId: data.gameSessionId,
    });

    await assert.rejects(
      () => service.allocatePrize({}),
      error => error.code === 'PRIZE_ALLOCATION_DISABLED'
    );

    await check('No Prize persists both records and does not redraw', async () => {
      const data = await game(await customer());
      assert.equal((await allocate(data)).status, 'NO_PRIZE');

      let current = await records(data);
      assert.equal(current.decision.status, 'no_prize');
      assert.equal(current.decision.decision, 'NO_PRIZE');
      assert.equal(current.game.gameState.prizeDecision.result, 'NO_PRIZE');

      const decidedAt = current.decision.decidedAt.getTime();
      assert.equal((await allocate(data)).status, 'ALREADY_RESOLVED');

      current = await records(data);
      assert.equal(current.decision.decidedAt.getTime(), decidedAt);
      assert.equal(current.spins.length, 0);
      assert.equal(current.awards.length, 0);
    });

    await check('Winning result saves final decision and game-source QR link', async () => {
      const data = await game(await customer());
      const prizeId = await prize();
      const result = await allocate(data);
      assert.equal(result.status, 'PRIZE_AWARDED');

      const current = await records(data);
      assert.equal(current.spins.length, 1);
      assert.equal(current.awards.length, 1);
      assert.equal(current.awards[0].spinId, null);
      assert.equal(
        String(current.awards[0].gameSessionId),
        String(data.gameSessionId)
      );
      assert.equal(
        String(current.awards[0].redemptionSpinId),
        String(current.spins[0]._id)
      );
      assert.equal(current.decision.status, 'prize_awarded');
      assert.equal(
        String(current.decision.prizeAwardId),
        String(current.awards[0]._id)
      );
      assert.equal(
        String(current.game.gameState.prizeDecision.awardId),
        String(current.awards[0]._id)
      );
      assert.equal(
        (await WheelItem.findById(prizeId).lean()).quantityAllocated,
        1
      );

      assert.equal((await allocate(data)).status, 'ALREADY_RESOLVED');
      assert.equal(await PrizeAward.countDocuments({ userId: data.userId }), 1);
      assert.equal(
        (await WheelItem.findById(prizeId).lean()).quantityAllocated,
        1,
        'A draw retry must not allocate another unit'
      );
    });

    await check('Pending review cannot allocate or commit a customer fence', async () => {
      const data = await game(await customer(), 'monkey', 'pending_review');
      const prizeId = await prize();
      const before = await records(data);

      await assert.rejects(
        () => allocate(data),
        error => error.code === 'PRIZE_DECISION_NOT_DRAWABLE'
      );

      const after = await records(data);
      assert.equal(
        after.user.prizeAllocationFence ?? 0,
        before.user.prizeAllocationFence ?? 0
      );
      assert.equal(after.decision.status, 'pending_review');
      assert.equal(after.awards.length, 0);
      assert.equal(after.spins.length, 0);
      assert.equal(
        (await WheelItem.findById(prizeId).lean()).quantityAllocated,
        0
      );
    });

    for (const winning of [false, true]) {
      await check(
        `${winning ? 'Award' : 'No Prize'} final-save failure rolls back transaction`,
        async () => {
          const data = await game(await customer());
          const prizeId = winning ? await prize() : null;
          const before = await records(data);

          PrizeDecision.prototype.save = async function (...args) {
            if (String(this._id) === String(data.decisionId)) {
              throw new Error('SYNTHETIC_FINAL_SAVE_FAILURE');
            }
            return originals.decisionSave.apply(this, args);
          };

          try {
            await assert.rejects(
              () => allocate(data),
              /SYNTHETIC_FINAL_SAVE_FAILURE/
            );
          } finally {
            PrizeDecision.prototype.save = originals.decisionSave;
          }

          const after = await records(data);
          assert.equal(after.decision.status, 'ready_for_draw');
          assert.equal(after.game.gameState.prizeDecision, undefined);
          assert.equal(after.user.hasSpun, false);
          assert.equal(
            after.user.prizeAllocationFence ?? 0,
            before.user.prizeAllocationFence ?? 0
          );
          assert.equal(after.spins.length, 0);
          assert.equal(after.awards.length, 0);

          if (prizeId) {
            assert.equal(
              (await WheelItem.findById(prizeId).lean()).quantityAllocated,
              0
            );
          }
        }
      );
    }

    await check('Concurrent requests across both games issue one campaign award', async () => {
      const userId = await customer();
      const first = await game(userId, 'monkey');
      const second = await game(userId, 'perfect-shot');
      const prizeId = await prize();

      const results = await Promise.allSettled([
        allocate(first),
        allocate(second),
        allocate(first),
      ]);

      for (const result of results) {
        if (result.status === 'rejected') throw result.reason;
      }

      assert.equal(
        results.filter(item => item.value.status === 'PRIZE_AWARDED').length,
        1
      );
      assert.equal(await PrizeAward.countDocuments({ userId }), 1);
      assert.equal(await Spin.countDocuments({ userId }), 1);
      assert.equal(
        (await WheelItem.findById(prizeId).lean()).quantityAllocated,
        1
      );

      const decisions = await PrizeDecision.find({ userId }).lean();
      assert.equal(
        decisions.filter(item => item.status === 'prize_awarded').length,
        1
      );
    });

    await checkHttpAllocation(allocate);

    console.log(`\nALLOCATION SANDBOX: PASS (${passed}/8)`);
    console.log('Public allocation stayed disabled. HTTP tests used loopback only.');
  } finally {
    WheelItem.find = originals.find;
    Spin.create = originals.spinCreate;
    PrizeAward.create = originals.awardCreate;
    PrizeDecision.prototype.save = originals.decisionSave;

    try {
      if (connected && verified) {
        assert.equal(mongoose.connection.name, DB);

        for (const model of models) {
          await model.deleteMany({ _id: { $in: tracked.get(model) } });
        }

        for (const model of models) {
          assert.equal(
            await model.countDocuments({ _id: { $in: tracked.get(model) } }),
            0,
            `${model.modelName} cleanup incomplete`
          );
        }

        console.log('PASS: All allocation sandbox fixtures cleaned up');
      }
    } finally {
      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error('ALLOCATION SANDBOX FAILED:', error.stack || error.message);
  process.exitCode = 1;
});