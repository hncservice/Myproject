'use strict';
const rules = require('./burgerRunRules');
function assessIntegrity(session) {
  const reasons = new Set(['BURGER_RUN_PILOT_REVIEW']);
  // Replay is consistency evidence, not proof of human interaction. Keep the pilot
  // on the existing review -> approve -> draw path without weakening allocation.
  try {
    const state = session?.gameState;
    const start = new Date(session?.startedAt).getTime();
    const play = new Date(state?.playStartedAt).getTime();
    const end = new Date(session?.completedAt).getTime();
    const expiry = new Date(session?.expiresAt).getTime();
    if (session.gameId !== 'burger-run' || session.status !== 'completed' || session.outcome !== 'qualified' || state.kind !== 'burger-run' || state.version !== rules.VERSION || state.phase !== 'finished') throw new Error('state');
    const result = rules.replay(state.seed, state.ticks, state.inputs);
    const summary = rules.summary(result);
    if (result.phase !== 'won' || session.score !== result.score || Object.keys(summary).some(key => summary[key] !== state.result?.[key])) reasons.add('BURGER_RUN_SCORE_MISMATCH');
    if (![start, play, end, expiry].every(Number.isFinite) || play < start || end < play || end > expiry || end - start > 120000 || end - play + 150 < state.ticks * 1000 / rules.RULES.hz) reasons.add('BURGER_RUN_TIMING_MISMATCH');
    const e = session.events;
    if (!Array.isArray(e) || e.length !== 1 || e[0].type !== 'burger-run-finish' || e[0].score !== result.score || e[0].food !== summary.food || e[0].ticks !== state.ticks || new Date(e[0].serverAt).getTime() !== end) reasons.add('BURGER_RUN_EVENT_MISMATCH');
  } catch { reasons.add('BURGER_RUN_EVIDENCE_INVALID'); }
  return { assessmentVersion: 2, reviewRequired: true, riskReasons: [...reasons].sort() };
}
function assessBehavior() {
  return { behaviorVersion: 1, reviewSuggested: true, signals: ['BURGER_RUN_BEHAVIOR_NOT_CALIBRATED'], enforcementAllowed: false };
}
module.exports = { assessIntegrity, assessBehavior };
