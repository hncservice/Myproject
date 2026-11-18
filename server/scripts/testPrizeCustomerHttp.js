'use strict';

const assert = require('node:assert/strict');
const express = require('express');

const savedSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'isolated-decision-status-http-secret';

const owner = '111111111111111111111111';
const other = '222222222222222222222222';
const game = '333333333333333333333333';
const decisionId = '444444444444444444444444';

const savedCache = new Map();
let server;
let account;
let record;
let lookups;
let passed = 0;

function stub(path, exports) {
  const id = require.resolve(path);
  savedCache.set(id, require.cache[id]);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

function forbidden() {
  throw new Error('Unexpected operation in read-only status test');
}

async function main() {
  const { CAMPAIGN_POLICY } = require('../config/gameConfig');

  stub('../features/authentication/models/User', {
    findById: async id => String(id) === owner ? account : null,
  });
  stub('../features/vendors/models/Vendor', {
    findById: forbidden,
  });
  stub('../features/administration/models/AdminUser', {
    findById: forbidden,
  });

  stub('../features/prizes/models/PrizeDecision', {
    findOne(filter) {
      lookups++;
      assert.deepEqual(Object.keys(filter).sort(), [
        'campaignId', 'gameSessionId', 'userId',
      ]);
      assert.equal(String(filter.userId), owner);
      assert.equal(filter.campaignId, CAMPAIGN_POLICY.campaignId);

      return {
        select() { return this; },
        async lean() {
          return record &&
            String(record.userId) === String(filter.userId) &&
            record.gameSessionId === filter.gameSessionId &&
            record.campaignId === filter.campaignId
              ? { ...record }
              : null;
        },
      };
    },
  });

  // Keep unrelated route dependencies from loading gameplay or database services.
  stub('../features/games/controllers/gameController', {
    getStatus: forbidden, start: forbidden, getSession: forbidden,
    getHistory: forbidden, complete: forbidden,
  });
  stub('../features/games/controllers/monkeyGameplayController', {
    nextRound: forbidden, hit: forbidden,
  });
  stub('../features/games/controllers/perfectShotGameplayController', {
    nextShot: forbidden, shoot: forbidden,
  });
  stub('../features/prizes/services/prizeDecisionCreationService', {
    createPrizeDecision: forbidden,
  });

  const { signToken } = require('../config/jwt');
  const routes = require('../features/games/routes/gameRoutes');

  const app = express();
  app.use(express.json());
  app.use('/api/games', routes);
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({ code: error.code || 'UNEXPECTED_ERROR' });
  });

  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  function reset() {
    account = {
      _id: owner, isActive: true,
      emailVerified: true, tokenVersion: 0,
    };
    record = {
      _id: decisionId,
      userId: owner,
      gameSessionId: game,
      campaignId: CAMPAIGN_POLICY.campaignId,
      gameId: 'monkey',
      status: 'ready_for_draw',
      decision: null,
      decidedAt: null,
      // Deliberately present to test response field whitelisting.
      riskReasons: ['PRIVATE_TEST_RISK'],
      sessionTokenHash: 'PRIVATE_TEST_HASH',
      qrToken: 'PRIVATE_TEST_QR',
      reviewedByAdminId: other,
    };
    lookups = 0;
  }

  const token = (extra = {}) => signToken({
    id: owner, type: 'user', tokenVersion: 0, ...extra,
  }, '5m');

  async function get(value = token(), sessionId = game, suffix = '') {
    const response = await fetch(
      `${base}/api/games/prize-decision/${sessionId}${suffix}`,
      {
        headers: value === null ? {} : { Authorization: `Bearer ${value}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    return {
      status: response.status,
      body: await response.json(),
      cache: response.headers.get('cache-control'),
    };
  }

  async function check(name, fn) {
    reset();
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  }

  for (const scenario of [
    { name: 'Missing token', value: () => null, status: 401 },
    { name: 'Malformed token', value: () => 'invalid', status: 401 },
    { name: 'Vendor token', value: () => token({ type: 'vendor' }), status: 401 },
    { name: 'Admin token', value: () => token({ type: 'admin' }), status: 401 },
    { name: 'Unknown account', value: () => token({ id: other }), status: 401 },
    {
      name: 'Disabled account',
      setup: () => { account.isActive = false; },
      status: 403,
    },
    {
      name: 'Unverified account',
      setup: () => { account.emailVerified = false; },
      status: 403,
    },
    {
      name: 'Revoked token',
      setup: () => { account.tokenVersion = 1; },
      status: 401,
    },
  ]) {
    await check(scenario.name, async () => {
      scenario.setup?.();
      const result = await get(scenario.value ? scenario.value() : token());
      assert.equal(result.status, scenario.status);
      assert.equal(lookups, 0);
    });
  }

  for (const status of [
    'pending_review', 'ready_for_draw', 'approved',
    'rejected', 'no_prize', 'prize_awarded',
  ]) {
    await check(`Owner can read ${status} without leaking internal data`, async () => {
      record.status = status;
      const final = ['no_prize', 'prize_awarded'].includes(status);
      if (final) {
        record.decision = status === 'no_prize' ? 'NO_PRIZE' : 'PRIZE_AWARDED';
        record.decidedAt = new Date();
      }

      const result = await get();
      assert.equal(result.status, 200);
      assert.equal(result.cache, 'no-store');
      assert.equal(result.body.status, status);
      assert.equal(result.body.drawExecuted, final);
      assert.equal(result.body.prizeAllocated, status === 'prize_awarded');
      assert.deepEqual(Object.keys(result.body).sort(), [
        'campaignId', 'decidedAt', 'decisionId', 'drawExecuted',
        'gameId', 'gameSessionId', 'message', 'prizeAllocated', 'status',
      ]);
      assert.ok(!JSON.stringify(result.body).includes('PRIVATE_TEST'));
    });
  }

  for (const scenario of [
    { name: 'Another customer session', change: () => { record.userId = other; } },
    { name: 'Another campaign', change: () => { record.campaignId = 'other-campaign'; } },
    { name: 'Missing decision', change: () => { record = null; } },
  ]) {
    await check(scenario.name, async () => {
      scenario.change();
      const result = await get();
      assert.equal(result.status, 404);
      assert.equal(result.body.code, 'DECISION_NOT_FOUND');
    });
  }

  await check('Malformed session ID rejected before decision lookup', async () => {
    const result = await get(token(), 'invalid-id');
    assert.equal(result.status, 400);
    assert.equal(lookups, 0);
  });

  await check('Query userId cannot override authenticated identity', async () => {
    const result = await get(token(), game, `?userId=${other}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.gameSessionId, game);
  });

  for (const scenario of [
    { name: 'Unknown status', change: () => { record.status = 'invalid'; } },
    {
      name: 'Final status with missing final data',
      change: () => { record.status = 'prize_awarded'; },
    },
    {
      name: 'Nonfinal status with final data',
      change: () => { record.decision = 'NO_PRIZE'; },
    },
    {
      name: 'Contradictory final result',
      change: () => {
        record.status = 'no_prize';
        record.decision = 'PRIZE_AWARDED';
        record.decidedAt = new Date();
      },
    },
  ]) {
    await check(scenario.name, async () => {
      scenario.change();
      const result = await get();
      assert.equal(result.status, 503);
      assert.equal(result.body.code, 'INVALID_DECISION_STATE');
    });
  }

  async function postDraw(value = token(), body = {}, sessionId = game) {
    const response = await fetch(
      `${base}/api/games/prize-decision/${sessionId}/draw`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(value === null ? {} : { Authorization: `Bearer ${value}` }),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      }
    );
    return {
      status: response.status,
      body: await response.json(),
      cache: response.headers.get('cache-control'),
    };
  }

  for (const scenario of [
    { name: 'Missing draw token', value: () => null, status: 401 },
    { name: 'Vendor cannot draw', value: () => token({ type: 'vendor' }), status: 401 },
    { name: 'Admin cannot draw as customer', value: () => token({ type: 'admin' }), status: 401 },
  ]) {
    await check(scenario.name, async () => {
      const result = await postDraw(scenario.value());
      assert.equal(result.status, scenario.status);
      assert.equal(lookups, 0);
    });
  }

  for (const body of [
    { userId: other },
    { status: 'approved' },
    { prizeId: other },
    [],
  ]) {
    await check('Draw rejects client-controlled fields or invalid body', async () => {
      const result = await postDraw(token(), body);
      assert.equal(result.status, 400);
      assert.equal(result.body.code, 'INVALID_REQUEST');
      assert.equal(lookups, 0);
    });
  }

  await check('JSON null is rejected before controller execution', async () => {
    const result = await postDraw(token(), null);
    assert.equal(result.status, 400);
    assert.equal(lookups, 0);
  });

  await check('Draw rejects malformed game session ID', async () => {
    const result = await postDraw(token(), {}, 'invalid-id');
    assert.equal(result.status, 400);
    assert.equal(result.body.code, 'INVALID_REQUEST');
    assert.equal(lookups, 0);
  });

  await check('Real allocation gate blocks draw before database lookup', async () => {
    const result = await postDraw();
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'PRIZE_ALLOCATION_DISABLED');
    assert.equal(lookups, 0);
    assert.equal(require('mongoose').connection.readyState, 0);
  });

  const allocationService = require(
    '../features/prizes/services/prizeAllocationService'
  );
  const originalAllocate = allocationService.allocatePrize;

  try {
    await check('Draw forwards authenticated identity and hides raw QR token', async () => {
      let calls = 0;
      allocationService.allocatePrize = async input => {
        calls++;
        assert.equal(String(input.userId), owner);
        assert.equal(input.gameSessionId, game);
        assert.deepEqual(Object.keys(input).sort(), ['gameSessionId', 'userId']);

        record.status = 'prize_awarded';
        record.decision = 'PRIZE_AWARDED';
        record.decidedAt = new Date();

        return {
          status: 'PRIZE_AWARDED',
          qrToken: 'PRIVATE_ALLOCATOR_QR',
          internalField: 'PRIVATE_ALLOCATOR_DATA',
        };
      };

      const result = await postDraw();
      assert.equal(result.status, 200);
      assert.equal(calls, 1);
      assert.equal(result.cache, 'no-store');
      assert.equal(result.body.status, 'prize_awarded');
      assert.equal(result.body.prizeAllocated, true);
      assert.equal(result.body.allocationStatus, 'PRIZE_AWARDED');
      assert.ok(!JSON.stringify(result.body).includes('PRIVATE_'));
      assert.equal('qrToken' in result.body, false);
      assert.equal('internalField' in result.body, false);
    });

    await check('Draw forwards allocation rejection without reading status', async () => {
      allocationService.allocatePrize = async () => {
        throw Object.assign(new Error('Synthetic rejection'), {
          status: 409,
          code: 'PRIZE_DECISION_NOT_DRAWABLE',
        });
      };

      const result = await postDraw();
      assert.equal(result.status, 409);
      assert.equal(result.body.code, 'PRIZE_DECISION_NOT_DRAWABLE');
      assert.equal(lookups, 0);
    });
  } finally {
    allocationService.allocatePrize = originalAllocate;
  }
  // Prize-details HTTP checks.
  // Service ownership/link validation is covered separately
  // by testPrizeDecisionPrize.js.
  let prizeCalls = 0;
  let prizeFailure = null;

  stub('../features/prizes/services/prizeDecisionPrizeService', {
    async getPrizeDecisionPrize(input) {
      prizeCalls++;

      assert.deepEqual(
        Object.keys(input).sort(),
        ['gameSessionId', 'userId']
      );
      assert.equal(String(input.userId), owner);
      assert.equal(input.gameSessionId, game);

      if (prizeFailure) {
        throw Object.assign(
          new Error('Synthetic prize-details rejection'),
          prizeFailure
        );
      }

      return {
        gameSessionId: game,
        prize: {
          title: 'Test prize',
          description: 'HTTP fixture only',
          imageUrl: null,
        },
        redemptionStatus: 'pending',
        qrExpiry: null,
        expired: false,
        qrDataUrl: 'data:image/png;base64,TEST',
      };
    },
  });

  for (const scenario of [
    {
      name: 'Prize details: missing token',
      value: () => null,
      status: 401,
    },
    {
      name: 'Prize details: malformed token',
      value: () => 'invalid',
      status: 401,
    },
    {
      name: 'Prize details: vendor token',
      value: () => token({ type: 'vendor' }),
      status: 401,
    },
    {
      name: 'Prize details: admin token',
      value: () => token({ type: 'admin' }),
      status: 401,
    },
    {
      name: 'Prize details: unknown account',
      value: () => token({ id: other }),
      status: 401,
    },
    {
      name: 'Prize details: disabled account',
      setup: () => { account.isActive = false; },
      status: 403,
    },
    {
      name: 'Prize details: unverified account',
      setup: () => { account.emailVerified = false; },
      status: 403,
    },
    {
      name: 'Prize details: revoked token',
      setup: () => { account.tokenVersion = 1; },
      status: 401,
    },
  ]) {
    await check(scenario.name, async () => {
      prizeCalls = 0;
      prizeFailure = null;
      scenario.setup?.();

      const result = await get(
        scenario.value ? scenario.value() : token(),
        game,
        '/prize'
      );

      assert.equal(result.status, scenario.status);
      assert.equal(prizeCalls, 0);
      assert.equal(lookups, 0);
    });
  }

  await check(
    'Prize details: authenticated identity overrides query fields',
    async () => {
      prizeCalls = 0;
      prizeFailure = null;

      const result = await get(
        token(),
        game,
        `/prize?userId=${other}&gameSessionId=${other}`
      );

      assert.equal(result.status, 200);
      assert.equal(result.cache, 'no-store');
      assert.equal(prizeCalls, 1);
      assert.equal(lookups, 0);
      assert.equal(result.body.gameSessionId, game);
      assert.equal(result.body.prize.title, 'Test prize');
      assert.equal(
        result.body.qrDataUrl,
        'data:image/png;base64,TEST'
      );
      assert.equal('qrToken' in result.body, false);
    }
  );

  for (const failure of [
    { status: 400, code: 'INVALID_IDENTIFIERS' },
    { status: 404, code: 'DECISION_NOT_FOUND' },
    { status: 409, code: 'PRIZE_NOT_AWARDED' },
    { status: 503, code: 'PRIZE_DETAILS_UNAVAILABLE' },
  ]) {
    await check(
      `Prize details: forwards ${failure.code}`,
      async () => {
        prizeCalls = 0;
        prizeFailure = failure;

        const result = await get(token(), game, '/prize');

        assert.equal(result.status, failure.status);
        assert.equal(result.body.code, failure.code);
        assert.equal(result.cache, 'no-store');
        assert.equal(prizeCalls, 1);
        assert.equal(lookups, 0);
        assert.equal('qrDataUrl' in result.body, false);
      }
    );
  }

  prizeFailure = null;
  console.log(`\nPRIZE CUSTOMER HTTP: PASS (${passed} tests)`);
  console.log('Loopback HTTP only; account and decision lookups mocked.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    if (server) {
      const closed = new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      server.closeAllConnections?.();
      await closed;
    }
  } finally {
    for (const [id, original] of savedCache) {
      if (original === undefined) delete require.cache[id];
      else require.cache[id] = original;
    }
    if (savedSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedSecret;
  }
});


