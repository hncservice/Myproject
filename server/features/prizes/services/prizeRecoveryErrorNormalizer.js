
'use strict';

// Converts internal exceptions to safe, bounded
// recovery error codes.
//
// Does not expose database URLs, credentials,
// customer information or raw error messages.

const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,99}$/;

const ALLOWED_CODES = new Set([
  'EMAIL_NOT_VERIFIED',
  'USER_NOT_FOUND',
  'PRIZE_ALREADY_AWARDED',
  'LEGACY_PRIZE_EXISTS',
  'GAME_NOT_QUALIFIED',
  'INVALID_IDENTIFIERS',
  'INVALID_RECOVERY_IDENTITY',
  'RECOVERY_IDENTITY_CONFLICT',
  'ASSESSMENT_UNAVAILABLE',
  'DECISION_CONFLICT',
  'TEMPORARY_ERROR',
  'INJECTED_DB_FAILURE',
  'RECOVERY_FAILED',
  'CLAIM_EXPIRED',
  'CLAIM_CONFLICT',
  'MONGO_NETWORK_ERROR',
  'MONGO_SERVER_SELECTION_ERROR',
  'MONGO_TIMEOUT',
  'MONGO_WRITE_CONFLICT',
  'MONGO_PRIMARY_UNAVAILABLE',
]);

function normalizeRecoveryError(error) {
  if (!error || typeof error !== 'object') {
    return 'RECOVERY_FAILED';
  }

  const name =
    typeof error.name === 'string'
      ? error.name
      : '';

  const code = error.code;

  // MongoDB driver numeric codes.
  if (code === 50 || code === 262) {
    return 'MONGO_TIMEOUT';
  }

  if (code === 112) {
    return 'MONGO_WRITE_CONFLICT';
  }

  if (
    code === 91 ||
    code === 10107 ||
    code === 11600 ||
    code === 11602
  ) {
    return 'MONGO_PRIMARY_UNAVAILABLE';
  }

  // MongoDB driver exception names.
  if (name === 'MongoServerSelectionError') {
    return 'MONGO_SERVER_SELECTION_ERROR';
  }

  if (
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError'
  ) {
    return name === 'MongoNetworkTimeoutError'
      ? 'MONGO_TIMEOUT'
      : 'MONGO_NETWORK_ERROR';
  }

  if (
    name === 'MongooseServerSelectionError'
  ) {
    return 'MONGO_SERVER_SELECTION_ERROR';
  }

  if (name === 'MongooseError' && code === 'ETIMEOUT') {
    return 'MONGO_TIMEOUT';
  }

  // Preserve only explicitly recognized application
  // error codes. Never return arbitrary exception
  // messages or untrusted code strings.
  if (
    typeof code === 'string' &&
    SAFE_CODE.test(code) &&
    ALLOWED_CODES.has(code)
  ) {
    return code;
  }

  return 'RECOVERY_FAILED';
}

module.exports = {
  normalizeRecoveryError,
};
