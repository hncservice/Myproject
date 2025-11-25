// server/services/spinService.js
const crypto = require('crypto');
const weightedRandom = require('../utils/weightedRandom');
const WheelItem = require('../models/WheelItem');
const Spin = require('../models/Spin');
const User = require('../models/User');
const { generateQrDataUrl } = require('./qrService');
const { sendPrizeEmail } = require('./emailService');

exports.performSpinForUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (!user.emailVerified) throw new Error('Email not verified');
  if (user.hasSpun) throw new Error('User already spun');

  const items = await WheelItem.find({ isActive: true });
  if (!items.length) throw new Error('No wheel items configured');

  // Filter out exhausted inventory
  const availableItems = items.filter((item) => {
    if (item.quantityTotal == null) return true;
    return item.quantityRedeemed < item.quantityTotal;
  });

  // You can include a "no prize" virtual item if you want, or just handle null
  const chosenItem = weightedRandom(availableItems);

  let status = 'lost';
  let wheelItemId = null;
  let spinDoc;
  let qrToken;
  let qrDataUrl;

  if (!chosenItem) {
    // Lost spin
    spinDoc = await Spin.create({
      userId: user._id,
      status: 'lost',
      redemptionStatus: 'pending'
    });
  } else {
    status = 'won';
    wheelItemId = chosenItem._id;

    // Generate secure token
    qrToken = crypto.randomBytes(16).toString('hex');
    const qrExpiry = null; // set expiry date if needed

    qrDataUrl = await generateQrDataUrl(qrToken);

    spinDoc = await Spin.create({
      userId: user._id,
      wheelItemId,
      status,
      qrToken,
      qrExpiry,
      redemptionStatus: 'pending'
    });

    // update inventory
    if (chosenItem.quantityTotal != null) {
      chosenItem.quantityRedeemed += 1;
      await chosenItem.save();
    }

    // mark user as used
    user.hasSpun = true;
    await user.save();

    // send prize email
    await sendPrizeEmail({
      to: user.email,
      userName: user.name,
      prizeTitle: chosenItem.title,
      qrToken,
      qrDataUrl
    });

    spinDoc.emailSent = true;
    await spinDoc.save();
  }

  return {
    spin: spinDoc,
    status,
    prize: chosenItem ? chosenItem.title : null
  };
};
