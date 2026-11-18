
'use strict';

const assert = require('node:assert/strict');
const express = require('express');

async function main() {
  // Replace controller exports before authRoutes imports them.
  // This prevents database access and email delivery.
  const controllerPath = require.resolve(
    '../features/authentication/controllers/authController'
  );

  const counters = {
    register: 0,
    verifyOtp: 0,
    vendorLogin: 0,
    adminLogin: 0,
    userLogin: 0,
  };

  const mockHandlers = {};

  for (const [name, counter] of [
    ['registerUser', 'register'],
    ['verifyUserOtp', 'verifyOtp'],
    ['loginVendor', 'vendorLogin'],
    ['loginAdmin', 'adminLogin'],
    ['loginUser', 'userLogin'],
  ]) {
    mockHandlers[name] = (req, res) => {
      counters[counter]++;
      return res.json({ success: true });
    };
  }

  require.cache[controllerPath] = {
    id: controllerPath,
    filename: controllerPath,
    loaded: true,
    exports: mockHandlers,
  };

  // Real auth router and real rate-limit middleware.
  const authRoutes = require('../features/authentication/routes/authRoutes');

  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  let server;

  try {
    server = await new Promise((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', () => {
        resolve(s);
      });
      s.once('error', reject);
    });

    const base =
      `http://127.0.0.1:${server.address().port}`;

    async function post(path) {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(10000),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }

    // OTP limiter shared across two endpoints.
    for (let i = 0; i < 3; i++) {
      assert.equal(
        (await post('/api/auth/register')).status,
        200
      );
    }

    for (let i = 0; i < 2; i++) {
      assert.equal(
        (await post('/api/auth/verify-otp')).status,
        200
      );
    }

    const blockedOtp = await post(
      '/api/auth/verify-otp'
    );

    assert.equal(blockedOtp.status, 429);
    assert.equal(
      blockedOtp.body.code,
      'OTP_RATE_LIMIT'
    );

    console.log(
      'PASS 1: Real OTP limiter shared across routes'
    );

    // Login limiter shared across all three login routes.
    for (let i = 0; i < 4; i++) {
      assert.equal(
        (await post('/api/auth/user/login')).status,
        200
      );
    }

    for (let i = 0; i < 3; i++) {
      assert.equal(
        (await post('/api/auth/vendor/login')).status,
        200
      );
    }

    for (let i = 0; i < 3; i++) {
      assert.equal(
        (await post('/api/auth/admin/login')).status,
        200
      );
    }

    const blockedLogin = await post(
      '/api/auth/user/login'
    );

    assert.equal(blockedLogin.status, 429);
    assert.equal(
      blockedLogin.body.code,
      'LOGIN_RATE_LIMIT'
    );

    console.log(
      'PASS 2: Real login limiter shared across routes'
    );

    assert.equal(counters.register, 3);
    assert.equal(counters.verifyOtp, 2);
    assert.equal(counters.userLogin, 4);
    assert.equal(counters.vendorLogin, 3);
    assert.equal(counters.adminLogin, 3);

    console.log(
      'PASS 3: Blocked requests did not reach controllers'
    );

    console.log(
      '\nHNC STEP 15R.9B: PASS (3/3 TESTS)'
    );

  } finally {
    if (server) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
    }
  }
}

main().catch(error => {
  console.error('HNC STEP 15R.9B: FAIL');
  console.error(error);
  process.exitCode = 1;
});
