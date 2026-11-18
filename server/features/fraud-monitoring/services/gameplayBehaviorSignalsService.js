
'use strict';

// Advisory-only behavioral signals.
//
// This module must not directly:
// - disqualify a player
// - modify a GameSession
// - change a PrizeDecision
// - create a PrizeAward
//
// Thresholds are exploratory and must be validated
// against real gameplay before enforcement.

const VERSION = 1;

const MIN_EVENTS_FOR_CADENCE = 6;
const RAPID_TAP_MS = 100;
const MIN_CONSECUTIVE_ROUND_GAP_MS = 450 + 90;
const REGULARITY_TOLERANCE_MS = 15;

function eventTime(value) {
  if (
    value == null ||
    !(
      value instanceof Date ||
      typeof value === 'string' ||
      typeof value === 'number'
    )
  ) {
    return NaN;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : NaN;
}

function analyzeGameplayBehavior(gameSession) {
  const signals = new Set();

  function flag(code) {
    signals.add(code);
  }

  function result() {
    return {
      behaviorVersion: VERSION,
      signals: [...signals].sort(),
      reviewSuggested: signals.size > 0,
      enforcementAllowed: false,
    };
  }

  if (
    !gameSession ||
    typeof gameSession !== 'object' ||
    !Array.isArray(gameSession.events)
  ) {
    flag('BEHAVIOR_DATA_UNAVAILABLE');
    return result();
  }

  // Other games require separately calibrated
  // timing and movement checks.
  if (gameSession.gameId !== 'monkey') {
    return result();
  }

  const taps = gameSession.events.filter(
    event => event?.type === 'tap'
  );

  if (taps.length < 2) {
    return result();
  }

  const times = taps.map(
    event => eventTime(event.serverAt)
  );

  if (times.some(time => !Number.isFinite(time))) {
    flag('BEHAVIOR_TIMESTAMPS_INVALID');
    return result();
  }

  const intervals = [];

  
for (let i = 1; i < times.length; i++) {
  const interval = times[i] - times[i - 1];

  if (interval < 0) {
    flag('BEHAVIOR_EVENT_ORDER_INVALID');
    return result();
  }

  // The normal Monkey gameplay flow enforces
  // a 450 ms pause followed by a minimum
  // 90 ms reaction time.
  //
  // Apply this only to consecutive rounds.
  // Keep this advisory until validated
  // against genuine persisted gameplay.
  const previousRound = taps[i - 1].round;
  const currentRound = taps[i].round;

  if (
    Number.isSafeInteger(previousRound) &&
    Number.isSafeInteger(currentRound) &&
    currentRound === previousRound + 1 &&
    interval < MIN_CONSECUTIVE_ROUND_GAP_MS
  ) {
    flag('BELOW_MINIMUM_ROUND_GAP');
  }

  intervals.push(interval);
}


  // Very short server-observed intervals
  // deserve investigation, but network batching
  // and input handling must also be considered.
  if (
    intervals.some(interval =>
      interval < RAPID_TAP_MS
    )
  ) {
    flag('UNUSUALLY_RAPID_TAPS');
  }

  // Repeated identical timing can indicate scripted
  // interaction, but may also occur in test data
  // or coarse timestamp measurements.
  if (taps.length >= MIN_EVENTS_FOR_CADENCE) {
    const average =
      intervals.reduce((a, b) => a + b, 0) /
      intervals.length;

    const largestDeviation = Math.max(
      ...intervals.map(interval =>
        Math.abs(interval - average)
      )
    );

    if (
      average > 0 &&
      largestDeviation <= REGULARITY_TOLERANCE_MS
    ) {
      flag('HIGHLY_REGULAR_TAP_CADENCE');
    }
  }

  return result();
}

module.exports = {
  analyzeGameplayBehavior,
  BEHAVIOR_VERSION: VERSION,
};
