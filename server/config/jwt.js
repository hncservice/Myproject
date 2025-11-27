// server/config/jwt.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

if (!JWT_SECRET) {
  throw new Error(' JWT_SECRET is not set in environment variables');
}

const signToken = (payload, expiresIn = JWT_EXPIRES_IN) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256'
  });

const verifyToken = (token) =>
  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

module.exports = { signToken, verifyToken };
