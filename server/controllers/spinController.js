// server/controllers/spinController.js
const WheelItem = require('../models/WheelItem');
const { performSpinForUser } = require('../services/spinService');

// GET /api/wheel -> public wheel config for frontend
exports.getWheelConfig = async (req, res, next) => {
  try {
    const items = await WheelItem.find({ isActive: true }).sort('createdAt');
    res.json(items);
  } catch (err) {
    next(err);
  }
};

// POST /api/spin -> user spins once
exports.spinOnce = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const result = await performSpinForUser(userId);

    return res.json({
      status: result.status,     // 'won' or 'lost'
      prize: result.prize        // prize title or null
      // you can add more fields if frontend needs them
    });
  } catch (err) {
    // Business errors from service (with err.status) -> send as is
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    // Unexpected errors -> pass to global error handler
    return next(err);
  }
};
