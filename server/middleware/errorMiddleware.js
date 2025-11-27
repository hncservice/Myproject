// server/middleware/errorMiddleware.js
module.exports = (err, req, res, next) => {
  // Always log full error on server
  console.error('Unhandled error:', err);

  const status = err.status || 500;

  const payload = {
    message: err.status ? err.message : 'Server error'
  };

  // Optional error codes you might throw: { status, message, code }
  if (err.code) {
    payload.code = err.code;
  }

  // In non-production, expose more details (helps debugging)
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};
