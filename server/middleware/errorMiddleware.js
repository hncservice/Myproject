'use strict';
const { errorMetadata } = require('../infrastructure/logging/errorMetadata');
module.exports = (err, req, res, next) => {
  console.error('Unhandled error:', errorMetadata(err));
  if (res.headersSent) return next(err);
  const candidate = err?.status ?? err?.statusCode;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  const payload = { message: status < 500 && typeof err?.message === 'string' ? err.message.slice(0, 300) : 'Server error' };
  const metadata = errorMetadata(err);
  if (metadata.code !== 'UNEXPECTED_ERROR') payload.code = metadata.code;
  // Express parser errors can contain fragments of submitted bodies.
  if (err?.type === 'entity.parse.failed') { payload.message = 'Invalid JSON request'; payload.code = 'INVALID_JSON'; }
  if (err?.type === 'entity.too.large') { payload.message = 'Request body too large'; payload.code = 'REQUEST_TOO_LARGE'; }
  return res.status(status).json(payload);
};
