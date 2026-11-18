'use strict';
// Test-only registration; never imported by server features, config or routes.
module.exports = function syntheticGame(overrides = {}) {
  return { id: 'synthetic-proof', version: 1, execution: 'verified-evidence', preliminaryDecisions: true,
    config: { id: 'synthetic-proof', label: 'Synthetic proof only', maxAttempts: 3, sessionTtlMs: 1000 },
    actions: ['prove'], limits: { maxEvidenceBytes: 128, maxEvents: 3 },
    handlers: {
      validateConfig: config => Object.keys(config).length === 4,
      initialize: () => ({ verified: false }),
      validateEvidence({ evidence }) {
        if (Object.keys(evidence).length !== 1 || evidence.answer !== 'synthetic-proof') throw Object.assign(new Error('Invalid synthetic evidence'), { code: 'INVALID_EVIDENCE' });
        return { answer: evidence.answer };
      },
      apply: () => ({ state: { verified: true }, completed: true }),
      verify: ({ state }) => ({ score: state.verified ? 1 : 0, qualified: state.verified }),
      present: ({ state }) => ({ verified: state.verified }),
      assessIntegrity: () => ({ assessmentVersion: 2, reviewRequired: false, riskReasons: [] }),
      assessBehavior: () => ({ behaviorVersion: 1, reviewSuggested: true, signals: ['SYNTHETIC_ADVISORY'], enforcementAllowed: false }),
    }, ...overrides };
};
