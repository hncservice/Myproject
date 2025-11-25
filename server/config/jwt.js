// server/config/jwt.js
const jwt = require('jsonwebtoken');

exports.signToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

exports.verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
