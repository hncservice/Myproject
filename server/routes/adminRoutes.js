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
  exportReport,
  updateVendor,
  getReportStats,
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/adminController');

// vendor management
router.post('/vendors', authAdmin, createVendor);
router.get('/vendors', authAdmin, listVendors);
router.put('/vendors/:id', authAdmin, updateVendor);


router.get('/users',authAdmin, listUsers);          // READ (list + search + pagination)
router.get('/users/:id',authAdmin, getUser);        // READ (single)
router.post('/users',authAdmin, createUser);        // CREATE
router.put('/users/:id',authAdmin, updateUser);     // UPDATE
router.delete('/users/:id',authAdmin, deleteUser);  // DELETE

// wheel items
router.post('/wheel-items', authAdmin, createWheelItem);
router.get('/wheel-items', authAdmin, listWheelItems);
router.put('/wheel-items/:id', authAdmin, updateWheelItem);
router.delete('/wheel-items/:id', authAdmin, deleteWheelItem);

// reports
router.get('/reports/export', authAdmin, exportReport);
router.get('/report/stats', authAdmin, getReportStats);

module.exports = router;
