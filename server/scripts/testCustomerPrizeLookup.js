'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const owner = '111111111111111111111111';
const other = '222222222222222222222222';

let records;
let qrCalls;
let lookups;
let passed = 0;

const mocks = {
  '../../prizes/models/WheelItem': {},
  '../../authentication/models/User': {},
  '../models/Spin': {
    findOne(filter) {
      lookups++;
      assert.equal(filter.userId, owner);
      assert.equal(filter.status, 'won');
      assert.equal(Object.keys(filter).length, 2);

      return {
        sort(order) {
          assert.equal(order.createdAt, -1);
          return this;
        },
        async populate(field, selection) {
          assert.equal(field, 'wheelItemId');
          assert.equal(selection, 'title description imageUrl');
          return records
            .filter(item =>
              item.userId === filter.userId &&
              item.status === filter.status
            )
            .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
        },
      };
    },
  },
  '../../prizes/services/qrService': {
    async generateQrDataUrl(token) {
      qrCalls.push(token);
      return 'data:image/png;base64,SYNTHETIC_QR';
    },
  },
  crypto: require('node:crypto'),
};

const source = fs.readFileSync(
  path.join(__dirname, '../features/games/controllers/spinController.js'),
  'utf8'
);

const isolated = { exports: {} };
const factory = vm.runInNewContext(
  `(function(require,module,exports){${source}\n})`,
  { console, Date }
);
factory(name => {
  if (!Object.hasOwn(mocks, name)) {
    throw new Error(`Unexpected dependency: ${name}`);
  }
  return mocks[name];
}, isolated, isolated.exports);

function win(overrides = {}) {
  return {
    _id: 'synthetic-spin',
    userId: owner,
    status: 'won',
    wheelItemId: {
      title: 'Synthetic prize',
      description: 'Test description',
      imageUrl: '/synthetic.png',
    },
    createdAt: new Date(),
    redemptionStatus: 'pending',
    qrToken: 'SYNTHETIC_OWNER_TOKEN',
    qrExpiry: null,
    ...overrides,
  };
}

async function request(user = owner, query = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    set(key, value) { this.headers[key] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
  await isolated.exports.getMyLatestWin({
    user: user ? { _id: user } : undefined,
    query,
  }, res);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  return res;
}

async function test(name, fn) {
  records = [];
  qrCalls = [];
  lookups = 0;
  await fn();
  passed++;
  console.log(`PASS: ${name}`);
}

async function main() {
  await test('Missing identity rejected before lookup', async () => {
    const res = await request(null);
    assert.equal(res.statusCode, 401);
    assert.equal(lookups, 0);
    assert.equal(qrCalls.length, 0);
  });

  await test('No winning record returns hasWin false', async () => {
    const res = await request();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.hasWin, false);
    assert.equal(qrCalls.length, 0);
  });

  await test('Another customer prize is not returned or encoded', async () => {
    records = [win({ userId: other })];
    const res = await request();
    assert.equal(res.body.hasWin, false);
    assert.equal(qrCalls.length, 0);
    assert.equal(JSON.stringify(res.body).includes('TOKEN'), false);
  });

  await test('Owner receives prize details and QR without caching', async () => {
    records = [win()];
    const res = await request();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.hasWin, true);
    assert.equal(res.body.win.prize.title, 'Synthetic prize');
    assert.equal(res.body.win.qrToken, 'SYNTHETIC_OWNER_TOKEN');
    assert.equal(res.body.win.qrDataUrl, 'data:image/png;base64,SYNTHETIC_QR');
    assert.equal(qrCalls.length, 1);
    assert.equal(qrCalls[0], 'SYNTHETIC_OWNER_TOKEN');
  });

  await test('Query userId cannot select another customer prize', async () => {
    records = [
      win(),
      win({ _id: 'other-spin', userId: other, qrToken: 'OTHER_TOKEN' }),
    ];
    const res = await request(owner, { userId: other });
    assert.equal(res.body.win.id, 'synthetic-spin');
    assert.equal(res.body.win.qrToken, 'SYNTHETIC_OWNER_TOKEN');
  });

  await test('Missing token does not invoke QR rendering', async () => {
    records = [win({ qrToken: null })];
    const res = await request();
    assert.equal(res.body.hasWin, true);
    assert.equal(res.body.win.qrDataUrl, null);
    assert.equal(qrCalls.length, 0);
  });

  await test('Latest owned win is selected', async () => {
    records = [
      win({ _id: 'older', createdAt: new Date(1000) }),
      win({ _id: 'newer', createdAt: new Date(2000), qrToken: 'NEWER_TOKEN' }),
    ];
    const res = await request();
    assert.equal(res.body.win.id, 'newer');
    assert.equal(qrCalls[0], 'NEWER_TOKEN');
  });

  console.log(`\nCUSTOMER PRIZE LOOKUP: PASS (${passed}/7)`);
  console.log('Offline controller checks; database and QR rendering mocked.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
