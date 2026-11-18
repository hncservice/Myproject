
'use strict';

const mongoose = require('mongoose');

const GameSession = require('../../games/models/GameSession');

const {
  CAMPAIGN_POLICY,
  GAMES,
} = require('../../../config/gameConfig');

const {
  assessGameplayCombined,
} = require('./combinedGameplayAssessmentService');

// =====================================================
// CONFIGURATION
// =====================================================

const SANDBOX_DB = 'hnc_step15q_sandbox';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// =====================================================
// SECURITY
// =====================================================

function fail(code, message) {
  return Object.assign(new Error(message), { code });
}

function validateEnvironment() {
  if (
    process.env.HNC_FRAUD_REPORT_SANDBOX_ENABLED !== 'true' ||
    process.env.NODE_ENV !== 'test' ||
    process.env.ALLOCATION_ENABLED !== 'false' ||
    mongoose.connection.readyState !== 1 ||
    mongoose.connection.name !== SANDBOX_DB
  ) {
    throw fail(
      'UNSAFE_REPORT_ENVIRONMENT',
      'Fraud reporting is sandbox-only'
    );
  }
}

async function verifySandboxPermissions() {
  const info = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    info.authInfo?.authenticatedUserRoles || [];

  const privileges =
    info.authInfo?.authenticatedUserPrivileges || [];

  if (
    roles.length !== 1 ||
    roles[0].role !== 'readWrite' ||
    roles[0].db !== SANDBOX_DB ||
    privileges.length === 0
  ) {
    throw fail(
      'UNSAFE_DATABASE_PERMISSIONS',
      'Restricted sandbox role required'
    );
  }

  for (const privilege of privileges) {
    if (
      privilege.resource?.db !== SANDBOX_DB ||
      typeof privilege.resource?.collection !== 'string' ||
      privilege.resource?.anyResource === true ||
      privilege.resource?.cluster === true
    ) {
      throw fail(
        'UNSAFE_DATABASE_PERMISSIONS',
        'Unexpected database privilege'
      );
    }
  }
}

function validateInput({ sessionIds, limit }) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    throw fail(
      'INVALID_REPORT_LIMIT',
      'Report limit must be between 1 and 25'
    );
  }

  if (
    !Array.isArray(sessionIds) ||
    sessionIds.length < 1 ||
    sessionIds.length > MAX_LIMIT ||
    !sessionIds.every(
      value => mongoose.isObjectIdOrHexString(value)
    )
  ) {
    throw fail(
      'INVALID_SESSION_FILTER',
      'Explicit valid session IDs are required'
    );
  }

  const ids = sessionIds.map(
    value => String(value).toLowerCase()
  );

  if (new Set(ids).size !== ids.length) {
    throw fail(
      'DUPLICATE_SESSION_IDS',
      'Duplicate session IDs are not permitted'
    );
  }

  if (ids.length > limit) {
  throw fail(
    'SESSION_LIMIT_EXCEEDED',
    'Session ID count exceeds report limit'
  );
}

return {
  ids,
  requested: ids.length,
};
}

// =====================================================
// REPORT
// =====================================================

async function generateGameplayFraudReport({
  sessionIds,
  limit = DEFAULT_LIMIT,
} = {}) {
  validateEnvironment();

  const { ids, requested } = validateInput({
    sessionIds,
    limit,
  });

  await verifySandboxPermissions();

  const objectIds = ids.map(
    value => new mongoose.Types.ObjectId(value)
  );

  // Read only the current campaign's requested
  // sessions. Never scan the complete customer base.
  const sessions = await GameSession.find({
    _id: { $in: objectIds },
    campaignId: CAMPAIGN_POLICY.campaignId,
    gameId: { $in: Object.keys(GAMES) },
  })
    .select(
      '_id campaignId gameId status outcome ' +
      'score startedAt completedAt expiresAt ' +
      'gameState events'
    )
    .lean();

  const byId = new Map(
    sessions.map(session => [
      String(session._id),
      session,
    ])
  );

  const reports = [];
  const notFound = [];

  // Preserve the explicit request order.
  for (const id of ids) {
    const session = byId.get(id);

    if (!session) {
      notFound.push(id);
      continue;
    }

    // Both assessments must remain independent.
    const assessment = assessGameplayCombined(session);

    reports.push({
      sessionId: String(session._id),
      campaignId: session.campaignId,
      gameId: session.gameId,

      status: session.status,
      outcome: session.outcome,

      score: session.score,

      startedAt: session.startedAt,
      completedAt: session.completedAt,

      integrity: assessment.integrity,

      behavior: assessment.behavior,

      preliminaryReviewRequired:
        assessment.preliminaryReviewRequired,

      behaviorAffectsPrizeDecision: false,

      // Observational only. This field must not
      // be used as an allocation authorization.
      advisoryReviewSuggested:
        assessment.behavior.reviewSuggested,

      readOnly: true,
    });
  }

  return {
    campaignId: CAMPAIGN_POLICY.campaignId,

    requested,
    evaluated: ids.length,
    found: reports.length,
    missing: notFound.length,

    reports,
    notFound,

    reportType: 'observational',
    databaseModified: false,
    prizeAllocated: false,
    decisionModified: false,
  };
}

module.exports = {
  generateGameplayFraudReport,
};
