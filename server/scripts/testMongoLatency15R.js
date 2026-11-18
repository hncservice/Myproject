
'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { performance } = require('node:perf_hooks');

const DATABASE = 'hnc_step15q_sandbox';
const uri = process.env.HNC_SANDBOX_MONGO_URI;

async function main() {
  if (!uri) {
    throw new Error('Sandbox URI missing');
  }

  const parsed = new URL(uri);

  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    parsed.pathname !== `/${DATABASE}` ||
    (
      parsed.searchParams.has('dbName') &&
      parsed.searchParams.get('dbName') !== DATABASE
    )
  ) {
    throw new Error('Sandbox database mismatch');
  }

  if (process.env.ALLOCATION_ENABLED !== 'false') {
    throw new Error('Prize allocation must be disabled');
  }

  try {
    const connectStart = performance.now();

    await mongoose.connect(uri, {
      dbName: DATABASE,
      serverSelectionTimeoutMS: 10000,
    });

    if (mongoose.connection.name !== DATABASE) {
      throw new Error('Connected to unexpected database');
    }

    console.log(
      'Sandbox connection time:',
      (performance.now() - connectStart).toFixed(0),
      'ms'
    );

    const durations = [];

    for (let i = 1; i <= 10; i++) {
      const start = performance.now();

      await mongoose.connection.db.command({
        ping: 1,
      });

      const elapsed = performance.now() - start;

      durations.push(elapsed);

      console.log(
        `MongoDB ping ${i}: ${elapsed.toFixed(0)} ms`
      );
    }

    const average = durations.reduce(
      (sum, value) => sum + value,
      0
    ) / durations.length;

    console.log(
      '\nAverage ping:',
      average.toFixed(0),
      'ms'
    );

    console.log(
      'Minimum ping:',
      Math.min(...durations).toFixed(0),
      'ms'
    );

    console.log(
      'Maximum ping:',
      Math.max(...durations).toFixed(0),
      'ms'
    );

    console.log(
      '\nHNC STEP 15R.18E: COMPLETE'
    );

    console.log('Database writes performed: 0');

  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error('Latency test failed:', error.message);
  process.exitCode = 1;
});
