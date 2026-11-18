
'use strict';

const assert = require('node:assert/strict');

const {
  assessPrizeRisk,
  ASSESSMENT_VERSION,
} = require('../features/fraud-monitoring/services/prizeFraudAssessmentService');

let passed = 0;
const BASE = Date.parse('2026-10-20T10:00:00.000Z');

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

function expectClear(session) {
  const result = assessPrizeRisk(session);

  assert.equal(
    result.reviewRequired,
    false,
    JSON.stringify(result.riskReasons)
  );

  assert.deepEqual(result.riskReasons, []);
  assert.equal(result.assessmentVersion, 2);
}

function expectReview(session, reason) {
  const result = assessPrizeRisk(session);

  assert.equal(result.reviewRequired, true);

  assert.ok(
    result.riskReasons.includes(reason),
    `Expected ${reason}; got ${result.riskReasons.join(', ')}`
  );
}

function baseSession(gameId) {
  return {
    gameId,
    status: 'completed',
    outcome: 'qualified',
    startedAt: new Date(BASE),
    completedAt: new Date(BASE + 30000),
    expiresAt: new Date(BASE + 120000),
  };
}

function monkeySession() {
  const events = [];

  for (let round = 1; round <= 7; round++) {
    events.push({
      type: 'tap',
      round,
      success: true,
      serverAt: new Date(BASE + round * 3000),
    });
  }

  return {
    ...baseSession('monkey'),
    score: 7,
    gameState: {
      phase: 'finished',
      revision: 20,
      round: 9,
      hits: 7,
      misses: 2,
    },
    // Rounds 8 and 9 represent expired targets.
    // Monkey does not currently record a tap event
    // when a target expires without being tapped.
    events,
  };
}

function perfectShotSession(
  scores = [100, 70, 100, 70, 100]
) {
  const history = scores.map((points, index) => {
    const shot = index + 1;
    const timestamp = new Date(
      BASE + 5000 + index * 4000
    );

    const offset = {
      100: 0,
      70: 4,
      40: 6,
      0: 12,
    }[points];

    return {
      shot,
      points,
      category: {
        100: 'perfect',
        70: 'great',
        40: 'hit',
        0: 'miss',
      }[points],
      x: 50 + offset,
      y: 50,
      targetX: 50,
      targetY: 50,
      distance: offset * 5,
      timedOut: false,
      serverAt: timestamp,
    };
  });

  const events = history.map((entry) => ({
    type: 'shot',
    shot: entry.shot,
    points: entry.points,
    category: entry.category,
    serverAt: entry.serverAt,
  }));

  return {
    ...baseSession('perfect-shot'),
    score: scores.reduce((sum, value) => sum + value, 0),
    gameState: {
      phase: 'finished',
      revision: 12,
      shot: 5,
      score: scores.reduce(
        (sum, value) => sum + value,
        0
      ),
      hits: scores.filter(value => value > 0).length,
      perfects: scores.filter(value => value === 100).length,
      history,
    },
    events,
  };
}

function main() {
  test('Assessment version is 2', () => {
    assert.equal(ASSESSMENT_VERSION, 2);
  });

  test('Valid Monkey gameplay passes', () => {
    expectClear(monkeySession());
  });

  test('Monkey expired rounds are accepted', () => {
    const game = monkeySession();

    assert.equal(game.gameState.misses, 2);
    assert.equal(game.events.length, 7);

    expectClear(game);
  });

  test('Manipulated Monkey score held', () => {
    const game = monkeySession();
    game.score = 12;

    expectReview(game, 'MONKEY_SCORE_MISMATCH');
  });

  test('Duplicate Monkey tap event held', () => {
    const game = monkeySession();
    game.events.push({ ...game.events[0] });

    expectReview(game, 'MONKEY_EVENT_MISMATCH');
  });

  test('Missing Monkey hit event held', () => {
    const game = monkeySession();
    game.events.pop();

    expectReview(game, 'MONKEY_EVENT_MISMATCH');
  });

  test('Valid Perfect Shot passes', () => {
    expectClear(perfectShotSession());
  });

  test('Manipulated Perfect Shot total held', () => {
    const game = perfectShotSession();
    game.score = 500;

    expectReview(game, 'PERFECT_SHOT_SCORE_MISMATCH');
  });

  test('Manipulated coordinates held', () => {
    const game = perfectShotSession();
    game.gameState.history[0].x = 90;

    expectReview(
      game,
      'PERFECT_SHOT_COORDINATE_MISMATCH'
    );
  });

  test('Manipulated shot event points held', () => {
    const game = perfectShotSession();
    game.events[1].points = 100;

    expectReview(game, 'PERFECT_SHOT_EVENT_MISMATCH');
  });

  test('Duplicate shot event held', () => {
    const game = perfectShotSession();
    game.events.push({ ...game.events[0] });

    expectReview(game, 'PERFECT_SHOT_EVENT_MISMATCH');
  });

  test('Missing shot event held', () => {
    const game = perfectShotSession();
    game.events.pop();

    expectReview(game, 'PERFECT_SHOT_EVENT_MISMATCH');
  });

  test('Legitimate timed-out shot accepted', () => {
    const game = perfectShotSession([
      100, 100, 100, 100, 0,
    ]);

    const last = game.gameState.history[4];

    last.points = 0;
    last.category = 'miss';
    last.timedOut = true;

    delete last.x;
    delete last.y;
    delete last.targetX;
    delete last.targetY;
    delete last.distance;

    game.events[4] = {
      type: 'shot-timeout',
      shot: 5,
      serverAt: last.serverAt,
    };

    expectClear(game);
  });

  test('Manipulated timed-out score held', () => {
    const game = perfectShotSession();

    game.gameState.history[0].timedOut = true;

    expectReview(
      game,
      'PERFECT_SHOT_TIMEOUT_MISMATCH'
    );
  });

  test('Shot event timestamp mismatch held', () => {
    const game = perfectShotSession();

    game.events[2].serverAt = new Date(
      BASE + 29000
    );

    expectReview(
      game,
      'PERFECT_SHOT_EVENT_TIMING_MISMATCH'
    );
  });

  test('Development compensation held', () => {
    const game = perfectShotSession();

    game.gameState.history[0].debugTiming = {
      compensated: true,
    };

    expectReview(
      game,
      'CLIENT_TIMESTAMP_COMPENSATION'
    );
  });

  test('Missing game events held', () => {
    const game = perfectShotSession();

    game.events = null;

    expectReview(game, 'MISSING_GAME_EVENTS');
  });

  test('Expired session result held', () => {
    const game = perfectShotSession();

    game.completedAt = new Date(
      BASE + 130000
    );

    expectReview(game, 'INVALID_SESSION_TIMING');
  });

  console.log(
    `\nRESULT: ${passed}/18 TESTS PASSED`
  );
}

try {
  main();
} catch (error) {
  console.error('\nTEST FAILED:', error);
  process.exitCode = 1;
}
