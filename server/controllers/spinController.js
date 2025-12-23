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

    const attempts = Number(user.monkeyAttempts || 0);
    const chancesLeft = Math.max(0, MONKEY_MAX_CHANCES - attempts);
    const locked = !!user.monkeyLocked || !!user.hasSpun || chancesLeft <= 0;

    return res.json({ chancesLeft, maxChances: MONKEY_MAX_CHANCES, locked });
  } catch (err) {
    console.error('getMonkeyStatus error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/spin/monkey-attempt
// POST /api/spin/monkey-attempt
exports.monkeyAttempt = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    // IMPORTANT: use the SAME field name as in your schema
    const user = await User.findById(userId).select(
      'monkeyAttempts monkeyLocked hasSpun lastMonkeySessionId'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Idempotency: same sessionId => do not consume again
    if (user.lastMonkeySessionId && user.lastMonkeySessionId === sessionId) {
      const attemptsNow = Number(user.monkeyAttempts || 0);
      const chancesLeftNow = Math.max(0, MONKEY_MAX_CHANCES - attemptsNow);

      // locked means "no more attempts remaining"
      const lockedNow = !!user.monkeyLocked || !!user.hasSpun || attemptsNow >= MONKEY_MAX_CHANCES;

      return res.json({
        allowed: !lockedNow,
        chancesLeft: chancesLeftNow,
        maxChances: MONKEY_MAX_CHANCES,
        locked: lockedNow,
        deduped: true,
      });
    }

    // If already locked, deny
    const attempts = Number(user.monkeyAttempts || 0);
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

    // Atomic consume
    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        hasSpun: { $ne: true },
        monkeyLocked: { $ne: true },
        monkeyAttempts: { $lt: MONKEY_MAX_CHANCES },
        lastMonkeySessionId: { $ne: sessionId },
      },
      {
        $inc: { monkeyAttempts: 1 },
        $set: { lastMonkeySessionId: sessionId },
      },
      { new: true }
    ).select('monkeyAttempts monkeyLocked hasSpun lastMonkeySessionId');

    // If update failed, re-check current state
    if (!updated) {
      const finalUser = await User.findById(userId).select('monkeyAttempts monkeyLocked hasSpun');
      const finalAttempts = Number(finalUser.monkeyAttempts || 0);
      const chancesLeft = Math.max(0, MONKEY_MAX_CHANCES - finalAttempts);
      const locked = !!finalUser.monkeyLocked || !!finalUser.hasSpun || finalAttempts >= MONKEY_MAX_CHANCES;

      return res.status(400).json({
        message: locked ? 'You have used all your chances.' : 'Try again.',
        locked,
        chancesLeft,
        maxChances: MONKEY_MAX_CHANCES,
      });
    }

    const finalAttempts = Number(updated.monkeyAttempts || 0);
    const chancesLeft = Math.max(0, MONKEY_MAX_CHANCES - finalAttempts);

    // ✅ Key change:
    // This request is allowed because it SUCCESSFULLY consumed an attempt.
    // locked is for NEXT attempt (when attempts reached max).
    const lockedNext = !!updated.hasSpun || !!updated.monkeyLocked || finalAttempts >= MONKEY_MAX_CHANCES;

    // optional: persist monkeyLocked once max reached
    if (!updated.monkeyLocked && finalAttempts >= MONKEY_MAX_CHANCES) {
      updated.monkeyLocked = true;
      await updated.save();
    }

    return res.json({
      allowed: true,              // ✅ allow the game you just started
      chancesLeft,
      maxChances: MONKEY_MAX_CHANCES,
      locked: lockedNext,         // ✅ lock for next time
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
