
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../features/authentication/models/User');
const {
  hashOtp,
} = require('../features/authentication/services/otpService');
const {
  consumeUserOtp,
} = require('../features/authentication/services/otpVerificationService');

const DB_NAME = 'hnc_step15o_sandbox';
const runId = crypto.randomUUID();

const URI =
  process.env.HNC_SANDBOX_MONGO_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;

const createdIds = [];

async function makeUser(otp = '123456', options = {}) {
  const hash = await hashOtp(otp);

  const user = await User.create({
    name: 'Step15O Test User',
    email:
      `step15o-${crypto.randomUUID()}@example.invalid`,
    passwordHash: 'test-only',
    emailVerified: options.verified || false,
    hasSpun: options.hasSpun || false,
    otpHash: hash,
    otpExpiresAt: new Date(
      Date.now() + (options.expired ? -60000 : 600000)
    ),
  });

  createdIds.push(user._id);
  return user;
}

async function verify(user, otp = '123456') {
  return consumeUserOtp({
    email: user.email,
    otp,
  });
}

async function expectCode(operation, code) {
  await assert.rejects(operation, err => {
    assert.equal(err.code, code);
    return true;
  });
}

async function testConcurrentOtp() {
  const user = await makeUser();

  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => verify(user))
  );

  const successes = results.filter(
    r => r.status === 'fulfilled'
  );

  assert.equal(successes.length, 1);

  const stored = await User.findById(user._id);

  assert.equal(stored.emailVerified, true);
  assert.equal(stored.otpHash, null);
  assert.equal(stored.otpExpiresAt, null);

  console.log(
    'PASS: Eight simultaneous verifications, one success'
  );
}

async function testReuse() {
  const user = await makeUser();

  await verify(user);

  await expectCode(
    () => verify(user),
    'OTP_NOT_REQUESTED'
  );

  console.log('PASS: Consumed OTP cannot be reused');
}

async function testWrongOtp() {
  const user = await makeUser();

  await expectCode(
    () => verify(user, '999999'),
    'INVALID_OTP'
  );

  const stored = await User.findById(user._id);

  assert.ok(stored.otpHash);
  assert.equal(stored.emailVerified, false);

  console.log('PASS: Incorrect OTP does not verify user');
}

async function testExpiredOtp() {
  const user = await makeUser('123456', {
    expired: true,
  });

  await expectCode(
    () => verify(user),
    'OTP_EXPIRED'
  );

  console.log('PASS: Expired OTP rejected');
}

async function testReplacedOtp() {
  const user = await makeUser();

  const oldHash = user.otpHash;

  // Simulates a newly issued OTP.
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        otpHash: await hashOtp('654321'),
      },
    }
  );

  await expectCode(
    () => verify(user, '123456'),
    'INVALID_OTP'
  );

  const stored = await User.findById(user._id);

  assert.notEqual(stored.otpHash, oldHash);
  assert.equal(stored.emailVerified, false);

  await verify(user, '654321');

  console.log('PASS: Replaced OTP invalidates old code');
}

async function testPreservesAccount() {
  const user = await makeUser('123456', {
    verified: true,
    hasSpun: true,
  });

  await verify(user);

  const stored = await User.findById(user._id);

  assert.equal(stored.emailVerified, true);
  assert.equal(stored.hasSpun, true);

  console.log('PASS: Existing user state preserved');
}

async function main() {
  if (!URI) {
    throw new Error('MongoDB URI missing');
  }

  let connected = false;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });

    connected = true;

    if (mongoose.connection.name !== DB_NAME) {
      throw new Error('DATABASE ISOLATION FAILED');
    }

    console.log('ISOLATED DATABASE:', DB_NAME);
    console.log('TEST RUN:', runId);

    await User.createIndexes();

    await testConcurrentOtp();
    await testReuse();
    await testWrongOtp();
    await testExpiredOtp();
    await testReplacedOtp();
    await testPreservesAccount();

    console.log('\nHNC STEP 15O: PASS (6/6 TESTS)');
  } catch (err) {
    console.error('\nHNC STEP 15O: FAIL', err);
    process.exitCode = 1;
  } finally {
    if (connected) {
      try {
        if (mongoose.connection.name === DB_NAME) {
          await User.deleteMany({
            _id: { $in: createdIds },
          });

          console.log('Sandbox test users cleaned up.');
        }
      } catch (err) {
        console.error('Cleanup failed:', err);
        process.exitCode = 1;
      }

      await mongoose.disconnect();
    }
  }
}

main();
