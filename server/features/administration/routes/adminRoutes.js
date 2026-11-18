
'use strict';

const express = require('express');
const router = express.Router();
const fraudMonitoring = require('../controllers/adminFraudMonitoringController');

const {
  authAdmin,
} = require('../../authentication/middleware/authMiddleware');

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
  deleteUser,
} = require('../controllers/adminController');

const {
  listPrizeReviews,
  getPrizeReview,
  approvePrizeReview,
  rejectPrizeReview,
} = require('../../prizes/controllers/prizeReviewController');

// =====================================================
// GLOBAL ADMIN AUTHENTICATION
// =====================================================

// All routes below require a verified administrator JWT,
// an active administrator account and a current token
// version.

router.use(authAdmin);
router.get('/fraud-monitoring/sessions', fraudMonitoring.list);
// =====================================================
// VENDOR MANAGEMENT
// =====================================================

router.post('/vendors', createVendor);
router.get('/vendors', listVendors);
router.put('/vendors/:id', updateVendor);

// =====================================================
// USER MANAGEMENT
// =====================================================

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// =====================================================
// WHEEL ITEM MANAGEMENT
// =====================================================

router.post('/wheel-items', createWheelItem);
router.get('/wheel-items', listWheelItems);
router.put('/wheel-items/:id', updateWheelItem);
router.delete('/wheel-items/:id', deleteWheelItem);

// =====================================================
// PRIZE REVIEW MANAGEMENT
// =====================================================

// Read-only pending review queue and evidence.
router.get('/prize-reviews', listPrizeReviews);
router.get('/prize-reviews/:id', getPrizeReview);

// Transactional administrator review actions.
// These do not allocate prizes or generate QR codes.
router.post(
  '/prize-reviews/:id/approve',
  approvePrizeReview
);

router.post(
  '/prize-reviews/:id/reject',
  rejectPrizeReview
);

// =====================================================
// REPORTS
// =====================================================

router.get('/reports/export', exportReport);
router.get('/report/stats', getReportStats);

// Read-only operations; global authAdmin above protects every endpoint.
const operations = require('../controllers/adminOperationsController');
router.get('/configuration', operations.configuration);
router.get('/sessions', operations.sessions);
router.get('/redemptions', operations.redemptions);
router.get('/audit-logs', operations.audit);

// Versioned administrative definitions only; participation has a hardcoded off gate.
const campaigns = require('../../campaigns/controllers/campaignAdministrationController');
router.get('/campaigns', campaigns.list);
router.post('/campaigns', campaigns.create);
router.put('/campaigns/:campaignId', campaigns.update);
router.get('/campaigns/:campaignId/activity', campaigns.activity);

module.exports = router;
