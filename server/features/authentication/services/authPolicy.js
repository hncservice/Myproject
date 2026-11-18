'use strict';
const TTL_MS = 600000;
const COOLDOWN_MS = 60000;
const SEND_LIMIT = 5;
const ATTEMPT_LIMIT = 5;
function error(status, code, message) { return Object.assign(new Error(message), { status, code }); }
function versionFilter(version = 0) {
  if (!Number.isSafeInteger(version) || version < 0) throw error(403, 'ACCOUNT_STATE_INVALID', 'Account requires review');
  return version === 0 ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] } : { tokenVersion: version };
}
module.exports = { TTL_MS, COOLDOWN_MS, SEND_LIMIT, ATTEMPT_LIMIT, error, versionFilter };
