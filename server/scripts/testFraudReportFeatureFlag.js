
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');

const mongoose = require('mongoose');

const {
  getGameplayFraudReport,
} = require('../features/fraud-monitoring/controllers/gameplayFraudReportController');

const original = {
  NODE_ENV: process.env.NODE_ENV,
  FLAG: process.env.HNC_FRAUD_REPORT_SANDBOX_ENABLED,
  ALLOCATION: process.env.ALLOCATION_ENABLED,
};

let passed = 0;

function setEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},

    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke() {
  const req = {
    body: {
      sessionIds: [
        '507f1f77bcf86cd799439011',
      ],
    },
  };

  const res = response();

  await getGameplayFraudReport(req, res);

  return res;
}

async function test(label, settings) {
  setEnv('NODE_ENV', settings.nodeEnv);
  setEnv(
    'HNC_FRAUD_REPORT_SANDBOX_ENABLED',
    settings.flag
  );
  setEnv('ALLOCATION_ENABLED', settings.allocation);

  const result = await invoke();

  assert.equal(result.statusCode, 503);
  assert.equal(
    result.body.code,
    'REPORT_NOT_AVAILABLE'
  );

  assert.equal(
    result.headers['cache-control'],
    'no-store'
  );

  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

async function main() {
  // This test must not have an active DB connection.
  assert.equal(mongoose.connection.readyState, 0);

  await test('Feature flag disabled', {
    nodeEnv: 'test',
    flag: 'false',
    allocation: 'false',
  });

  await test('Feature flag missing', {
    nodeEnv: 'test',
    flag: undefined,
    allocation: 'false',
  });

  await test('Production environment rejected', {
    nodeEnv: 'production',
    flag: 'true',
    allocation: 'false',
  });

  await test('Development environment rejected', {
    nodeEnv: 'development',
    flag: 'true',
    allocation: 'false',
  });

  await test('Prize allocation enabled rejected', {
    nodeEnv: 'test',
    flag: 'true',
    allocation: 'true',
  });

  await test('Disconnected database rejected', {
    nodeEnv: 'test',
    flag: 'true',
    allocation: 'false',
  });

  assert.equal(passed, 6);

  console.log(
    `\nRESULT: ${passed}/6 TESTS PASSED`
  );
}

main()
  .catch(error => {
    console.error(
      'FEATURE FLAG TEST FAILED:',
      error.stack || error.message
    );
    process.exitCode = 1;
  })
  .finally(() => {
    setEnv('NODE_ENV', original.NODE_ENV);
    setEnv(
      'HNC_FRAUD_REPORT_SANDBOX_ENABLED',
      original.FLAG
    );
    setEnv(
      'ALLOCATION_ENABLED',
      original.ALLOCATION
    );
  });
