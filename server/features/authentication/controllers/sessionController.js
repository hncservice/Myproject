'use strict';
const { revokeSession } = require('../services/sessionRevocationService');
exports.logout = async (req, res) => {
  try { return res.json(await revokeSession(req.headers?.authorization)); }
  catch (error) { return res.status(error.status === 401 ? 401 : 500).json({ code: error.status === 401 ? error.code : 'AUTHENTICATION_ERROR', message: error.status === 401 ? 'Invalid or expired token' : 'Authentication service error' }); }
};
