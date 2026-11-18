'use strict';
const crypto = require('node:crypto');
const { immutableData, record, fail } = require('../registry/gameRegistryFactory');

// All ports are trusted server adapters. There is no default DB, network or storage.
function createGameEngine({ registry, store, eligibility, decisions, secret, clock = Date.now } = {}) {
  if (!registry || !store || ['start', 'load', 'commit', 'expire', 'history', 'recordDecisionResult'].some(name => typeof store[name] !== 'function') ||
      typeof eligibility !== 'function' || typeof decisions !== 'function' || typeof clock !== 'function' || typeof secret !== 'string' || secret.length < 32) {
    throw fail('INVALID_ENGINE', 'Explicit lifecycle ports and signing key required');
  }
  const id = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
  function time() { const now = clock(); if (!Number.isSafeInteger(now) || now < 0) throw fail('INVALID_CLOCK', 'Invalid server clock'); return now; }
  function context(actor, gameId) {
    record(actor, ['userId', 'campaignId'], 'INVALID_ACTOR');
    if (!id(actor.userId) || typeof actor.campaignId !== 'string' || !actor.campaignId.trim() || actor.campaignId.length > 100) throw fail('INVALID_ACTOR', 'Trusted authenticated actor required');
    const game = registry.require(gameId);
    if (game.execution !== 'verified-evidence') throw fail('LEGACY_ADAPTER_REQUIRED', 'Use the existing gameplay adapter');
    return { game, scope: immutableData({ userId: actor.userId.toLowerCase(), campaignId: actor.campaignId, gameId }) };
  }
  const token = session => crypto.createHmac('sha256', secret).update(JSON.stringify([session.id, session.userId, session.campaignId, session.gameId, session.configVersion])).digest('hex');
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  function own(session, scope, sessionId) {
    if (!session || session.id !== sessionId || Object.keys(scope).some(key => session[key] !== scope[key])) throw fail('SESSION_NOT_FOUND', 'Session not found');
  }
  function credential(session, provided) {
    const expected = token(session);
    if (typeof provided !== 'string' || !/^[a-f\d]{64}$/i.test(provided) || !crypto.timingSafeEqual(Buffer.from(provided.toLowerCase(), 'hex'), Buffer.from(expected, 'hex')) || session.sessionTokenHash !== digest(expected)) throw fail('INVALID_SESSION_TOKEN', 'Invalid session credential');
  }
  function view(game, session) {
    return immutableData({ sessionId: session.id, gameId: session.gameId, configVersion: session.configVersion, status: session.status,
      outcome: session.outcome, score: session.score, revision: session.revision, expiresAt: session.expiresAt,
      progress: game.handlers.present({ state: session.state, config: game.config, now: time() }) });
  }
  async function load(scope, request, game) {
    if (!id(request.sessionId)) throw fail('INVALID_SESSION', 'Invalid session identifier');
    const session = immutableData(await store.load(scope, request.sessionId));
    own(session, scope, request.sessionId);
    credential(session, request.sessionToken);
    if (session.configVersion !== game.version) throw fail('CONFIG_VERSION_CONFLICT', 'Session requires its original validator version');
    return session;
  }
  async function active(scope, session) {
    if (session.status !== 'active') throw fail('SESSION_NOT_ACTIVE', 'Session is not active');
    if (!Number.isSafeInteger(session.expiresAt) || session.expiresAt <= time()) {
      await store.expire(scope, session.id, time());
      throw fail('SESSION_EXPIRED', 'Session expired');
    }
  }
  function assessment(game, session) {
    const integrity = immutableData(game.handlers.assessIntegrity(session));
    const behavior = immutableData(game.handlers.assessBehavior(session));
    record(integrity, ['assessmentVersion', 'reviewRequired', 'riskReasons'], 'INVALID_ASSESSMENT');
    record(behavior, ['behaviorVersion', 'reviewSuggested', 'signals', 'enforcementAllowed'], 'INVALID_ASSESSMENT');
    const reasons = values => Array.isArray(values) && values.length <= 20 && values.every(value => typeof value === 'string' && value.length <= 200);
    if (integrity.assessmentVersion !== 2 || typeof integrity.reviewRequired !== 'boolean' || !reasons(integrity.riskReasons) ||
        behavior.behaviorVersion !== 1 || typeof behavior.reviewSuggested !== 'boolean' || !reasons(behavior.signals) || behavior.enforcementAllowed !== false) throw fail('INVALID_ASSESSMENT', 'Separate advisory assessment contracts required');
    return immutableData({ integrity, behavior, preliminaryReviewRequired: integrity.reviewRequired, behaviorAffectsPrizeDecision: false });
  }
  async function start(actor, gameId) {
    const { game, scope } = context(actor, gameId);
    if ((await eligibility(scope, game.config))?.allowed !== true) throw fail('NOT_ELIGIBLE', 'Not eligible to start');
    const now = time();
    const initial = { ...scope, id: crypto.randomBytes(12).toString('hex'), configVersion: game.version, revision: 0, status: 'active',
      score: 0, outcome: null, startedAt: now, expiresAt: now + game.config.sessionTtlMs, events: [], lastCommand: null,
      state: immutableData(game.handlers.initialize({ config: game.config, now })), assessments: null, decisionPending: false };
    initial.sessionTokenHash = digest(token(initial));
    // Port must atomically resume/create, expire prior attempts and enforce maxAttempts.
    const result = await store.start(scope, immutableData(initial), { now, maxAttempts: game.config.maxAttempts });
    const session = immutableData(result.session);
    own(session, scope, session.id);
    if (!id(session.id) || session.configVersion !== game.version) throw fail('INVALID_SESSION', 'Invalid stored session');
    credential(session, token(session));
    await active(scope, session);
    return immutableData({ ...view(game, session), sessionToken: token(session), resumed: result.created !== true });
  }
  function canonical(value) {
    if (!value || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  async function submit(actor, gameId, input) {
    const { game, scope } = context(actor, gameId);
    record(input, ['sessionId', 'sessionToken', 'commandId', 'revision', 'action', 'evidence'], 'INVALID_SUBMISSION');
    const request = immutableData(input, { maxBytes: game.limits.maxEvidenceBytes + 1024 });
    if (typeof request.commandId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(request.commandId) || !Number.isSafeInteger(request.revision) || request.revision < 0 || !game.actions.includes(request.action)) throw fail('INVALID_SUBMISSION', 'Invalid command, revision or action');
    const evidence = immutableData(request.evidence, { maxBytes: game.limits.maxEvidenceBytes });
    record(evidence, Object.keys(evidence), 'INVALID_EVIDENCE');
    if (['score', 'outcome', 'qualified', 'winner', 'prizeAllocated', 'enablePrizeAllocation'].some(key => Object.hasOwn(evidence, key))) throw fail('UNTRUSTED_RESULT', 'Client results are not authoritative');
    const commandDigest = digest(canonical({ action: request.action, evidence, revision: request.revision }));
    let session = await load(scope, request, game);
    function repeated(current) {
      if (current.lastCommand?.id !== request.commandId) {
        if (current.events.some(event => event.commandId === request.commandId)) throw fail('REPLAY_CONFLICT', 'Previously processed command cannot be reused');
        return null;
      }
      if (current.lastCommand.digest !== commandDigest) throw fail('REPLAY_CONFLICT', 'Command identifier was reused with different evidence');
      return immutableData({ ...current.lastCommand.result, idempotent: true });
    }
    const previous = repeated(session);
    if (previous) return previous;
    await active(scope, session);
    if (session.revision !== request.revision) throw fail('REVISION_CONFLICT', 'Session changed');
    if (session.events.length >= game.limits.maxEvents) throw fail('EVENT_LIMIT', 'Session evidence limit reached');
    if ((await eligibility(scope, game.config))?.allowed !== true) throw fail('NOT_ELIGIBLE', 'Not eligible to submit');
    await active(scope, session);
    const now = time();
    const validated = immutableData(game.handlers.validateEvidence({ action: request.action, evidence, config: game.config }));
    const transition = game.handlers.apply({ state: session.state, action: request.action, evidence: validated, now, config: game.config });
    record(transition, ['state', 'completed'], 'INVALID_TRANSITION');
    if (typeof transition.completed !== 'boolean') throw fail('INVALID_TRANSITION', 'Completion flag required');
    const next = { ...session, state: immutableData(transition.state), revision: session.revision + 1,
      events: [...session.events, { commandId: request.commandId, action: request.action, evidence: validated, serverAt: now }], lastCommand: null };
    if (transition.completed) {
      const result = immutableData(game.handlers.verify({ state: next.state, config: game.config, now }));
      record(result, ['score', 'qualified'], 'INVALID_VERIFICATION');
      if (!Number.isSafeInteger(result.score) || result.score < 0 || typeof result.qualified !== 'boolean') throw fail('INVALID_VERIFICATION', 'Server score and qualification required');
      Object.assign(next, { status: 'completed', completedAt: now, score: result.score, outcome: result.qualified ? 'qualified' : 'not-qualified' });
      next.assessments = assessment(game, immutableData(next));
      next.decisionPending = result.qualified && game.capabilities.preliminaryDecisions;
    }
    const result = immutableData({ ...view(game, next), idempotent: false });
    next.lastCommand = { id: request.commandId, digest: commandDigest, result };
    const frozen = immutableData(next);
    // Atomic CAS must persist state, receipt, audit event and decision outbox together.
    const committed = await store.commit(scope, session.id, { revision: session.revision, status: 'active', now: time() }, frozen);
    if (!committed) {
      session = await load(scope, request, game);
      const duplicate = repeated(session);
      if (duplicate) return duplicate;
      throw fail('REVISION_CONFLICT', 'Concurrent submission or expiry');
    }
    if (next.decisionPending) {
      let completion;
      try { await decisions(frozen); completion = { succeeded: true, code: null }; }
      catch (error) { completion = { succeeded: false, code: typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'DECISION_FAILED' }; }
      // Failed bookkeeping leaves the already committed outbox pending for recovery.
      try { await store.recordDecisionResult(scope, session.id, frozen.revision, completion); } catch { /* durable pending outbox remains */ }
    }
    return result;
  }
  async function status(actor, gameId, request) {
    const { game, scope } = context(actor, gameId);
    record(request, ['sessionId', 'sessionToken'], 'INVALID_SUBMISSION');
    const session = await load(scope, request, game);
    if (session.status === 'active') await active(scope, session);
    return view(game, session);
  }
  async function history(actor, gameId, { limit = 20 } = {}) {
    const { game, scope } = context(actor, gameId);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw fail('INVALID_LIMIT', 'History limit must be 1 to 50');
    const sessions = await store.history(scope, limit);
    if (!Array.isArray(sessions) || sessions.length > limit) throw fail('INVALID_HISTORY', 'Invalid history adapter result');
    return Object.freeze(sessions.map(item => { const session = immutableData(item); own(session, scope, session.id); if (session.configVersion !== game.version) throw fail('CONFIG_VERSION_CONFLICT', 'Historical validator version required'); return view(game, session); }));
  }
  async function report(actor, gameId, request) {
    const { game, scope } = context(actor, gameId);
    record(request, ['sessionId', 'sessionToken'], 'INVALID_SUBMISSION');
    const session = await load(scope, request, game);
    return immutableData({ ...view(game, session), assessments: session.assessments, decisionPending: session.decisionPending,
      audit: { eventCount: session.events.length, lastCommandId: session.lastCommand?.id || null }, readOnly: true });
  }
  return Object.freeze({ discover: () => registry.discover(), start, submit, complete: submit, status, history, report });
}
module.exports = { createGameEngine };
