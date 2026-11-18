// server/routes/vendorRoutes.js

'use strict';

const express = require('express');
const router = express.Router();

const {
  authVendor,
} = require('../../authentication/middleware/authMiddleware');

const {
  scanQr,
  getVendorDashboard,
  exportVendorRedemptions,
} = require('../controllers/vendorController');

router.post('/scan', authVendor, scanQr);

router.get(
  '/dashboard',
  authVendor,
  getVendorDashboard
);

router.get(
  '/reports/export',
  authVendor,
  exportVendorRedemptions
);

module.exports = router;
