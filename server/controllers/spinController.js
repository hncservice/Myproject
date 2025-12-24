// server/controllers/spinController.js

const WheelItem = require('../models/WheelItem');
const User = require('../models/User');
const Spin = require('../models/Spin');

const { performSpinForUser } = require('../services/spinService');
const { generateQrDataUrl } = require('../services/qrService');

const { randomBytes } = require('crypto');

// ===== Monkey game config =====
const MONKEY_MAX_CHANCES = 3;
const MONKEY_SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutes

// ===============================
// GET /api/spin/monkey-status
// ===============================
exports.getMonkeyStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const user = await User.findById(userId).select(
      'monkeyAttempts monkeyLocked hasSpun lastMonkeySessionId monkeyActiveSession'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    const attempts = Number(user.monkeyAttempts || 0);
    const chancesLeft = Math.max(0, MONKEY_MAX_CHANCES - attempts);

    // expire active session if needed
    const now = new Date();
    if (
      user.monkeyActiveSession?.status === 'active' &&
      user.monkeyActiveSession?.expiresAt &&
      user.monkeyActiveSession.expiresAt < now
    ) {
      user.monkeyActiveSession.status = 'expired';
      user.monkeyActiveSession.expiresAt = null;
      user.monkeyActiveSession.startedAt = null;
      user.monkeyActiveSession.sessionId = null;
      await user.save();
    }

    const locked = !!user.monkeyLocked || !!user.hasSpun || chancesLeft <= 0;

    return res.json({
      chancesLeft,
      maxChances: MONKEY_MAX_CHANCES,
      locked,
      activeSession:
        user.monkeyActiveSession?.status === 'active'
          ? {
              sessionId: user.monkeyActiveSession.sessionId,
              expiresAt: user.monkeyActiveSession.expiresAt,
            }
          : null,
    });
  } catch (err) {
    console.error('getMonkeyStatus error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ===============================
// POST /api/spin/monkey-attempt
// ===============================
exports.monkeyAttempt = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const user = await User.findById(userId).select(
      'monkeyAttempts monkeyLocked hasSpun monkeyActiveSession'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    // If already has active session (resume after logout)
    const now = new Date();
    if (
      user.monkeyActiveSession?.status === 'active' &&
      user.monkeyActiveSession?.expiresAt &&
      user.monkeyActiveSession.expiresAt > now &&
      user.monkeyActiveSession.sessionId
    ) {
      const attemptsNow = Number(user.monkeyAttempts || 0);
      const chancesLeftNow = Math.max(0, MONKEY_MAX_CHANCES - attemptsNow);
      const lockedNow =
        !!user.monkeyLocked || !!user.hasSpun || attemptsNow >= MONKEY_MAX_CHANCES;

      return res.json({
        allowed: !lockedNow,
        chancesLeft: chancesLeftNow,
        maxChances: MONKEY_MAX_CHANCES,
        locked: lockedNow,
        sessionId: user.monkeyActiveSession.sessionId,
        resumed: true,
      });
    }

    // Deny if locked / exhausted
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

    // Consume 1 attempt atomically
    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        hasSpun: { $ne: true },
        monkeyLocked: { $ne: true },
        monkeyAttempts: { $lt: MONKEY_MAX_CHANCES },
      },
      {
        $inc: { monkeyAttempts: 1 },
      },
      { new: true }
    ).select('monkeyAttempts monkeyLocked hasSpun monkeyActiveSession');

    if (!updated) {
      return res.status(400).json({ message: 'Try again.' });
    }

    const finalAttempts = Number(updated.monkeyAttempts || 0);
    const chancesLeft = Math.max(0, MONKEY_MAX_CHANCES - finalAttempts);

    // ✅ FIX: use randomBytes (NOT crypto.randomBytes)
    const sessionId = randomBytes(12).toString('hex');

    updated.monkeyActiveSession = {
      sessionId,
      status: 'active',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + MONKEY_SESSION_TTL_MS),
    };

    // Lock if reached max chances
    if (finalAttempts >= MONKEY_MAX_CHANCES) {
      updated.monkeyLocked = true;
    }

    await updated.save();

    return res.json({
      allowed: true,
      chancesLeft,
      maxChances: MONKEY_MAX_CHANCES,
      locked: !!updated.monkeyLocked,
      sessionId,
      resumed: false,
    });
  } catch (err) {
    console.error('monkeyAttempt error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ===============================
// POST /api/spin/monkey-complete
// ===============================
exports.monkeyComplete = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    const user = await User.findById(userId).select('monkeyActiveSession');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.monkeyActiveSession?.sessionId !== sessionId) {
      return res.status(400).json({ message: 'Invalid sessionId' });
    }

    user.monkeyActiveSession.status = 'completed';
    user.monkeyActiveSession.expiresAt = null;
    user.monkeyActiveSession.startedAt = null;
    user.monkeyActiveSession.sessionId = null;

    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('monkeyComplete error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ===============================
// GET /api/spin/my-latest-win
// ===============================
exports.getMyLatestWin = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authorized' });

    const spin = await Spin.findOne({ userId, status: 'won' })
      .sort({ createdAt: -1 })
      .populate('wheelItemId', 'title description imageUrl')
      .select('status qrToken qrExpiry redemptionStatus spunAt createdAt');

    if (!spin) {
      return res.json({ hasWin: false });
    }

    const qrDataUrl = spin.qrToken ? await generateQrDataUrl(spin.qrToken) : null;

    return res.json({
      hasWin: true,
      win: {
        id: spin._id,
        prize: spin.wheelItemId
          ? {
              title: spin.wheelItemId.title,
              description: spin.wheelItemId.description,
              imageUrl: spin.wheelItemId.imageUrl,
            }
          : null,
        redemptionStatus: spin.redemptionStatus,
        spunAt: spin.spunAt || spin.createdAt,
        qrToken: spin.qrToken,
        qrExpiry: spin.qrExpiry,
        qrDataUrl,
      },
    });
  } catch (err) {
    console.error('getMyLatestWin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ===============================
// GET /api/spin/wheel
// ===============================
exports.getWheelConfig = async (req, res, next) => {
  try {
    const items = await WheelItem.find({ isActive: true }).sort('createdAt');
    res.json(items);
  } catch (err) {
    next(err);
  }
};

// ===============================
// POST /api/spin/spin
// ===============================
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
