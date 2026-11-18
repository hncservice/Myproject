
'use strict';

const { GAMES } = require('../../../config/gameConfig');

const ASSESSMENT_VERSION = 2;

const POINT_CATEGORY = Object.freeze({
  0: 'miss',
  40: 'hit',
  70: 'great',
  100: 'perfect',
});

function validInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function milliseconds(value) {
  if (value == null) return NaN;

  if (
    !(value instanceof Date) &&
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return NaN;
  }

  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : NaN;
}

function assessPrizeRisk(gameSession) {
  const reasons = new Set();

  function flag(code) {
    reasons.add(code);
  }

  function finish() {
    return {
      reviewRequired: reasons.size > 0,
      riskReasons: [...reasons].sort(),
      assessmentVersion: ASSESSMENT_VERSION,
    };
  }

  if (!gameSession || typeof gameSession !== 'object') {
    flag('INVALID_SESSION');
    return finish();
  }

  const gameId = gameSession.gameId;
  const config = GAMES[gameId];

  if (!config) {
    flag('UNKNOWN_GAME');
    return finish();
  }

  if (
    gameSession.status !== 'completed' ||
    gameSession.outcome !== 'qualified'
  ) {
    flag('GAME_NOT_QUALIFIED');
  }

  const startedAt = milliseconds(gameSession.startedAt);
  const completedAt = milliseconds(gameSession.completedAt);
  const expiresAt = milliseconds(gameSession.expiresAt);

  const validTimeline =
    Number.isFinite(startedAt) &&
    Number.isFinite(completedAt) &&
    Number.isFinite(expiresAt) &&
    startedAt < expiresAt &&
    completedAt >= startedAt &&
    completedAt <= expiresAt;

  if (!validTimeline) {
    flag('INVALID_SESSION_TIMING');
  }

  if (
    Number.isFinite(startedAt) &&
    Number.isFinite(completedAt) &&
    completedAt - startedAt > config.sessionTtlMs
  ) {
    flag('SESSION_DURATION_EXCEEDED');
  }

  const state = gameSession.gameState;

  if (!state || typeof state !== 'object' ||
      Array.isArray(state)) {
    flag('MISSING_GAME_STATE');
    return finish();
  }

  if (
    typeof gameSession.score !== 'number' ||
    !Number.isFinite(gameSession.score)
  ) {
    flag('INVALID_RECORDED_SCORE');
  }

  const events = gameSession.events;

  if (!Array.isArray(events)) {
    flag('MISSING_GAME_EVENTS');
    return finish();
  }

  function checkEventTime(event) {
    const eventTime = milliseconds(event?.serverAt);

    if (
      !Number.isFinite(eventTime) ||
      !validTimeline ||
      eventTime < startedAt ||
      eventTime > completedAt
    ) {
      flag('GAME_EVENT_TIMING_MISMATCH');
    }

    return eventTime;
  }

  if (gameId === 'monkey') {
    const { round, hits, misses, phase } = state;

    if (
      !validInteger(round) ||
      !validInteger(hits) ||
      !validInteger(misses) ||
      round > config.maxRounds ||
      hits + misses !== round
    ) {
      flag('MONKEY_ROUND_MISMATCH');
    }

    if (
      !validInteger(hits) ||
      gameSession.score !== hits ||
      hits < config.requiredHits
    ) {
      flag('MONKEY_SCORE_MISMATCH');
    }

    if (phase !== 'finished') {
      flag('MONKEY_NOT_FINISHED');
    }

    const taps = events.filter(
      (event) => event?.type === 'tap'
    );

    if (events.length !== taps.length) {
      flag('MONKEY_UNKNOWN_EVENT');
    }

    const seenRounds = new Set();
    let recordedHits = 0;

    for (const event of taps) {
      checkEventTime(event);

      if (
        !Number.isSafeInteger(event.round) ||
        event.round < 1 ||
        event.round > config.maxRounds ||
        (validInteger(round) && event.round > round) ||
        seenRounds.has(event.round)
      ) {
        flag('MONKEY_EVENT_MISMATCH');
      }

      seenRounds.add(event.round);

      if (typeof event.success !== 'boolean') {
        flag('MONKEY_EVENT_MISMATCH');
      }

      if (event.success === true) {
        recordedHits++;
      }
    }

    // A missed round may be caused by an expired target,
    // which does not create a tap event in the current
    // Monkey gameplay service.
    if (
      recordedHits !== hits ||
      (validInteger(round) && taps.length > round)
    ) {
      flag('MONKEY_EVENT_MISMATCH');
    }

    // The recorded tap events must be in increasing
    // round order and chronological server-time order.
    let lastRound = 0;
    let lastTime = -Infinity;

    for (const event of taps) {
      const time = milliseconds(event.serverAt);

      if (
        event.round <= lastRound ||
        (Number.isFinite(time) && time < lastTime)
      ) {
        flag('MONKEY_EVENT_SEQUENCE_MISMATCH');
      }

      lastRound = event.round;
      if (Number.isFinite(time)) lastTime = time;
    }
  }

  if (gameId === 'perfect-shot') {
    const history = state.history;

    if (!Array.isArray(history)) {
      flag('PERFECT_SHOT_INCOMPLETE');
      return finish();
    }

    if (
      history.length !== config.totalShots ||
      state.shot !== config.totalShots ||
      state.phase !== 'finished'
    ) {
      flag('PERFECT_SHOT_INCOMPLETE');
    }

    let total = 0;
    let hits = 0;
    let perfects = 0;
    let lastHistoryTime = -Infinity;

    const relevantEvents = events.filter(
      (event) =>
        event?.type === 'shot' ||
        event?.type === 'shot-timeout'
    );

    if (
      events.length !== relevantEvents.length ||
      relevantEvents.length !== history.length
    ) {
      flag('PERFECT_SHOT_EVENT_MISMATCH');
    }

    history.forEach((entry, index) => {
      const expectedShot = index + 1;

      if (
        !entry ||
        entry.shot !== expectedShot ||
        !Object.prototype.hasOwnProperty.call(
          POINT_CATEGORY,
          entry.points
        ) ||
        entry.category !== POINT_CATEGORY[entry.points]
      ) {
        flag('PERFECT_SHOT_SCORE_MISMATCH');
      }

      if (typeof entry?.points === 'number' &&
          Number.isFinite(entry.points)) {
        total += entry.points;
        if (entry.points > 0) hits++;
        if (entry.points === 100) perfects++;
      }

      if (typeof entry?.timedOut !== 'boolean') {
        flag('PERFECT_SHOT_EVENT_MISMATCH');
      }

      if (
        entry?.timedOut === true &&
        (entry.points !== 0 || entry.category !== 'miss')
      ) {
        flag('PERFECT_SHOT_TIMEOUT_MISMATCH');
      }

      const historyTime = milliseconds(entry?.serverAt);

      if (
        !Number.isFinite(historyTime) ||
        !validTimeline ||
        historyTime < startedAt ||
        historyTime > completedAt ||
        historyTime < lastHistoryTime
      ) {
        flag('PERFECT_SHOT_EVENT_TIMING_MISMATCH');
      }

      if (Number.isFinite(historyTime)) {
        lastHistoryTime = historyTime;
      }

      const event = relevantEvents[index];

      if (!event) {
        flag('PERFECT_SHOT_EVENT_MISMATCH');
      } else {
        const expectedType =
          entry.timedOut === true
            ? 'shot-timeout'
            : 'shot';

        if (
          event.type !== expectedType ||
          event.shot !== expectedShot
        ) {
          flag('PERFECT_SHOT_EVENT_MISMATCH');
        }

        if (
          event.type === 'shot' &&
          (
            event.points !== entry.points ||
            event.category !== entry.category
          )
        ) {
          flag('PERFECT_SHOT_EVENT_MISMATCH');
        }

        const eventTime = checkEventTime(event);

        if (
          Number.isFinite(eventTime) &&
          Number.isFinite(historyTime) &&
          eventTime !== historyTime
        ) {
          flag('PERFECT_SHOT_EVENT_TIMING_MISMATCH');
        }
      }

      if (
        entry?.debugTiming?.compensated === true
      ) {
        flag('CLIENT_TIMESTAMP_COMPENSATION');
      }

      // Validate score classification against saved
      // distance where a coordinate-based shot exists.
      // Target motion cannot be fully reconstructed here.
      if (entry?.timedOut === false) {
        const { x, y, targetX, targetY, distance } = entry;

        if (
          ![x, y, targetX, targetY, distance].every(
            Number.isFinite
          ) ||
          x < 0 || x > 100 ||
          y < 0 || y > 100 ||
          targetX < 0 || targetX > 100 ||
          targetY < 0 || targetY > 100 ||
          distance < 0
        ) {
          flag('PERFECT_SHOT_COORDINATE_MISMATCH');
        } else {
          const calculated = Math.hypot(
            (x - targetX) * 5,
            (y - targetY) * 5
          );

          if (Math.abs(calculated - distance) > 0.02) {
            flag('PERFECT_SHOT_COORDINATE_MISMATCH');
          }

          const expectedPoints =
            calculated <= 11 ? 100 :
            calculated <= 23 ? 70 :
            calculated <= 38 ? 40 : 0;

          if (entry.points !== expectedPoints) {
            flag('PERFECT_SHOT_SCORE_MISMATCH');
          }
        }
      }
    });

    if (
      total !== gameSession.score ||
      total !== state.score ||
      total < config.scoreToQualify
    ) {
      flag('PERFECT_SHOT_SCORE_MISMATCH');
    }

    if (
      hits !== state.hits ||
      perfects !== state.perfects
    ) {
      flag('PERFECT_SHOT_TOTAL_MISMATCH');
    }
  }

  return finish();
}

module.exports = {
  assessPrizeRisk,
  ASSESSMENT_VERSION,
};
