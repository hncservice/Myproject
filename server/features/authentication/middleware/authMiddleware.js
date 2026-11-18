
'use strict';

const mongoose = require('mongoose');

const { verifyToken } = require('../../../config/jwt');

const Vendor = require('../../vendors/models/Vendor');
const AdminUser = require('../../administration/models/AdminUser');
const User = require('../models/User');

function extractToken(req) {
  const header = req.headers?.authorization;

  if (typeof header !== 'string') {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/i.exec(header.trim());

  return match ? match[1] : null;
}

function validPayload(payload, expectedType = null) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (!mongoose.isObjectIdOrHexString(payload.id)) {
    return false;
  }

  if (expectedType && payload.type !== expectedType) {
    return false;
  }

  return true;
}

function authenticationFailed(res) {
  return res.status(401).json({
    message: 'Invalid or expired token',
  });
}

// ============================================
// CUSTOMER AUTHENTICATION
// ============================================

const authUser = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  let payload;

  try {
    payload = verifyToken(token);
  } catch (error) {
    return authenticationFailed(res);
  }

  // Preserve compatibility with existing customer
  // tokens that may not contain a "type" claim.
  // Explicit vendor/admin tokens cannot act as users.
  if (
    !validPayload(payload) ||
    (payload.type != null &&
      payload.type !== 'user')
  ) {
    return authenticationFailed(res);
  }

  try {
    const user = await User.findById(payload.id);

    if (!user) {
      return authenticationFailed(res);
    }
    if (user.isActive === false) return res.status(403).json({ code: 'ACCOUNT_DISABLED', message: 'Account is disabled' });
    if (user.emailVerified === false) return res.status(403).json({ code: 'ACCOUNT_NOT_VERIFIED', message: 'Account verification required' });
    const currentVersion = user.tokenVersion ?? 0;
    const tokenVersion = payload.tokenVersion ?? 0;
    if (!Number.isSafeInteger(currentVersion) || currentVersion < 0 || !Number.isSafeInteger(tokenVersion) || tokenVersion < 0 || tokenVersion !== currentVersion) {
      return res.status(401).json({ code: 'TOKEN_REVOKED', message: 'Session expired. Please log in again.' });
    }

    req.user = user;
    req.userTokenVersion = tokenVersion;
    return next();
  } catch (error) {
    console.error('authUser lookup error:', { code: 'ACCOUNT_LOOKUP_FAILED' });
    return res.status(500).json({
      message: 'Authentication service error',
    });
  }
};

// ============================================
// VENDOR AUTHENTICATION
// ============================================

const authVendor = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  let payload;

  try {
    payload = verifyToken(token);
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token',
    });
  }

  if (!validPayload(payload)) {
    return res.status(401).json({
      message: 'Invalid or expired token',
    });
  }

  if (payload.type !== 'vendor') {
    return res.status(403).json({
      message: 'Vendor access required',
    });
  }

  try {
    const vendor = await Vendor.findById(payload.id);

    if (!vendor) {
      return res.status(401).json({
        message: 'Vendor account not found',
      });
    }

    if (vendor.isActive === false) {
      return res.status(403).json({
        code: 'VENDOR_DISABLED',
        message: 'Vendor account is disabled',
      });
    }

    const currentVersion =
      vendor.tokenVersion ?? 0;

    const tokenVersion =
      payload.tokenVersion ?? 0;

    if (
      !Number.isSafeInteger(currentVersion) ||
      currentVersion < 0 ||
      !Number.isSafeInteger(tokenVersion) ||
      tokenVersion < 0 ||
      tokenVersion !== currentVersion
    ) {
      return res.status(401).json({
        code: 'TOKEN_REVOKED',
        message:
          'Session expired. Please log in again.',
      });
    }

    req.vendor = vendor;

// Preserve the exact JWT version that was authenticated.
// The redemption service must check this version again,
// not merely use a later version from the database.
req.vendorTokenVersion = tokenVersion;

return next();
  } catch (error) {
    console.error(
      'authVendor account lookup failed:',
      { code: 'ACCOUNT_LOOKUP_FAILED' }
    );

    return res.status(500).json({
      message: 'Authentication service error',
    });
  }
};

// ============================================
// ADMIN AUTHENTICATION
// ============================================

const authAdmin = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  let payload;

  try {
    payload = verifyToken(token);
  } catch (error) {
    return authenticationFailed(res);
  }

  if (!validPayload(payload)) {
    return authenticationFailed(res);
  }

  if (payload.type !== 'admin') {
    return res.status(403).json({
      message: 'Admin access required',
    });
  }

  try {
    const admin = await AdminUser.findById(payload.id);

    if (!admin) {
  return authenticationFailed(res);
}

if (
  admin.isActive === false ||
  admin.disabledAt != null
) {
  return res.status(403).json({
    code: 'ADMIN_DISABLED',
    message: 'Administrator account is disabled',
  });
}

const currentVersion = admin.tokenVersion ?? 0;
const tokenVersion = payload.tokenVersion ?? 0;

if (
  !Number.isSafeInteger(currentVersion) ||
  currentVersion < 0 ||
  !Number.isSafeInteger(tokenVersion) ||
  tokenVersion < 0 ||
  tokenVersion !== currentVersion
) {
  return res.status(401).json({
    code: 'TOKEN_REVOKED',
    message: 'Session expired. Please log in again.',
  });
}

req.admin = admin;

// Preserve the authenticated JWT token version.
// Prize review transactions must verify this version
// against the administrator's current database version.
req.adminTokenVersion = tokenVersion;

return next();
  } catch (error) {
    console.error('authAdmin lookup error:', { code: 'ACCOUNT_LOOKUP_FAILED' });
    return res.status(500).json({
      message: 'Authentication service error',
    });
  }
};

// ============================================
// LEGACY AUTHENTICATION
// ============================================

// Retained for compatibility with existing routes.
// Do not use this generic middleware alone to
// authorize sensitive vendor or admin operations.

const auth = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
    });
  }

  try {
    const decoded = verifyToken(token);

    if (!validPayload(decoded)) {
      return authenticationFailed(res);
    }

    req.user = decoded;
    return next();
  } catch (error) {
    return authenticationFailed(res);
  }
};

const requireAdmin = (req, res, next) => {
  if (
    !req.user ||
    req.user.type !== 'admin'
  ) {
    return res.status(403).json({
      message: 'Admin access required',
    });
  }

  return next();
};

module.exports = {
  authUser,
  authVendor,
  authAdmin,
  auth,
  requireAdmin,
};
