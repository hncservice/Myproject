
'use strict';

require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const DB_NAME = 'hnc_step15q_sandbox';
const URI = process.env.HNC_SANDBOX_MONGO_URI;

if (!URI) {
  throw new Error('Sandbox URI missing');
}

const parsed = new URL(URI);

if (
  !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
  parsed.pathname !== `/${DB_NAME}` ||
  (parsed.searchParams.has('dbName') &&
    parsed.searchParams.get('dbName') !== DB_NAME)
) {
  throw new Error('SAFETY BLOCK: Wrong database URI');
}

// Prevent SMTP transport initialization.
const mailerPath = require.resolve('../config/mailer');

require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendMail: async () => {
      throw new Error('Real mail delivery blocked');
    },
  },
};

const emailService = require('../infrastructure/email/emailService');

const otps = new Map();

emailService.sendOtpEmail = async (email, otp) => {
  otps.set(email.toLowerCase(), otp);
};

emailService.sendPrizeEmail = async () => {
  throw new Error('Unexpected prize email');
};

emailService.sendRedemptionEmail = async () => {
  throw new Error('Unexpected redemption email');
};

const User = require('../features/authentication/models/User');
const controller = require('../features/authentication/controllers/authController');

const runId = crypto.randomBytes(8).toString('hex');

const emails = [
  `reg-${runId}@example.com`,
  `pending-${runId}@example.com`,
  `legacy-${runId}@example.com`,
];

const phone = n =>
  String(70000000 + n);

async function request(base, path, body) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function verifyPermissions() {
  const result = await mongoose.connection.db.admin()
    .command({
      connectionStatus: 1,
      showPrivileges: true,
    });

  const privileges =
    result.authInfo.authenticatedUserPrivileges || [];

  for (const action of [
    'find', 'insert', 'update', 'remove',
  ]) {
    assert.ok(
      privileges.some(p =>
        p.resource?.db === DB_NAME &&
        p.actions?.includes(action)
      ),
      `Missing sandbox permission: ${action}`
    );
  }

  assert.equal(
    privileges.filter(p =>
      p.resource?.db === '' ||
      (
        p.resource?.db &&
        p.resource.db !== DB_NAME
      )
    ).length,
    0,
    'Unexpected database privileges'
  );
}

async function main() {
  let server;
  let connected = false;

  try {
    await mongoose.connect(URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 10000,
      autoIndex: false,
      autoCreate: false,
    });

    connected = true;

    assert.equal(mongoose.connection.name, DB_NAME);
    await verifyPermissions();

    console.log('Sandbox isolation: VERIFIED');

    const app = express();
    app.use(express.json());

    // Actual controller handlers, without test-wide
    // rate limiter side effects.
    app.post('/api/auth/register',
      controller.registerUser);
    app.post('/api/auth/user/login',
      controller.loginUser);
    app.post('/api/auth/verify-otp',
      controller.verifyUserOtp);

    server = await new Promise((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1',
        () => resolve(s));
      s.once('error', reject);
    });

    const base =
      `http://127.0.0.1:${server.address().port}`;

    const [regEmail, pendingEmail, legacyEmail] =
      emails;

    // TEST 1: New registration creates OTP purpose.
    const reg = await request(
  base, '/api/auth/register', {
    name: 'Sandbox Customer',
    email: regEmail,
    phone: phone(101),
    password: 'SandboxPassword123!',
  }
);

console.log('REGISTRATION HTTP STATUS:', reg.status);
console.log('REGISTRATION RESPONSE:', reg.body);

assert.equal(
  reg.status,
  200,
  `Registration failed: ${JSON.stringify(reg.body)}`
);

    let user = await User.findOne({
      email: regEmail,
    });

    assert.equal(user.emailVerified, false);
    assert.equal(user.otpPurpose, 'registration');

    console.log('PASS 1: Registration purpose set');

    // TEST 2: Wrong OTP cannot verify.
    const correctOtp = otps.get(regEmail);
    const wrongOtp =
      correctOtp === '000000' ? '000001' : '000000';

    const wrong = await request(
      base, '/api/auth/verify-otp', {
        email: regEmail,
        otp: wrongOtp,
      }
    );

    assert.equal(wrong.status, 400);

    console.log('PASS 2: Wrong OTP rejected');

    // TEST 3: Registration verifies successfully.
    const verified = await request(
      base, '/api/auth/verify-otp', {
        email: regEmail,
        otp: correctOtp,
      }
    );

    assert.equal(verified.status, 200);
    assert.ok(verified.body.token);

    user = await User.findOne({ email: regEmail });

    assert.equal(user.emailVerified, true);
    assert.equal(user.otpPurpose, null);
    assert.equal(user.otpHash, null);

    console.log('PASS 3: Registration verified');

    // TEST 4: OTP replay fails.
    const replay = await request(
      base, '/api/auth/verify-otp', {
        email: regEmail,
        otp: correctOtp,
      }
    );

    assert.notEqual(replay.status, 200);

    console.log('PASS 4: OTP replay rejected');

    // TEST 5: Login OTP has login purpose.
    const login = await request(
      base, '/api/auth/user/login', {
        email: regEmail,
        password: 'SandboxPassword123!',
      }
    );

    assert.equal(login.status, 200);
    assert.equal(login.body.requiresOtp, true);

    user = await User.findOne({ email: regEmail });

    assert.equal(user.otpPurpose, 'login');

    console.log('PASS 5: Login purpose set');

    // TEST 6: Login OTP verifies.
    const loginVerified = await request(
      base, '/api/auth/verify-otp', {
        email: regEmail,
        otp: otps.get(regEmail),
      }
    );

    assert.equal(loginVerified.status, 200);
    assert.ok(loginVerified.body.token);

    console.log('PASS 6: Login OTP verified');

    // TEST 7: Existing unverified password protected.
    const oldHash = await bcrypt.hash(
      'OriginalPassword123!', 10);

    await User.create({
      name: 'Unverified Customer',
      email: pendingEmail,
      phone: phone(102),
      passwordHash: oldHash,
      emailVerified: false,
    });

    const pendingReg = await request(
      base, '/api/auth/register', {
        name: 'Updated Customer',
        email: pendingEmail,
        phone: phone(103),
        password: 'NewPassword123!',
      }
    );

    assert.equal(pendingReg.status, 200);

    const pendingUser = await User.findOne({
      email: pendingEmail,
    });

    assert.equal(pendingUser.passwordHash, oldHash);
    assert.equal(pendingUser.phone, phone(102));
    assert.equal(
      pendingUser.pendingRegistration.name,
      'Updated Customer'
    );

    console.log(
      'PASS 7: Pending changes do not overwrite account'
    );

    // TEST 8: Pending changes apply after OTP.
    const pendingVerify = await request(
      base, '/api/auth/verify-otp', {
        email: pendingEmail,
        otp: otps.get(pendingEmail),
      }
    );

    assert.equal(pendingVerify.status, 200);

    const updatedUser = await User.findOne({
      email: pendingEmail,
    });

    assert.equal(updatedUser.emailVerified, true);
    assert.equal(updatedUser.name, 'Updated Customer');
    assert.equal(updatedUser.phone, phone(103));

    assert.equal(
      await bcrypt.compare(
        'NewPassword123!',
        updatedUser.passwordHash
      ),
      true
    );

    console.log(
      'PASS 8: Pending changes applied after OTP'
    );

    // TEST 9: Legacy OTP without purpose rejected.
    await User.create({
      name: 'Legacy OTP Customer',
      email: legacyEmail,
      phone: phone(104),
      passwordHash: oldHash,
      emailVerified: true,
      otpHash: await bcrypt.hash('123456', 10),
      otpExpiresAt: new Date(Date.now() + 600000),
      otpPurpose: null,
    });

    const legacy = await request(
      base, '/api/auth/verify-otp', {
        email: legacyEmail,
        otp: '123456',
      }
    );

    assert.equal(legacy.status, 400);
    assert.equal(
      legacy.body.code,
      'OTP_PURPOSE_INVALID'
    );

    console.log('PASS 9: Legacy OTP rejected');

    console.log(
      '\nHNC STEP 15R.8: PASS (9/9 TESTS)'
    );

  } catch (error) {
    console.error('\nHNC STEP 15R.8: FAIL');
    console.error(error);
    process.exitCode = 1;

  } finally {
    if (server) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
    }

    if (connected) {
      try {
        if (mongoose.connection.name !== DB_NAME) {
          throw new Error('Cleanup database mismatch');
        }

        // Restricted to the three test email addresses.
        await User.deleteMany({
          email: { $in: emails },
        });

        console.log('Sandbox fixtures cleaned up.');
      } catch (error) {
        console.error('Cleanup failed:', error);
        process.exitCode = 1;
      }

      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
