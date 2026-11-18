'use strict';
const assert = require('node:assert/strict');
const load = require('./helpers/loadIsolatedService.cjs');
const ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function fixture({ payload = { id: ID, type: 'user' }, user = { _id: ID }, vendor = { _id: ID, isActive: true, tokenVersion: 2 }, admin = { _id: ID, isActive: true, tokenVersion: 3 }, expired = false } = {}) {
  const calls = { lookups: 0, next: 0, verified: 0 };
  const find = value => async () => { calls.lookups++; return value; };
  const verify = () => { calls.verified++; if (expired) throw new Error('synthetic expiry'); return payload; };
  const service = load('features/authentication/middleware/authMiddleware.js', {
    jsonwebtoken: { verify },
    mongoose: { isObjectIdOrHexString: value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value) },
    '../../../config/jwt': { verifyToken: verify },
    '../../vendors/models/Vendor': { findById: find(vendor) },
    '../../administration/models/AdminUser': { findById: find(admin) },
    '../models/User': { findById: find(user) },
  });
  const req = { headers: { authorization: 'Bearer synthetic-fixture' } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const next = () => { calls.next++; };
  return { service, req, res, next, calls };
}
const cases = [];
const test = (name, action) => cases.push({ name, action });
test('missing bearer token rejects without verification or model access', async () => {
  const f = fixture(); f.req.headers = {};
  await f.service.authUser(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 401); assert.equal(f.calls.verified, 0); assert.equal(f.calls.lookups, 0);
});
test('expired token fails before account lookup', async () => {
  const f = fixture({ expired: true });
  await f.service.authUser(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 401); assert.equal(f.calls.lookups, 0); assert.equal(f.calls.next, 0);
});
test('explicit vendor token cannot authenticate as a customer', async () => {
  const f = fixture({ payload: { id: ID, type: 'vendor' } });
  await f.service.authUser(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 401); assert.equal(f.calls.lookups, 0);
});
test('valid customer context is attached for the next handler', async () => {
  const f = fixture();
  await f.service.authUser(f.req, f.res, f.next);
  assert.equal(f.req.user._id, ID); assert.equal(f.calls.next, 1);
});
test('disabled vendor is forbidden', async () => {
  const f = fixture({ payload: { id: ID, type: 'vendor' }, vendor: { isActive: false } });
  await f.service.authVendor(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 403); assert.equal(f.res.body.code, 'VENDOR_DISABLED'); assert.equal(f.calls.next, 0);
});
test('revoked vendor token cannot pass a current account version', async () => {
  const f = fixture({ payload: { id: ID, type: 'vendor', tokenVersion: 1 } });
  await f.service.authVendor(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 401); assert.equal(f.res.body.code, 'TOKEN_REVOKED'); assert.equal(f.calls.next, 0);
});
test('vendor middleware preserves the exact authenticated version for transactional fencing', async () => {
  const f = fixture({ payload: { id: ID, type: 'vendor', tokenVersion: 2 } });
  await f.service.authVendor(f.req, f.res, f.next);
  assert.equal(f.req.vendor._id, ID); assert.equal(f.req.vendorTokenVersion, 2); assert.equal(f.calls.next, 1);
});
test('disabled administrator cannot pass authorization', async () => {
  const f = fixture({ payload: { id: ID, type: 'admin', tokenVersion: 3 }, admin: { isActive: true, disabledAt: new Date() } });
  await f.service.authAdmin(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 403); assert.equal(f.res.body.code, 'ADMIN_DISABLED'); assert.equal(f.calls.next, 0);
});
test('administrator middleware preserves the authenticated version for review fencing', async () => {
  const f = fixture({ payload: { id: ID, type: 'admin', tokenVersion: 3 } });
  await f.service.authAdmin(f.req, f.res, f.next);
  assert.equal(f.req.admin._id, ID); assert.equal(f.req.adminTokenVersion, 3); assert.equal(f.calls.next, 1);
});
(async () => {
  let passed = 0;
  for (const { name, action } of cases) {
    try { await action(); passed++; console.log('PASS: ' + name); }
    catch (error) { console.error('FAIL: ' + name + '\n' + error.stack); process.exitCode = 1; }
  }
  console.log(`RESULT: ${passed}/${cases.length} OFFLINE AUTHORIZATION CASES PASSED`);
})();
