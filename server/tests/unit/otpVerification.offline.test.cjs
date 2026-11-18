'use strict';
const assert = require('node:assert/strict');
const load = require('./helpers/loadIsolatedService.cjs');
const EMAIL = 'synthetic@example.invalid';
function fixture({ overrides = {}, matches = true, consumed = true } = {}) {
  const user = {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Synthetic', email: EMAIL,
    emailVerified: true, otpHash: 'synthetic-opaque-hash',
    otpExpiresAt: new Date(Date.now() + 60000), otpPurpose: 'login', ...overrides,
  };
  const calls = { reads: 0, compares: 0, updates: [] };
  const service = load('features/authentication/services/otpVerificationService.js', {
    './authPolicy': load('features/authentication/services/authPolicy.js', {}),
    '../models/User': {
      findOne(query) { calls.reads++; calls.query = query; return { select: async () => user }; },
      async updateOne() { return { modifiedCount: 1 }; },
      async findOneAndUpdate(filter, updates, options) {
        calls.updates.push({ filter, updates, options });
        return consumed ? { _id: user._id, email: EMAIL, emailVerified: true } : null;
      },
    },
    './otpService': { async compareOtp() { calls.compares++; return matches; } },
  });
  return { service, calls, user };
}
const cases = [];
const test = (name, action) => cases.push({ name, action });
test('malformed OTP rejects before any model read', async () => {
  const f = fixture();
  await assert.rejects(f.service.consumeUserOtp({ email: EMAIL, otp: 'invalid' }), e => e.code === 'INVALID_OTP');
  assert.equal(f.calls.reads, 0);
});
test('expired challenge rejects before comparison or conditional update', async () => {
  const f = fixture({ overrides: { otpExpiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(f.service.consumeUserOtp({ email: EMAIL, otp: '123456' }), e => e.code === 'OTP_EXPIRED');
  assert.equal(f.calls.compares, 0); assert.equal(f.calls.updates.length, 0);
});
test('incorrect OTP cannot consume a challenge', async () => {
  const f = fixture({ matches: false });
  await assert.rejects(f.service.consumeUserOtp({ email: EMAIL, otp: '123456' }), e => e.code === 'INVALID_OTP');
  assert.equal(f.calls.updates.length, 0);
});
test('legacy or unknown OTP purpose rejects', async () => {
  const f = fixture({ overrides: { otpPurpose: null } });
  await assert.rejects(f.service.consumeUserOtp({ email: EMAIL, otp: '123456' }), e => e.code === 'OTP_PURPOSE_INVALID');
  assert.equal(f.calls.compares, 0);
});
test('login consumption conditions on the original hash purpose expiry and verified status', async () => {
  const f = fixture();
  const result = await f.service.consumeUserOtp({ email: '  SYNTHETIC@EXAMPLE.INVALID ', otp: '123456' });
  assert.equal(result.emailVerified, true);
  assert.equal(f.calls.query.email, EMAIL);
  const { filter, updates } = f.calls.updates[0];
  assert.equal(filter.otpHash, f.user.otpHash);
  assert.equal(filter.otpPurpose, 'login');
  assert.equal(filter.emailVerified, true);
  assert.equal(filter.otpExpiresAt.$eq, f.user.otpExpiresAt);
  assert.ok(Number.isFinite(filter.otpExpiresAt.$gt.getTime()));
  assert.equal(updates.$set.otpHash, null);
  assert.equal(updates.$set.otpPurpose, null);
  assert.equal(Object.hasOwn(updates.$set, 'passwordHash'), false);
});
test('registration commits only verified pending account details in the conditional update', async () => {
  const f = fixture({ overrides: {
    emailVerified: false, otpPurpose: 'registration',
    pendingRegistration: { name: 'New synthetic name', phone: '00000000', passwordHash: 'synthetic-new-hash' },
  } });
  await f.service.consumeUserOtp({ email: EMAIL, otp: '123456' });
  const { filter, updates, options } = f.calls.updates[0];
  assert.equal(filter.emailVerified, false);
  assert.equal(updates.$set.passwordHash, 'synthetic-new-hash');
  assert.equal(updates.$set.name, 'New synthetic name');
  assert.equal(updates.$unset.pendingRegistration, 1);
  assert.equal(options.runValidators, true);
});
test('a replaced or concurrently consumed challenge returns conflict rather than authenticating', async () => {
  const f = fixture({ consumed: false });
  await assert.rejects(f.service.consumeUserOtp({ email: EMAIL, otp: '123456' }), e => e.code === 'OTP_ALREADY_CONSUMED');
  assert.equal(f.calls.updates.length, 1);
});
test('an unverified account cannot consume a login challenge', async () => {
  const f = fixture({ overrides: { emailVerified: false } });
  await assert.rejects(f.service.consumeUserOtp({ email: EMAIL, otp: '123456' }), e => e.code === 'ACCOUNT_NOT_VERIFIED');
  assert.equal(f.calls.updates.length, 0);
});
(async () => {
  let passed = 0;
  for (const { name, action } of cases) {
    try { await action(); passed++; console.log('PASS: ' + name); }
    catch (error) { console.error('FAIL: ' + name + '\n' + error.stack); process.exitCode = 1; }
  }
  console.log(`RESULT: ${passed}/${cases.length} OFFLINE OTP CASES PASSED`);
})();
