'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const GameSession = require('../models/GameSession');
const { CAMPAIGN_POLICY } = require('../../../config/gameConfig');
const { checkCustomerEligibility } = require('./gameStartService');
const { processQualifiedCompletion } = require('./gameCompletionDecisionService');
const rules = require('../burger-run/burgerRunRules');

const fail = (status, code, message) => Object.assign(new Error(message), { status, statusCode: status, code });
const identity = session => ({ _id: session._id, userId: session.userId, campaignId: session.campaignId, gameId: 'burger-run' });
function credentials(session) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${session._id}:${session.userId}:${session.campaignId}:burger-run`).digest('hex');
}
function strictBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !fields.includes(k))) throw fail(400, 'INVALID_GAME_REQUEST', 'Invalid game request');
}
async function ownedSession(userId, body) {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(body.sessionId)) throw fail(400, 'INVALID_SESSION', 'Invalid game session');
  const session = await GameSession.findOne({ _id: body.sessionId, userId, campaignId: CAMPAIGN_POLICY.campaignId, gameId: 'burger-run' }).select('+sessionTokenHash');
  if (!session) throw fail(404, 'SESSION_NOT_FOUND', 'Game session not found');
  const expected = credentials(session);
  const supplied = body.sessionToken;
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/i.test(supplied) ||
      !crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex')) ||
      session.sessionTokenHash !== crypto.createHash('sha256').update(expected).digest('hex')) {
    throw fail(403, 'INVALID_SESSION_TOKEN', 'Invalid session credential');
  }
  return session;
}
async function requireActive(session) {
  if (session.status !== 'active') throw fail(409, 'SESSION_NOT_ACTIVE', 'This attempt has ended');
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await GameSession.updateOne({ ...identity(session), status: 'active' }, { $set: { status: 'expired', outcome: 'not-qualified' } });
    throw fail(409, 'SESSION_EXPIRED', 'This attempt has expired');
  }
  await checkCustomerEligibility(session.userId, session.campaignId);
}
function publicView(session, resumed = false) {
  const state = session.gameState;
  return { sessionId: String(session._id), gameId: 'burger-run', status: session.status, outcome: session.outcome,
    score: session.score, seed: state?.seed, version: rules.VERSION, playStartedAt: state?.playStartedAt,
    expiresAt: session.expiresAt, resumed, result: state?.result || null };
}
async function prepare(userId, body = {}) {
  strictBody(body, ['sessionId', 'sessionToken']);
  const session = await ownedSession(userId, body);
  if (session.status === 'completed') return publicView(session, true);
  await requireActive(session);
  if (session.gameState) {
    if (session.gameState.version !== rules.VERSION || session.gameState.kind !== 'burger-run') throw fail(409, 'GAME_VERSION_CONFLICT', 'Original game version required');
    return publicView(session, true);
  }
  const state = { kind: 'burger-run', version: rules.VERSION, seed: crypto.randomBytes(4).readUInt32LE(0), playStartedAt: new Date(), phase: 'playing' };
  const initialized = await GameSession.findOneAndUpdate({ ...identity(session), status: 'active', gameState: null, expiresAt: { $gt: new Date() } }, { $set: { gameState: state } }, { new: true });
  if (initialized) return publicView(initialized);
  const current = await GameSession.findOne(identity(session)).select('+sessionTokenHash');
  if (current?.status === 'active' && current.gameState?.kind === 'burger-run') return publicView(current, true);
  throw fail(409, 'GAME_STATE_CHANGED', 'Refresh the game and retry');
}
async function finish(userId, body = {}) {
  strictBody(body, ['sessionId', 'sessionToken', 'ticks', 'inputs']);
  const session = await ownedSession(userId, body);
  if (session.status === 'completed') return publicView(session, true);
  await requireActive(session);
  const state = session.gameState;
  if (state?.kind !== 'burger-run' || state.version !== rules.VERSION || state.phase !== 'playing') throw fail(409, 'GAME_NOT_READY', 'Prepare the game before playing');
  let result;
  try { result = rules.replay(state.seed, body.ticks, body.inputs); }
  catch { throw fail(400, 'INVALID_REPLAY', 'Gameplay evidence is invalid'); }
  const completedAt = new Date();
  const elapsed = completedAt.getTime() - new Date(state.playStartedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed + 150 < body.ticks * 1000 / rules.RULES.hz) throw fail(409, 'GAME_TOO_FAST', 'Gameplay is still in progress');
  if (result.phase === 'playing') throw fail(409, 'GAME_NOT_FINISHED', 'Reach the finish or complete this run first');
  const serverResult = rules.summary(result);
  const record = { ...state, phase: 'finished', ticks: body.ticks, inputs: body.inputs, result: serverResult };
  const completed = await GameSession.findOneAndUpdate({ ...identity(session), status: 'active', 'gameState.phase': 'playing', expiresAt: { $gt: completedAt } }, {
    $set: { gameState: record, status: 'completed', outcome: result.phase === 'won' ? 'qualified' : 'not-qualified', score: result.score, completedAt,
      events: [{ type: 'burger-run-finish', serverAt: completedAt, ticks: result.tick, food: result.collected.length, score: result.score }] },
  }, { new: true });
  if (!completed) {
    const current = await GameSession.findOne(identity(session)).select('+sessionTokenHash');
    if (current?.status === 'completed') return publicView(current, true);
    throw fail(409, 'GAME_STATE_CHANGED', 'Run was updated. Refresh its status before retrying');
  }
  const decision = await processQualifiedCompletion(completed);
  return { ...publicView(completed), decision };
}
module.exports = { prepare, finish };
