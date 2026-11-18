'use strict';
// No message, stack, URL, request body, credential or driver error object is logged.
function errorMetadata(error) {
  return { code: typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : 'UNEXPECTED_ERROR' };
}
module.exports = { errorMetadata };
