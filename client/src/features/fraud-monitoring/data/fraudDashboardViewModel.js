
"use strict";

import {
  createFraudDashboardPresentationAdapter,
} from "./fraudDashboardPresentationAdapter";

import {
  filterFraudDashboardSessions,
  calculateFraudDashboardMetrics,
} from "./fraudDashboardFilters";

// STEP 15R.22X
// Pure offline dashboard view model.
// No HTTP, storage, database, or prize operations.

export function createFraudDashboardViewModel({
  enabled = false,
  report = null,
  gameFilter = "all",
  reviewFilter = "all",
  search = "",
  selectedId = null,
} = {}) {
  if (enabled !== true) {
    return Object.freeze({
      mode: "disabled",
      sessions: Object.freeze([]),
      metrics: calculateFraudDashboardMetrics([]),
      selectedReport: null,
    });
  }

  if (
  selectedId !== null &&
  (
    typeof selectedId !== "string" ||
    !/^[a-f0-9]{24}$/i.test(selectedId)
  )
) {
  throw new Error("INVALID_DASHBOARD_SELECTION");
}

  const presentation =
    createFraudDashboardPresentationAdapter({
      enabled: true,
      report,
    });

  const sessions = filterFraudDashboardSessions(
    presentation.sessions,
    {
      gameFilter,
      reviewFilter,
      search,
    }
  );

  const metrics = calculateFraudDashboardMetrics(sessions);

  const selectedReport =
    sessions.find(
      (session) => session.sessionId === selectedId
    ) || null;

  return Object.freeze({
    mode: "validated-sandbox",
    sessions,
    metrics,
    selectedReport,
  });
}
