// server/routes/spinRoutes.js
const express = require('express');
const router = express.Router();
const { authUser } = require('../middleware/authMiddleware');
const { getWheelConfig, spinOnce } = require('../controllers/spinController');

router.get('/wheel', getWheelConfig);
router.post('/spin', authUser, spinOnce);

module.exports = router;
