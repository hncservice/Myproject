
'use strict';

const assert = require('node:assert/strict');

const {
  assessPrizeRisk,
  ASSESSMENT_VERSION,
} = require('../features/fraud-monitoring/services/prizeFraudAssessmentService');

const {
  GAMES,
} = require('../config/gameConfig');

function main() {
  let passed = 0;
  const now = Date.now();

  function session(overrides = {}) {
    const points = [100, 70, 100, 70, 100];

    const history = points.map((value, index) => {
      const offset = value === 100 ? 0 : 4;
      return {
        shot: index + 1,
        points: value,
        category: value === 100 ? 'perfect' : 'great',
        x: 50 + offset,
        y: 50,
        targetX: 50,
        targetY: 50,
        distance: offset * 5,
        timedOut: false,
        serverAt: new Date(now - 15000 + index * 3000),
      };
    });
    const events = history.map(entry => ({
      type: 'shot',
      shot: entry.shot,
      points: entry.points,
      category: entry.category,
      serverAt: entry.serverAt,
    }));

    return {
      gameId: 'perfect-shot',
      status: 'completed',
      outcome: 'qualified',
      score: 440,
      startedAt: new Date(now - 25000),
      completedAt: new Date(now - 1000),
      expiresAt: new Date(now + 95000),
      events,
      gameState: {
        phase: 'finished',
        shot: GAMES['perfect-shot'].totalShots,
        score: 440,
        hits: 5,
        perfects: 3,
        history,
      },
      ...overrides,
    };
  }

  function assertHeld(result, reason) {
    assert.equal(result.reviewRequired, true);

    assert.ok(
      result.riskReasons.includes(reason),
      `Expected risk reason: ${reason}`
    );
  }

  function test(name, callback) {
    callback();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
  }

  test('Valid Perfect Shot passes consistency checks', () => {
    const result = assessPrizeRisk(session());

    assert.equal(result.reviewRequired, false);
    assert.deepEqual(result.riskReasons, []);
    assert.equal(result.assessmentVersion, ASSESSMENT_VERSION);
  });

  test('Manipulated session score held', () => {
    const result = assessPrizeRisk(
      session({ score: 500 })
    );

    assertHeld(result, 'PERFECT_SHOT_SCORE_MISMATCH');
  });

  test('Manipulated stored gameState score held', () => {
    const game = session();
    game.gameState.score = 500;

    assertHeld(
      assessPrizeRisk(game),
      'PERFECT_SHOT_SCORE_MISMATCH'
    );
  });

  test('Missing fifth shot held', () => {
    const game = session();
    game.gameState.history.pop();

    assertHeld(
      assessPrizeRisk(game),
      'PERFECT_SHOT_INCOMPLETE'
    );
  });

  test('Invalid shot points held', () => {
    const game = session();
    game.gameState.history[0].points = 95;

    assertHeld(
      assessPrizeRisk(game),
      'PERFECT_SHOT_SCORE_MISMATCH'
    );
  });

  test('Incorrect shot sequence held', () => {
    const game = session();
    game.gameState.history[2].shot = 5;

    assertHeld(
      assessPrizeRisk(game),
      'PERFECT_SHOT_SCORE_MISMATCH'
    );
  });

  test('Unfinished game phase held', () => {
    const game = session();
    game.gameState.phase = 'ready';

    assertHeld(
      assessPrizeRisk(game),
      'PERFECT_SHOT_INCOMPLETE'
    );
  });

  test('Score below qualification held', () => {
    const game = session();

    const points = [40, 40, 40, 40, 40];

    game.gameState.history.forEach((shot, index) => {
      shot.points = points[index];
    });

    game.score = 200;
    game.gameState.score = 200;

    assertHeld(
      assessPrizeRisk(game),
      'PERFECT_SHOT_SCORE_MISMATCH'
    );
  });

  test('Session completed beyond expiry held', () => {
    const game = session({
      completedAt: new Date(now + 120000),
    });

    assertHeld(
      assessPrizeRisk(game),
      'INVALID_SESSION_TIMING'
    );
  });

  test('Development timestamp compensation held', () => {
    const game = session();

    game.gameState.history[1].debugTiming = {
      compensated: true,
    };

    assertHeld(
      assessPrizeRisk(game),
      'CLIENT_TIMESTAMP_COMPENSATION'
    );
  });

  test('Missing history held', () => {
    const game = session();
    delete game.gameState.history;

    assertHeld(
      assessPrizeRisk(game),
      'PERFECT_SHOT_INCOMPLETE'
    );
  });

  test('Missing game state held', () => {
    assertHeld(
      assessPrizeRisk(
        session({ gameState: null })
      ),
      'MISSING_GAME_STATE'
    );
  });

  console.log(
    `\nRESULT: ${passed}/12 TESTS PASSED`
  );
}

try {
  main();
} catch (error) {
  console.error('TEST FAILED:', error);
  process.exitCode = 1;
}
