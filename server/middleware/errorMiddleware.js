// server/middleware/errorMiddleware.js
module.exports = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Custom app error support (if you ever throw { status, message, code })
  const status = err.status || 500;
  const payload = {
    message: err.message || 'Server error'
  };
  if (err.code) payload.code = err.code;

  res.status(status).json(payload);
};
