
'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || '1h';

const JWT_ALGORITHM = 'HS256';

if (
  typeof JWT_SECRET !== 'string' ||
  !JWT_SECRET.trim()
) {
  throw new Error(
    'JWT_SECRET is not set in environment variables'
  );
}

function signToken(
  payload,
  expiresIn = JWT_EXPIRES_IN
) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new Error('Invalid JWT payload');
  }

  if (!payload.id) {
    throw new Error('JWT payload must contain id');
  }

  return jwt.sign(
    { ...payload },
    JWT_SECRET,
    {
      expiresIn,
      algorithm: JWT_ALGORITHM,
    }
  );
}

function verifyToken(token) {
  if (
    typeof token !== 'string' ||
    !token.trim()
  ) {
    throw new Error('Invalid JWT token');
  }

  return jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    ignoreExpiration: false,
    ignoreNotBefore: false,
  });
}

module.exports = {
  signToken,
  verifyToken,
};
