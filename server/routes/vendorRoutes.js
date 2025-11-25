// server/routes/vendorRoutes.js
const express = require('express');
const router = express.Router();
const { authVendor } = require('../middleware/authMiddleware');
const { scanQr } = require('../controllers/vendorController');

router.post('/scan', authVendor, scanQr);

module.exports = router;
