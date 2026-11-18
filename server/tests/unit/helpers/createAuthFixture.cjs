'use strict';
const crypto = require('node:crypto');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const load = require('./loadIsolatedService.cjs');
const policy = load('features/authentication/services/authPolicy.js', {});
const secret = 'synthetic-auth-key-at-least-32-characters';
const jwtService = load('config/jwt.js', { jsonwebtoken: jwt }, { JWT_SECRET: secret });
module.exports = function createAuthFixture() {
  const rows = new Map(); const vendors = new Map(); const admins = new Map();
  const calls = { emails: [], hashes: 0, compares: 0, writes: [], signs: 0 };
  const options = { deliveryFailure: false };
  const clone = value => value == null ? value : structuredClone(value);
  const at = (row, key) => key.split('.').reduce((current, part) => current?.[part], row);
  function matches(row, filter) { return Object.entries(filter).every(([key, condition]) => {
    if (key === '$and') return condition.every(value => matches(row, value));
    if (key === '$or') return condition.some(value => matches(row, value));
    const value = at(row, key);
    if (condition && typeof condition === 'object' && !(condition instanceof Date) && typeof condition.getTime !== 'function') return Object.entries(condition).every(([operator, expected]) => {
      if (operator === '$exists') return (value !== undefined) === expected;
      if (operator === '$ne') return value !== expected;
      if (operator === '$in') return expected.includes(value);
      if (operator === '$eq') return Number(value) === Number(expected);
      if (operator === '$gt') return Number(value) > Number(expected);
      if (operator === '$lt') return Number(value) < Number(expected);
      return false;
    });
    return condition == null ? value == null : typeof condition?.getTime === 'function' ? Number(value) === Number(condition) : value === condition;
  }); }
  function change(row, update) {
    for (const [key, value] of Object.entries(update.$set || {})) row[key] = clone(value);
    for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + value;
    for (const key of Object.keys(update.$unset || {})) delete row[key];
  }
  function model(records) {
    const find = filter => [...records.values()].find(row => matches(row, filter));
    function query(filter) { const read = () => clone(find(filter) || null); return { select() { return this; }, lean: async () => read(), then(resolve, reject) { return Promise.resolve(read()).then(resolve, reject); } }; }
    return {
      findOne: query, findById: id => query({ _id: String(id) }),
      async create(data) { if ([...records.values()].some(row => row.email === data.email || row.phone === data.phone)) throw Object.assign(new Error('duplicate'), { code: 11000 }); const row = { _id: crypto.randomBytes(12).toString('hex'), tokenVersion: 0, isActive: true, ...clone(data) }; records.set(row._id, row); return clone(row); },
      async findOneAndUpdate(filter, update) { const row = find(filter); calls.writes.push({ filter, update }); if (!row) return null; change(row, update); return clone(row); },
      async updateOne(filter, update) { const row = find(filter); if (!row) return { modifiedCount: 0 }; change(row, update); return { modifiedCount: 1 }; },
      async exists(filter) { return Boolean(find(filter)); },
    };
  }
  const User = model(rows), Vendor = model(vendors), AdminUser = model(admins);
  const bcrypt = { async hash(value) { calls.hashes++; return 'synthetic-password:' + value; }, async compare(value, hash) { return hash === 'synthetic-password:' + value; } };
  const otp = { generateOtp: () => '123456', hashOtp: async value => 'synthetic-otp:' + value + ':' + crypto.randomBytes(4).toString('hex'), compareOtp: async (value, hash) => { calls.compares++; options.beforeCompare?.(); return hash.startsWith('synthetic-otp:' + value + ':'); } };
  const challenge = load('features/authentication/services/otpChallengeService.js', { '../models/User': User, './otpService': otp, './authPolicy': policy,
    '../../../infrastructure/email/emailService': { sendOtpEmail: async (email, value) => { if (options.deliveryFailure) throw new Error('synthetic provider secret'); calls.emails.push({ email, otp: value }); } } });
  const verification = load('features/authentication/services/otpVerificationService.js', { '../models/User': User, './otpService': otp, './authPolicy': policy });
  const controller = require('./loadAuthSource.cjs')('features/authentication/controllers/authController.js', { bcrypt, joi: Joi, '../models/User': User, '../../vendors/models/Vendor': Vendor, '../../administration/models/AdminUser': AdminUser,
    '../services/otpChallengeService': challenge, '../services/otpVerificationService': verification, '../../../config/jwt': { ...jwtService, signToken: value => { calls.signs++; return jwtService.signToken(value); } } });
  const revocation = load('features/authentication/services/sessionRevocationService.js', { '../models/User': User, '../../vendors/models/Vendor': Vendor, '../../administration/models/AdminUser': AdminUser, '../../../config/jwt': jwtService, './authPolicy': policy });
  const middleware = load('features/authentication/middleware/authMiddleware.js', { mongoose: { isObjectIdOrHexString: value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) }, '../../../config/jwt': jwtService, '../../vendors/models/Vendor': Vendor, '../../administration/models/AdminUser': AdminUser, '../models/User': User });
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  async function request(handler, body) { const res = response(); await controller[handler]({ body }, res); return res; }
  const registration = { name: 'Synthetic Customer', email: 'synthetic@example.com', phone: '12345678', password: 'synthetic-password' };
  const register = () => request('registerUser', registration);
  const user = () => [...rows.values()][0];
  const verify = () => request('verifyUserOtp', { email: registration.email, otp: '123456' });
  return { rows, vendors, admins, calls, options, User, Vendor, AdminUser, otp, policy, challenge, verification, controller, revocation, middleware, jwtService, jwt, secret, response, request, registration, register, verify, user };
};
