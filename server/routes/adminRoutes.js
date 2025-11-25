// server/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authAdmin } = require('../middleware/authMiddleware');
const {
  createVendor,
  listVendors,
  createWheelItem,
  listWheelItems,
  updateWheelItem,
  deleteWheelItem,
  exportReport
} = require('../controllers/adminController');

// vendor management
router.post('/vendors', authAdmin, createVendor);
router.get('/vendors', authAdmin, listVendors);

// wheel items
router.post('/wheel-items', authAdmin, createWheelItem);
router.get('/wheel-items', authAdmin, listWheelItems);
router.put('/wheel-items/:id', authAdmin, updateWheelItem);
router.delete('/wheel-items/:id', authAdmin, deleteWheelItem);

// reports
router.get('/reports/export', authAdmin, exportReport);

module.exports = router;
