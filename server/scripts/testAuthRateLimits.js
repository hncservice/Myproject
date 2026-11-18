
'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const { rateLimit } = require('express-rate-limit');

async function main() {
  const app = express();

  // This local test has no reverse proxy.
  app.set('trust proxy', false);

  // Fresh instances using the same configuration
  // as the production middleware.
  const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message:
        'Too many OTP requests from this IP, please try again after 10 minutes.',
      code: 'OTP_RATE_LIMIT',
    },
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message:
        'Too many login attempts from this IP, please try again later.',
      code: 'LOGIN_RATE_LIMIT',
    },
  });

  app.post('/otp', otpLimiter, (req, res) => {
    res.json({ success: true });
  });

  app.post('/login', loginLimiter, (req, res) => {
    res.json({ success: true });
  });

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => {
      resolve(s);
    });

    s.once('error', reject);
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  async function post(path) {
    const response = await fetch(base + path, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    });

    return {
      status: response.status,
      body: await response.json(),
      limit: response.headers.get('ratelimit-limit'),
    };
  }

  try {
    for (let i = 0; i < 5; i++) {
      const result = await post('/otp');
      assert.equal(result.status, 200);
    }

    console.log('PASS 1: First 5 OTP requests accepted');

    const blockedOtp = await post('/otp');

    assert.equal(blockedOtp.status, 429);
    assert.equal(
      blockedOtp.body.code,
      'OTP_RATE_LIMIT'
    );

    console.log('PASS 2: Sixth OTP request blocked');

    for (let i = 0; i < 10; i++) {
      const result = await post('/login');
      assert.equal(result.status, 200);
    }

    console.log('PASS 3: First 10 login requests accepted');

    const blockedLogin = await post('/login');

    assert.equal(blockedLogin.status, 429);
    assert.equal(
      blockedLogin.body.code,
      'LOGIN_RATE_LIMIT'
    );

    console.log('PASS 4: Eleventh login request blocked');

    console.log(
      '\nHNC STEP 15R.9A: PASS (4/4 TESTS)'
    );
  } finally {
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections?.();
    });
  }
}

main().catch(error => {
  console.error('HNC STEP 15R.9A: FAIL');
  console.error(error);
  process.exitCode = 1;
});
