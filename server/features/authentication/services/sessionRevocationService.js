'use strict';
const User = require('../models/User');
const Vendor = require('../../vendors/models/Vendor');
const AdminUser = require('../../administration/models/AdminUser');
const { verifyToken } = require('../../../config/jwt');
const { versionFilter } = require('./authPolicy');
async function revokeSession(authorization) {
  const match = typeof authorization === 'string' ? /^Bearer ([^\s]+)$/i.exec(authorization.trim()) : null;
  let payload;
  try { if (!match) throw new Error(); payload = verifyToken(match[1]); }
  catch { throw Object.assign(new Error('Invalid or expired token'), { status: 401, code: 'INVALID_TOKEN' }); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Object.assign(new Error('Invalid or expired token'), { status: 401, code: 'INVALID_TOKEN' });
  const type = payload.type ?? 'user';
  const models = { user: User, vendor: Vendor, admin: AdminUser };
  if (typeof type !== 'string' || !Object.hasOwn(models, type) || typeof payload.id !== 'string' || !/^[a-f\d]{24}$/i.test(payload.id) || !Number.isSafeInteger(payload.tokenVersion ?? 0) || (payload.tokenVersion ?? 0) < 0) throw Object.assign(new Error('Invalid or expired token'), { status: 401, code: 'INVALID_TOKEN' });
  const version = payload.tokenVersion ?? 0;
  if (version === Number.MAX_SAFE_INTEGER) throw Object.assign(new Error('Account session version requires review'), { status: 409, code: 'SESSION_VERSION_EXHAUSTED' });
  const filter = { _id: payload.id, isActive: { $ne: false }, ...versionFilter(version), ...(type === 'admin' ? { disabledAt: null } : {}) };
  const updates = { $inc: { tokenVersion: 1 }, ...(type === 'user' ? { $set: { otpHash: null, otpExpiresAt: null, otpPurpose: null, otpAttempts: 0 } } : {}) };
  const result = await models[type].findOneAndUpdate(filter, updates, { new: true });
  if (!result) throw Object.assign(new Error('Invalid or expired token'), { status: 401, code: 'TOKEN_REVOKED' });
  return { message: 'Logged out' };
}
module.exports = { revokeSession };
