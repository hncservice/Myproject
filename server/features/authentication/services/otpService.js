
'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

const OTP_LENGTH = 6;
const SALT_ROUNDS = 10;

// ============================================
// GENERATE SECURE 6-DIGIT OTP
// ============================================

function generateOtp() {
  return crypto.randomInt(
    0,
    10 ** OTP_LENGTH
  ).toString().padStart(OTP_LENGTH, '0');
}

// ============================================
// HASH OTP BEFORE STORING
// ============================================

async function hashOtp(otp) {
  if (!/^\d{6}$/.test(String(otp))) {
    throw new Error('Invalid OTP format');
  }

  return bcrypt.hash(String(otp), SALT_ROUNDS);
}

// ============================================
// COMPARE OTP AGAINST STORED HASH
// ============================================

async function compareOtp(otp, hash) {
  if (
    !/^\d{6}$/.test(String(otp)) ||
    typeof hash !== 'string' ||
    !hash
  ) {
    return false;
  }

  return bcrypt.compare(String(otp), hash);
}

module.exports = {
  generateOtp,
  hashOtp,
  compareOtp,
};
