
"use strict";

import {
  createFraudDashboardDataProvider,
} from "./fraudDashboardDataProvider";

import {
  calculateFraudDashboardMetrics,
} from "./fraudDashboardFilters";

// =====================================================
// HNC DASHBOARD PRESENTATION ADAPTER
// STEP 15R.22V
//
// Offline transformation only.
// No HTTP, database, storage, or prize operations.
// Does not modify the existing React dashboard.
// =====================================================

export function createFraudDashboardPresentationAdapter({
  enabled = false,
  report = null,
} = {}) {
  if (enabled !== true) {
    return Object.freeze({
      mode: "disabled",
      sessions: Object.freeze([]),
      metrics: calculateFraudDashboardMetrics([]),
    });
  }

  const provider = createFraudDashboardDataProvider({
    enabled: true,
    report,
  });

  const sessions = provider.sessions;

  const metrics = calculateFraudDashboardMetrics(sessions);

  return Object.freeze({
    mode: "validated-sandbox",
    sessions,
    metrics,
  });
}
