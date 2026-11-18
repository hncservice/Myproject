
'use strict';

const User = require('../models/User');
const { compareOtp } = require('./otpService');
const { ATTEMPT_LIMIT, versionFilter } = require('./authPolicy');

const VALID_PURPOSES = new Set([
  'registration',
  'login',
]);

function otpError(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    code,
  });
}

const invalidOtp = () =>
  otpError(400, 'INVALID_OTP', 'Invalid or expired OTP');

async function consumeUserOtp({ email, otp }) {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();

  if (!/^\d{6}$/.test(String(otp))) {
    throw invalidOtp();
  }

  const user = await User.findOne({
    email: normalizedEmail,
  }).select(
    '_id name email emailVerified hasSpun ' +
    'otpHash otpExpiresAt otpPurpose pendingRegistration otpAttempts isActive tokenVersion'
  );

  if (!user) {
    throw invalidOtp();
  }
  if (user.isActive === false) throw otpError(403, 'ACCOUNT_DISABLED', 'Account is disabled');

  if (!user.otpHash || !user.otpExpiresAt) {
    throw otpError(
      400,
      'OTP_NOT_REQUESTED',
      'OTP not requested'
    );
  }

  // Legacy OTPs without a purpose are not accepted.
  if (user.otpPurpose !== 'registration') {
    throw otpError(
      400,
      'OTP_PURPOSE_INVALID',
      'Please request a new OTP'
    );
  }

  if (user.otpExpiresAt <= new Date()) {
    throw otpError(
      400,
      'OTP_EXPIRED',
      'OTP expired'
    );
  }

  const originalHash = user.otpHash;
  const originalExpiry = user.otpExpiresAt;
  const originalPurpose = user.otpPurpose;
  const version = versionFilter(user.tokenVersion ?? 0);
  const attemptFilter = { _id: user._id, otpHash: originalHash, otpPurpose: originalPurpose, isActive: { $ne: false },
    otpExpiresAt: { $eq: originalExpiry, $gt: new Date() }, $and: [version, { $or: [{ otpAttempts: { $lt: ATTEMPT_LIMIT } }, { otpAttempts: { $exists: false } }] }] };
  // Reserve before bcrypt comparison; at most five concurrent guesses can proceed.
  const reserved = await User.updateOne(attemptFilter, { $inc: { otpAttempts: 1 } });
  if (reserved.modifiedCount !== 1) throw otpError(429, 'OTP_ATTEMPT_LIMIT', 'OTP unavailable or attempt limit reached. Please request a new code');

  const matches = await compareOtp(
    String(otp),
    originalHash
  );

  if (!matches) {
    throw invalidOtp();
  }

  const consumedAt = new Date();

  const filter = {
    _id: user._id,
    email: normalizedEmail,
    otpHash: originalHash,
    otpPurpose: originalPurpose,
    isActive: { $ne: false },
    ...version,
    otpExpiresAt: {
      $eq: originalExpiry,
      $gt: consumedAt,
    },
  };

  const updates = {
    $set: {
      emailVerified: true,
      otpHash: null,
      otpExpiresAt: null,
      otpPurpose: null,
      otpAttempts: 0,
    },
    $unset: {
      pendingRegistration: 1,
    },
  };

  if (originalPurpose === 'registration') {
    if (user.emailVerified) {
      throw otpError(
        409,
        'ACCOUNT_ALREADY_VERIFIED',
        'Account is already verified'
      );
    }

    filter.emailVerified = false;

    const pending = user.pendingRegistration;

    if (
      !pending?.name ||
      !pending?.phone ||
      !pending?.passwordHash
    ) {
      throw otpError(
        409,
        'REGISTRATION_INCOMPLETE',
        'Please restart registration'
      );
    }

    updates.$set.name = pending.name;
    updates.$set.phone = pending.phone;
    updates.$set.passwordHash = pending.passwordHash;
    filter['pendingRegistration.passwordHash'] = pending.passwordHash;
    filter['pendingRegistration.name'] = pending.name;
    filter['pendingRegistration.phone'] = pending.phone;
  }

  if (originalPurpose === 'login') {
    filter.emailVerified = true;

    if (!user.emailVerified) {
      throw otpError(
        403,
        'ACCOUNT_NOT_VERIFIED',
        'Account verification required'
      );
    }
  }

  let verifiedUser;

  try {
    // OTP consumption and pending-registration changes
    // happen in one conditional MongoDB update.
    verifiedUser = await User.findOneAndUpdate(
      filter,
      updates,
      {
        new: true,
        runValidators: true,
        projection: {
          name: 1,
          email: 1,
          emailVerified: 1,
          hasSpun: 1,
          tokenVersion: 1,
        },
      }
    );
  } catch (error) {
    if (error.code === 11000) {
      throw otpError(
        409,
        'REGISTRATION_CONFLICT',
        'Account details are already in use'
      );
    }

    throw error;
  }

  if (!verifiedUser) {
    throw otpError(
      409,
      'OTP_ALREADY_CONSUMED',
      'OTP already used, replaced, or expired'
    );
  }

  return verifiedUser;
}

module.exports = {
  consumeUserOtp,
};
