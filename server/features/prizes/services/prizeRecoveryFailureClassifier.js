
'use strict';

// Recovery error classification.
// No database connection, awards, or side effects.

const PERMANENT_CODES = new Set([
  'EMAIL_NOT_VERIFIED',
  'USER_NOT_FOUND',
  'PRIZE_ALREADY_AWARDED',
  'LEGACY_PRIZE_EXISTS',
  'GAME_NOT_QUALIFIED',
  'INVALID_IDENTIFIERS',
  'INVALID_RECOVERY_IDENTITY',
  'RECOVERY_IDENTITY_CONFLICT',
]);

const TRANSIENT_CODES = new Set([
  'TEMPORARY_ERROR',
  'INJECTED_DB_FAILURE',
  'RECOVERY_FAILED',
  'ASSESSMENT_UNAVAILABLE',
  'DECISION_CONFLICT',
  'MONGO_NETWORK_ERROR',
  'MONGO_SERVER_SELECTION_ERROR',
  'MONGO_TIMEOUT',
  'MONGO_WRITE_CONFLICT',
  'MONGO_PRIMARY_UNAVAILABLE',
]);

function classifyRecoveryFailure(errorCode) {
  if (
    typeof errorCode !== 'string' ||
    !/^[A-Z0-9_]{1,100}$/.test(errorCode)
  ) {
    throw Object.assign(
      new Error('Invalid recovery error code'),
      { code: 'INVALID_ERROR_CODE' }
    );
  }

  if (PERMANENT_CODES.has(errorCode)) {
    return {
      code: errorCode,
      category: 'permanent',
      retryable: false,
    };
  }

  if (TRANSIENT_CODES.has(errorCode)) {
    return {
      code: errorCode,
      category: 'transient',
      retryable: true,
    };
  }

  // Unknown errors must never approve a customer
  // or bypass the maximum retry limit.
  return {
    code: errorCode,
    category: 'unknown',
    retryable: true,
  };
}

module.exports = {
  classifyRecoveryFailure,
};
