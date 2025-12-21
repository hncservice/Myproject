const WheelItem = require('../models/WheelItem');
const User = require('../models/User');
const { performSpinForUser } = require('../services/spinService');

const MONKEY_MAX_CHANCES = 3;

// GET /api/spin/monkey-status
exports.getMonkeyStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const user = await User.findById(userId).select('monkeyAttempts monkeyLocked hasSpun');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const attempts = user.monkeyAttempts || 0;
    const chancesLeft = Math.max(0, MONKEY_MAX_CHANCES - attempts);

    const locked = !!user.monkeyLocked || !!user.hasSpun || chancesLeft <= 0;

    return res.json({
      chancesLeft,
      maxChances: MONKEY_MAX_CHANCES,
      locked,
    });
  } catch (err) {
    console.error('getMonkeyStatus error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/spin/monkey-attempt
exports.monkeyAttempt = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const user = await User.findById(userId).select('monkeyAttempts monkeyLocked hasSpun');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const attempts = user.monkeyAttempts || 0;

    // already locked
    if (user.hasSpun || user.monkeyLocked || attempts >= MONKEY_MAX_CHANCES) {
      if (!user.monkeyLocked) {
        user.monkeyLocked = true;
        await user.save();
      }
      return res.status(400).json({
        message: 'You have used all your chances.',
        locked: true,
        chancesLeft: 0,
        maxChances: MONKEY_MAX_CHANCES,
      });
    }

    // consume an attempt
    user.monkeyAttempts = attempts + 1;

    if (user.monkeyAttempts >= MONKEY_MAX_CHANCES) {
      user.monkeyLocked = true;
    }

    await user.save();

    const chancesLeft = Math.max(0, MONKEY_MAX_CHANCES - user.monkeyAttempts);
    const locked = !!user.monkeyLocked || !!user.hasSpun || chancesLeft <= 0;

    return res.json({
      allowed: true,
      chancesLeft,
      maxChances: MONKEY_MAX_CHANCES,
      locked,
    });
  } catch (err) {
    console.error('monkeyAttempt error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/spin/wheel
exports.getWheelConfig = async (req, res, next) => {
  try {
    const items = await WheelItem.find({ isActive: true }).sort('createdAt');
    res.json(items);
  } catch (err) {
    next(err);
  }
};

// POST /api/spin/spin
exports.spinOnce = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const result = await performSpinForUser(userId);

    return res.json({
      status: result.status,
      prize: result.prize,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return next(err);
  }
};
