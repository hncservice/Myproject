// server/routes/spinRoutes.js
const express = require('express');
const router = express.Router();
const { authUser } = require('../middleware/authMiddleware');
const spinController = require('../controllers/spinController');


router.get('/__ping', (req, res) => {
  res.json({ ok: true, router: 'spinRoutes', time: new Date().toISOString() });
});

router.get('/wheel', spinController.getWheelConfig);
router.post('/spin', authUser, spinController.spinOnce);

router.get('/monkey-status', authUser, spinController.getMonkeyStatus);
router.post('/monkey-attempt', authUser, spinController.monkeyAttempt);

module.exports = router;