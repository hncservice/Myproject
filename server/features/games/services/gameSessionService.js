'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const GameSession = require('../models/GameSession');
const { CAMPAIGN_POLICY, getGameConfig } = require('../../../config/gameConfig');

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
function gameConfig(gameId) {
  const config = getGameConfig(gameId);
  if (!config) throw fail(404, 'UNKNOWN_GAME', 'Unknown game');
  return config;
}
function scope(userId, gameId) {
  gameConfig(gameId);
  return {
    userId: new mongoose.Types.ObjectId(String(userId)),
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId,
  };
}
function sessionToken(session) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${session._id}:${session.userId}:${session.campaignId}:${session.gameId}`)
    .digest('hex');
}
function secureTokenEquals(provided, expected) {
  if (typeof provided !== 'string' || !/^[a-f0-9]{64}$/i.test(provided)) return false;
  const a = Buffer.from(provided.toLowerCase(), 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function publicSession(session, includeToken = false) {
  return {
    sessionId: String(session._id),
    gameId: session.gameId,
    campaignId: session.campaignId,
    attemptNumber: session.attemptNumber,
    status: session.status,
    outcome: session.outcome,
    score: session.score,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    completedAt: session.completedAt,
    ...(includeToken ? { sessionToken: sessionToken(session) } : {}),
  };
}
async function expireOverdue(filter) {
  const now = new Date();
  await GameSession.updateMany(
    { ...filter, status: 'active', expiresAt: { $lte: now } },
    { $set: { status: 'expired', outcome: 'not-qualified' } }
  );
}

async function getCurrentSession(userId, gameId) {
  const filter = scope(userId, gameId);
  await expireOverdue(filter);
  const current = await GameSession.findOne({ ...filter, status: 'active' });
  return {
    activeSession: current ? publicSession(current, true) : null,
    // A starting/expired attempt is already consumed; the status endpoint
    // remains the source of truth for remaining attempts.
  };
}

async function getHistory(userId, gameId, { limit = 20 } = {}) {
  const filter = scope(userId, gameId);
  await expireOverdue(filter);
  const parsedLimit = Number(limit);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(50, Math.trunc(parsedLimit))) : 20;
  const sessions = await GameSession.find(filter)
    .sort({ attemptNumber: -1 })
    .limit(safeLimit)
    .lean();
  return { gameId, campaignId: filter.campaignId, items: sessions.map((s) => publicSession(s)) };
}

/**
 * Step 2B deliberately implements an ABANDON / FINISH-WITHOUT-QUALIFICATION endpoint.
 * It accepts only the session credential, never a score, hit count or win flag.
 * Qualification must later be computed from validated server-owned game actions.
 */
async function completeSession(userId, gameId, { sessionId, sessionToken: providedSessionToken } = {}) {
  const filter = scope(userId, gameId);
  if (!mongoose.isValidObjectId(sessionId)) throw fail(400, 'INVALID_SESSION', 'Invalid sessionId');
  const identity = { ...filter, _id: new mongoose.Types.ObjectId(String(sessionId)) };
  const session = await GameSession.findOne(identity).select('+sessionTokenHash');
  if (!session) throw fail(404, 'SESSION_NOT_FOUND', 'Game session not found');
  const expected = sessionToken(session);
  // Validate both the cryptographic derivation and the token originally saved.
  const digest = crypto.createHash('sha256').update(expected).digest('hex');
  if (!secureTokenEquals(providedSessionToken, expected) || session.sessionTokenHash !== digest) {
    throw fail(403, 'INVALID_SESSION_TOKEN', 'Invalid session credential');
  }
  if (session.status === 'completed') return { ...publicSession(session), idempotent: true };
  if (session.status !== 'active') {
    throw fail(409, 'SESSION_NOT_ACTIVE', `Session is ${session.status}`);
  }
  if (session.expiresAt <= new Date()) {
    await expireOverdue(identity);
    throw fail(409, 'SESSION_EXPIRED', 'Game session has expired');
  }
  const completed = await GameSession.findOneAndUpdate(
    { ...identity, status: 'active', expiresAt: { $gt: new Date() } },
    { $set: { status: 'completed', outcome: 'not-qualified', score: 0, completedAt: new Date() } },
    { new: true }
  );
  if (!completed) {
    // The first request may already have committed, or the session expired.
    const updated = await GameSession.findOne(identity);
    if (updated?.status === 'completed') return { ...publicSession(updated), idempotent: true };
    await expireOverdue(identity);
    throw fail(409, 'SESSION_NOT_ACTIVE', 'Session no longer active');
  }
  return { ...publicSession(completed), idempotent: false };
}

module.exports = { getCurrentSession, getHistory, completeSession };
