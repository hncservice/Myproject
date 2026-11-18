'use strict';

const router = require('express').Router();

const {
  authUser,
} = require('../../authentication/middleware/authMiddleware');

const game = require('../controllers/gameController');

const monkey = require(
  '../controllers/monkeyGameplayController'
);

const perfectShot = require(
  '../controllers/perfectShotGameplayController'
);

const prizeDecision = require(
  '../../prizes/controllers/prizeDecisionController'
);

// =====================================================
// AUTHENTICATION
// =====================================================
router.use((req, res, next) => {
  if (
    req.method === 'POST' &&
    /^\/perfect-shot\/shoot\/?$/i.test(req.path)
  ) {
    req.perfectShotRouteEnteredMs = Date.now();
  }

  next();
});

router.use(authUser);

// =====================================================
// CUSTOMER PRIZE ENDPOINTS
// =====================================================

// Read-only prize details and QR for this session's owner.
router.get(
  '/prize-decision/:gameSessionId/prize',
  prizeDecision.getPrize
);

// Customer draw request; allocation service remains disabled.
router.post(
  '/prize-decision/:gameSessionId/draw',
  prizeDecision.draw
);

// Read-only customer decision status.
router.get(
  '/prize-decision/:gameSessionId',
  prizeDecision.getStatus
);

// Create a preliminary decision for a completed,
// qualified session. Does not allocate a prize or generate QR.
router.post(
  '/prize-decision',
  prizeDecision.create
);

// =====================================================
// SHARED GAME ENDPOINTS
// =====================================================

router.get('/status', game.getStatus);

router.post('/:gameId/start', game.start);

router.get('/:gameId/session', game.getSession);

router.get('/:gameId/history', game.getHistory);

router.post('/:gameId/complete', game.complete);

// =====================================================
// MONKEY GAME ENDPOINTS
// =====================================================

router.post('/monkey/next', monkey.nextRound);

router.post('/monkey/hit', monkey.hit);

// =====================================================
// PERFECT SHOT ENDPOINTS
// =====================================================

router.post('/perfect-shot/next', perfectShot.nextShot);

router.post('/perfect-shot/shoot', perfectShot.shoot);

module.exports = router;