'use strict';
const assert = require('node:assert/strict');
const load = require('./helpers/loadIsolatedService.cjs');
let passed = 0;
for (const environment of [{}, {
  EMAIL_HOST: 'smtp.synthetic.invalid', EMAIL_PORT: '465',
  EMAIL_USER: 'synthetic@example.invalid', EMAIL_PASS: 'synthetic-only', NODE_ENV: 'production',
}]) {
  const calls = { create: 0, verify: 0, send: 0 };
  const transporter = {
    verify() { calls.verify++; },
    sendMail() { calls.send++; },
  };
  const result = load('config/mailer.js', {
    nodemailer: { createTransport(options) { calls.create++; calls.options = options; return transporter; } },
  }, environment);
  assert.equal(result, transporter);
  assert.equal(calls.create, 1);
  assert.equal(calls.verify, 0, 'Import must not start an SMTP verification connection');
  assert.equal(calls.send, 0, 'Import must not deliver mail');
  assert.equal(calls.options.port, environment.EMAIL_PORT ? 465 : 587);
  assert.equal(calls.options.secure, Boolean(environment.EMAIL_PORT));
  assert.equal(calls.options.tls.rejectUnauthorized, environment.NODE_ENV === 'production');
  passed++;
  console.log('PASS: side-effect-free mailer import with ' + (environment.EMAIL_HOST ? 'synthetic configured' : 'absent') + ' credentials');
}
console.log(`RESULT: ${passed}/2 OFFLINE MAILER INITIALIZATION CASES PASSED`);
