
'use strict';

const mongoose = require('mongoose');
const AdminUser = require('../../administration/models/AdminUser');
const {
  generateGameplayFraudReport,
} = require('../services/gameplayFraudReportService');

const SANDBOX_DB = 'hnc_step15q_sandbox';

const ALLOWED_ROLES = new Set([
  'admin',
  'superadmin',
]);

function sendError(res, status, code, message) {
  return res.status(status).json({
    code,
    message,
  });
}

function sandboxAllowed() {
  return (
    process.env.HNC_FRAUD_REPORT_SANDBOX_ENABLED === 'true' &&
    process.env.NODE_ENV === 'test' &&
    process.env.ALLOCATION_ENABLED === 'false' &&
    mongoose.connection.readyState === 1 &&
    mongoose.connection.name === 'hnc_step15q_sandbox'
  );
}

function validSessionIds(sessionIds) {
  if (
    !Array.isArray(sessionIds) ||
    sessionIds.length < 1 ||
    sessionIds.length > 25
  ) {
    return false;
  }

  if (
    !sessionIds.every(id =>
      mongoose.isObjectIdOrHexString(id)
    )
  ) {
    return false;
  }

  const normalized = sessionIds.map(
    id => String(id).toLowerCase()
  );

  return (
    new Set(normalized).size ===
    normalized.length
  );
}

// =====================================================
// ADMIN AUTHORIZATION
// =====================================================

function authorizeFraudReport(req, res, next) {
  const admin = req.admin;

  if (
    !admin ||
    !mongoose.isObjectIdOrHexString(admin._id)
  ) {
    return sendError(
      res,
      401,
      'ADMIN_AUTH_REQUIRED',
      'Administrator authentication required'
    );
  }

  if (!ALLOWED_ROLES.has(admin.role)) {
    return sendError(
      res,
      403,
      'ADMIN_ROLE_REQUIRED',
      'Administrator role required'
    );
  }

  if (
    admin.isActive === false ||
    admin.disabledAt != null
  ) {
    return sendError(
      res,
      403,
      'ADMIN_DISABLED',
      'Administrator account is disabled'
    );
  }

  const currentVersion = admin.tokenVersion ?? 0;

  if (
    !Number.isSafeInteger(currentVersion) ||
    currentVersion < 0 ||
    !Number.isSafeInteger(req.adminTokenVersion) ||
    req.adminTokenVersion < 0 ||
    req.adminTokenVersion !== currentVersion
  ) {
    return sendError(
      res,
      401,
      'ADMIN_SESSION_INVALID',
      'Administrator session is invalid'
    );
  }

  return next();
}

async function revalidateFraudReportAdmin(req) {
  const adminId = req.admin?._id;
  const tokenVersion = req.adminTokenVersion;

  if (
    !mongoose.isObjectIdOrHexString(adminId) ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 0
  ) {
    return false;
  }

  // Recheck against the database rather than
  // relying on the earlier req.admin snapshot.
  const admin = await AdminUser.findOne({
    _id: adminId,
    role: { $in: ['admin', 'superadmin'] },
    isActive: { $ne: false },
    disabledAt: null,
    $or: tokenVersion === 0
      ? [
          { tokenVersion: 0 },
          { tokenVersion: { $exists: false } },
        ]
      : [
          { tokenVersion },
        ],
  })
    .select('_id')
    .lean();

  return Boolean(admin);
}

// =====================================================
// READ-ONLY FRAUD REPORT
// =====================================================

async function getGameplayFraudReport(req, res) {
  res.set('Cache-Control', 'no-store');

  // Never allow this experimental controller
  // to operate against the production database.
  if (!sandboxAllowed()) {
    return sendError(
      res,
      503,
      'REPORT_NOT_AVAILABLE',
      'Fraud reporting is unavailable'
    );
  }

  const body = req.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    !validSessionIds(body.sessionIds)
  ) {
    return sendError(
      res,
      400,
      'INVALID_SESSION_FILTER',
      'Provide 1 to 25 unique session IDs'
    );
  }

 const limit = body.limit ?? body.sessionIds.length;

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 25
  ) {
    return sendError(
      res,
      400,
      'INVALID_REPORT_LIMIT',
      'Report limit must be between 1 and 25'
    );
  }
  // Reject excess session IDs before querying MongoDB.
if (body.sessionIds.length > limit) {
  return sendError(
    res,
    400,
    'SESSION_LIMIT_EXCEEDED',
    'Session ID count exceeds report limit'
  );
}

  try {
    
const result = await generateGameplayFraudReport({
  sessionIds: body.sessionIds,
  limit,
});

// Revalidate administrator authorization AFTER
// report generation and BEFORE returning its data.
const stillAuthorized = await revalidateFraudReportAdmin(req);

if (!stillAuthorized) {
  return sendError(
    res,
    401,
    'ADMIN_SESSION_REVOKED',
    'Administrator session is no longer valid'
  );
}

return res.status(200).json(result);

  } catch (error) {
    // Never expose raw MongoDB exception messages.
    console.error(
      'Fraud report failed:',
      error.code || error.name || 'UNKNOWN_ERROR'
    );

    return sendError(
      res,
      500,
      'FRAUD_REPORT_FAILED',
      'Unable to generate fraud report'
    );
  }
}

module.exports = {
  authorizeFraudReport,
  getGameplayFraudReport,
  revalidateFraudReportAdmin,
};
