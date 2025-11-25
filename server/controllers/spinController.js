// server/controllers/spinController.js
const crypto = require('crypto');
const User = require('../models/User');
const WheelItem = require('../models/WheelItem');
const Spin = require('../models/Spin');
const { generateQrBuffer } = require('../services/qrService'); // 👈 use buffer-based QR
const emailService = require('../services/emailService');

// GET /api/wheel  -> public wheel config for frontend
exports.getWheelConfig = async (req, res, next) => {
  try {
    const items = await WheelItem.find({ isActive: true }).sort('createdAt');
    res.json(items);
  } catch (err) {
    next(err);
  }
};

// POST /api/spin -> user spins once, generates QR + prize email if win
exports.spinOnce = async (req, res, next) => {
  try {
    // Depending on your auth middleware, this may be req.user.id or req.user._id
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.emailVerified) {
      return res.status(400).json({ message: 'Email not verified' });
    }

    if (user.hasSpun) {
      return res.status(400).json({ message: 'You have already spun the wheel.' });
    }

    const items = await WheelItem.find({ isActive: true });
    if (!items.length) {
      return res.status(400).json({ message: 'Wheel is not configured yet.' });
    }

    // --- Weighted random selection ---
    const totalWeight = items.reduce((sum, item) => sum + item.probabilityWeight, 0);
    let r = Math.random() * totalWeight;
    let selectedItem = null;

    for (const item of items) {
      if (r < item.probabilityWeight) {
        selectedItem = item;
        break;
      }
      r -= item.probabilityWeight;
    }

    const isWin = !!selectedItem;
    const spin = new Spin({
      userId: user._id,
      wheelItemId: selectedItem?._id || null,
      status: isWin ? 'won' : 'lost',
      redemptionStatus: isWin ? 'pending' : undefined
    });

    let qrToken = null;
    let qrBuffer = null;

    if (isWin) {
      // Generate secure random token for QR / vendor scan
      qrToken = crypto.randomBytes(16).toString('hex');
      spin.qrToken = qrToken;

      // Generate QR code PNG buffer (CLIENT_URL/redeem/:token)
      qrBuffer = await generateQrBuffer(qrToken);

      // Optional inventory control
      if (selectedItem.quantityTotal != null) {
        selectedItem.quantityRedeemed = (selectedItem.quantityRedeemed || 0) + 1;
        await selectedItem.save();
      }
    }

    // Mark user as having spun, save spin
    user.hasSpun = true;
    await user.save();
    await spin.save();

    // Send prize email with QR if win
    if (isWin) {
      await emailService.sendPrizeEmail({
        to: user.email,
        name: user.name,
        prizeTitle: selectedItem.title,
        prizeDescription: selectedItem.description,
        qrBuffer, // 👈 buffer goes to email service
        qrToken
      });
    }

    // Response to frontend
    return res.json({
      status: isWin ? 'won' : 'lost',
      prize: isWin ? selectedItem.title : null
    });
  } catch (err) {
    next(err);
  }
};
