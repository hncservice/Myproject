
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  generateGameplayFraudReport,
} = require('../features/fraud-monitoring/services/gameplayFraudReportService');

const original = {
  nodeEnv: process.env.NODE_ENV,
  flag: process.env.HNC_FRAUD_REPORT_SANDBOX_ENABLED,
  allocation: process.env.ALLOCATION_ENABLED,
};

let passed = 0;

function setEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function test(label, settings) {
  setEnv('NODE_ENV', settings.nodeEnv);
  setEnv(
    'HNC_FRAUD_REPORT_SANDBOX_ENABLED',
    settings.flag
  );
  setEnv('ALLOCATION_ENABLED', settings.allocation);

  await assert.rejects(
    generateGameplayFraudReport({
      sessionIds: [
        '507f1f77bcf86cd799439011',
      ],
      limit: 1,
    }),
    error => error.code === 'UNSAFE_REPORT_ENVIRONMENT'
  );

  passed++;

  console.log(`PASS ${passed}: ${label}`);
}

async function main() {
  assert.equal(
    mongoose.connection.readyState,
    0,
    'Test must not use a database connection'
  );

  try {
    await test('Disabled feature flag', {
      nodeEnv: 'test',
      flag: 'false',
      allocation: 'false',
    });

    await test('Missing feature flag', {
      nodeEnv: 'test',
      flag: undefined,
      allocation: 'false',
    });

    await test('Production environment blocked', {
      nodeEnv: 'production',
      flag: 'true',
      allocation: 'false',
    });

    await test('Development environment blocked', {
      nodeEnv: 'development',
      flag: 'true',
      allocation: 'false',
    });

    await test('Prize allocation enabled blocked', {
      nodeEnv: 'test',
      flag: 'true',
      allocation: 'true',
    });

    await test('Disconnected database blocked', {
      nodeEnv: 'test',
      flag: 'true',
      allocation: 'false',
    });

    assert.equal(passed, 6);

    console.log(
      `\nRESULT: ${passed}/6 TESTS PASSED`
    );
  } finally {
    setEnv('NODE_ENV', original.nodeEnv);
    setEnv(
      'HNC_FRAUD_REPORT_SANDBOX_ENABLED',
      original.flag
    );
    setEnv('ALLOCATION_ENABLED', original.allocation);
  }
}

main().catch(error => {
  console.error(
    'SERVICE ISOLATION TEST FAILED:',
    error.stack || error.message
  );

  process.exitCode = 1;
});
