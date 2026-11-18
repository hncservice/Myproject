
"use strict";

// =====================================================
// HNC DASHBOARD FILTERS
// STEP 15R.22W
//
// Pure, offline filtering and metrics.
// No HTTP, storage, database, or prize operations.
// =====================================================

export function filterFraudDashboardSessions(
  sessions,
  {
    gameFilter = "all",
    reviewFilter = "all",
    search = "",
  } = {}
) {
  if (!Array.isArray(sessions)) {
    throw new Error("INVALID_DASHBOARD_SESSIONS");
  }

  if (
    typeof gameFilter !== "string" ||
    typeof reviewFilter !== "string" ||
    typeof search !== "string"
  ) {
    throw new Error("INVALID_DASHBOARD_FILTER");
  }
const allowedGames = new Set([
  "all",
  "monkey",
  "perfect-shot",
]);

const allowedReviews = new Set([
  "all",
  "integrity",
  "behavior",
  "normal",
]);

if (
  !allowedGames.has(gameFilter) ||
  !allowedReviews.has(reviewFilter) ||
  search.length > 200
) {
  throw new Error("INVALID_DASHBOARD_FILTER");
}
  const query = search.trim().toLowerCase();

  return Object.freeze(
    sessions.filter((report) => {
      if (
        gameFilter !== "all" &&
        report.gameId !== gameFilter
      ) {
        return false;
      }

      if (
        reviewFilter === "integrity" &&
        !report.integrity.reviewRequired
      ) {
        return false;
      }

      if (
        reviewFilter === "behavior" &&
        !report.behavior.reviewSuggested
      ) {
        return false;
      }

      if (
        reviewFilter === "normal" &&
        (
          report.integrity.reviewRequired ||
          report.behavior.reviewSuggested
        )
      ) {
        return false;
      }

      return (
        report.sessionId.toLowerCase().includes(query) ||
        report.campaignId.toLowerCase().includes(query)
      );
    })
  );
}

export function calculateFraudDashboardMetrics(sessions) {
  if (!Array.isArray(sessions)) {
    throw new Error("INVALID_DASHBOARD_SESSIONS");
  }

  return Object.freeze({
    total: sessions.length,

    integrity: sessions.filter(
      (report) => report.integrity.reviewRequired
    ).length,

    behavioral: sessions.filter(
      (report) => report.behavior.reviewSuggested
    ).length,

    normal: sessions.filter(
      (report) =>
        !report.integrity.reviewRequired &&
        !report.behavior.reviewSuggested
    ).length,
  });
}
