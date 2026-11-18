
"use strict";

import {
  validateFraudReportResponse,
} from "./fraudReportValidator";

// STEP 15R.22U
// Pure, offline dashboard data provider.
// No fetch, no storage, no database, no side effects.

export function createFraudDashboardDataProvider({
  enabled = false,
  report = null,
} = {}) {
  if (enabled !== true) {
    return Object.freeze({
      mode: "disabled",
      sessions: Object.freeze([]),
    });
  }

  if (report === null) {
    throw new Error("DASHBOARD_REPORT_REQUIRED");
  }

  const validated = validateFraudReportResponse(report);

  // Return only the fields needed by the dashboard.
  const sessions = validated.reports.map((session) =>
    Object.freeze({
      sessionId: session.sessionId,
      campaignId: session.campaignId,
      gameId: session.gameId,
      status: session.status,
      outcome: session.outcome,
      score: session.score,
      startedAt: session.startedAt,
      completedAt: session.completedAt,

      integrity: Object.freeze({
        assessmentVersion: session.integrity.assessmentVersion,
        reviewRequired: session.integrity.reviewRequired,
        riskReasons: Object.freeze([
          ...session.integrity.riskReasons,
        ]),
      }),

      behavior: Object.freeze({
        behaviorVersion: session.behavior.behaviorVersion,
        reviewSuggested: session.behavior.reviewSuggested,
        signals: Object.freeze([
          ...session.behavior.signals,
        ]),
        enforcementAllowed: false,
      }),

      preliminaryReviewRequired:
        session.preliminaryReviewRequired,

      advisoryReviewSuggested:
        session.advisoryReviewSuggested,

      behaviorAffectsPrizeDecision: false,
      readOnly: true,
    })
  );

  return Object.freeze({
    mode: "validated-sandbox",
    sessions: Object.freeze(sessions),
  });
}
