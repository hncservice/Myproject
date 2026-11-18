
'use strict';

const WheelItem = require('../../prizes/models/WheelItem');
const User = require('../../authentication/models/User');
const Spin = require('../models/Spin');

const { generateQrDataUrl } = require('../../prizes/services/qrService');
const { randomBytes } = require('crypto');

// =====================================================
// CONFIGURATION
// =====================================================

// Legacy Monkey endpoints retained for compatibility.
// New gameplay uses /api/games/monkey/* and GameSession.
const MONKEY_MAX_CHANCES = 3;
const MONKEY_SESSION_TTL_MS = 2 * 60 * 1000;

// =====================================================
// GET /api/spin/monkey-status
// Legacy endpoint - read only
// =====================================================
exports.getMonkeyStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Not authorized',
      });
    }

    const user = await User.findById(userId).select(
      'monkeyAttempts monkeyLocked hasSpun monkeyActiveSession'
    );

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    const attempts = Number(user.monkeyAttempts || 0);
    const chancesLeft = Math.max(
      0,
      MONKEY_MAX_CHANCES - attempts
    );

    const session = user.monkeyActiveSession;
    const sessionActive =
      session?.status === 'active' &&
      session?.sessionId &&
      session?.expiresAt &&
      new Date(session.expiresAt).getTime() > Date.now();

    const locked =
      Boolean(user.monkeyLocked) ||
      Boolean(user.hasSpun) ||
      chancesLeft <= 0;

    return res.json({
      chancesLeft,
      maxChances: MONKEY_MAX_CHANCES,
      locked,
      legacy: true,
      message: 'Use /api/games/status for current game attempts.',
      activeSession: sessionActive
        ? {
            sessionId: session.sessionId,
            expiresAt: session.expiresAt,
          }
        : null,
    });
  } catch (err) {
    console.error('getMonkeyStatus error:', err);

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

// =====================================================
// POST /api/spin/monkey-attempt
// Disabled: attempts must be created by GameSession API.
// =====================================================
exports.monkeyAttempt = async (req, res) => {
  return res.status(403).json({
    success: false,
    code: 'LEGACY_MONKEY_DISABLED',
    message:
      'Legacy Monkey attempts are disabled. Use /api/games/monkey/start.',
  });
};

// =====================================================
// POST /api/spin/monkey-complete
// Disabled: game completion is server-verified.
// =====================================================
exports.monkeyComplete = async (req, res) => {
  return res.status(403).json({
    success: false,
    code: 'LEGACY_MONKEY_DISABLED',
    message:
      'Legacy Monkey completion is disabled. Use the new Monkey gameplay API.',
  });
};

// =====================================================
// GET /api/spin/my-latest-win
// Existing prize lookup and QR display
// =====================================================
exports.getMyLatestWin = async (req, res) => {
  res.set('Cache-Control', 'no-store');
try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Not authorized',
      });
    }

    const spin = await Spin.findOne({
      userId,
      status: 'won',
    })
      .sort({ createdAt: -1 })
      .populate(
        'wheelItemId',
        'title description imageUrl'
      );

    if (!spin) {
      return res.json({
        hasWin: false,
      });
    }

    const qrDataUrl = spin.qrToken
      ? await generateQrDataUrl(spin.qrToken)
      : null;

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

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

// =====================================================
// GET /api/spin/wheel
// Read-only prize catalogue
// =====================================================
exports.getWheelConfig = async (req, res, next) => {
  try {
    const items = await WheelItem.find({
      isActive: true,
    }).sort({ createdAt: 1 });

    return res.json(items);
  } catch (err) {
    return next(err);
  }
};

// =====================================================
// POST /api/spin/spin
// Disabled until shared prize allocation is secured.
// =====================================================
exports.spinOnce = async (req, res) => {
  return res.status(403).json({
    success: false,
    code: 'LEGACY_SPIN_DISABLED',
    message:
      'Legacy spin is disabled. Prize allocation will be handled by the secure HNC game system.',
  });
};

