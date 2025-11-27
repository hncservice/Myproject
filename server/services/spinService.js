// server/services/spinService.js
const crypto = require('crypto');
const weightedRandom = require('../utils/weightedRandom');
const WheelItem = require('../models/WheelItem');
const Spin = require('../models/Spin');
const User = require('../models/User');
const { generateQrBuffer } = require('./qrService');
const { sendPrizeEmail } = require('./emailService');

/**
 * Perform a single spin for a user.
 * - Ensures user exists
 * - Ensures email verified
 * - Ensures user has not already spun
 * - Respects quantityTotal / quantityRedeemed
 * - Generates QR + email if won
 *
 * Returns:
 * {
 *   spin,             // Spin document
 *   status,           // 'won' | 'lost'
 *   prize,            // prize title or null
 *   selectedItem      // WheelItem or null
 * }
 */
exports.performSpinForUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (!user.emailVerified) {
    const err = new Error('Email not verified');
    err.status = 400;
    throw err;
  }

  if (user.hasSpun) {
    const err = new Error('User already spun the wheel');
    err.status = 400;
    throw err;
  }

  const items = await WheelItem.find({ isActive: true });
  if (!items.length) {
    const err = new Error('No wheel items configured');
    err.status = 400;
    throw err;
  }

  // Filter out exhausted inventory
  const availableItems = items.filter((item) => {
    if (item.quantityTotal == null) return true; // unlimited
    return item.quantityRedeemed < item.quantityTotal;
  });

  if (!availableItems.length) {
    const err = new Error('All prizes are exhausted');
    err.status = 400;
    throw err;
  }

  // Weighted random selection among available items
  const chosenItem = weightedRandom(availableItems);

  let status = 'lost';
  let wheelItemId = null;
  let spinDoc;
  let qrToken = null;
  let qrBuffer = null;

  if (!chosenItem) {
    // Lost spin (no prize)
    spinDoc = await Spin.create({
      userId: user._id,
      status: 'lost',
      redemptionStatus: 'pending'
    });
  } else {
    status = 'won';
    wheelItemId = chosenItem._id;

    // Generate secure random token
    qrToken = crypto.randomBytes(16).toString('hex');
    const qrExpiry = null; // set expiry if you want time limit

    // QR PNG buffer for email
    qrBuffer = await generateQrBuffer(qrToken);

    spinDoc = await Spin.create({
      userId: user._id,
      wheelItemId,
      status,
      qrToken,
      qrExpiry,
      redemptionStatus: 'pending'
    });

    // Update inventory (non-atomic but OK for your scale)
    if (chosenItem.quantityTotal != null) {
      chosenItem.quantityRedeemed = (chosenItem.quantityRedeemed || 0) + 1;
      await chosenItem.save();
    }

    // Mark user as used
    user.hasSpun = true;
    await user.save();

    // Send prize email with QR
    await sendPrizeEmail({
      to: user.email,
      name: user.name,
      prizeTitle: chosenItem.title,
      prizeDescription: chosenItem.description,
      qrBuffer,
      qrToken
    });

    spinDoc.emailSent = true;
    await spinDoc.save();
  }

  return {
    spin: spinDoc,
    status,
    prize: chosenItem ? chosenItem.title : null,
    selectedItem: chosenItem || null
  };
};
