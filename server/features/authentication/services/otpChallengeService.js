'use strict';
const User = require('../models/User');
const { generateOtp, hashOtp } = require('./otpService');
const { sendOtpEmail } = require('../../../infrastructure/email/emailService');
const { TTL_MS, COOLDOWN_MS, SEND_LIMIT, error, versionFilter } = require('./authPolicy');
async function issueUserOtp({ user, purpose, pendingRegistration } = {}) {
  if (!user || !['registration', 'login'].includes(purpose) || user.emailVerified !== (purpose === 'login') || user.isActive === false) throw error(409, 'OTP_STATE_CHANGED', 'Account state changed');
  const now = Date.now();
  const requested = user.otpRequestedAt == null ? null : new Date(user.otpRequestedAt).getTime();
  const window = user.otpWindowStartedAt == null ? null : new Date(user.otpWindowStartedAt).getTime();
  const count = user.otpSendCount ?? 0;
  if ((requested !== null && (!Number.isFinite(requested) || requested > now)) || (window !== null && (!Number.isFinite(window) || window > now)) || !Number.isSafeInteger(count) || count < 0) throw error(409, 'OTP_STATE_INVALID', 'Please try again later');
  if (requested !== null && now - requested < COOLDOWN_MS) throw error(429, 'OTP_COOLDOWN', 'Please wait one minute before requesting another OTP');
  const sameWindow = window !== null && now - window < TTL_MS;
  if (sameWindow && count >= SEND_LIMIT) throw error(429, 'OTP_SEND_LIMIT', 'Too many OTP requests. Please try again later');
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const filter = { _id: user._id, emailVerified: purpose === 'login', isActive: { $ne: false }, otpHash: user.otpHash || null,
    otpRequestedAt: user.otpRequestedAt || null, ...versionFilter(user.tokenVersion ?? 0) };
  const saved = await User.findOneAndUpdate(filter, { $set: { otpHash, otpExpiresAt: new Date(now + TTL_MS), otpPurpose: purpose,
    otpRequestedAt: new Date(now), otpWindowStartedAt: new Date(sameWindow ? window : now), otpSendCount: sameWindow ? count + 1 : 1, otpAttempts: 0,
    ...(pendingRegistration ? { pendingRegistration } : {}) } }, { new: true, runValidators: true });
  if (!saved) throw error(409, 'OTP_STATE_CHANGED', 'OTP was replaced or account state changed. Please retry');
  const emailStartedAt = Date.now();
  try {
    await sendOtpEmail(saved.email, otp);
    if (process.env.NODE_ENV === 'development') {
  console.info('[OTP_EMAIL_TIMING]', {
    durationMs: Date.now() - emailStartedAt,
  });
}
  } catch (err) {
    console.error('[OTP_EMAIL_DELIVERY_FAILED]', {
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
    });

    throw error(
      503,
      'OTP_DELIVERY_UNAVAILABLE',
      'Unable to deliver OTP. Please wait one minute and retry'
    );
  }
  return true;
}
module.exports = { issueUserOtp, versionFilter, TTL_MS, COOLDOWN_MS, SEND_LIMIT };
