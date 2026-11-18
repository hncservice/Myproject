
import React, { useMemo, useState } from "react";
import FraudMonitoringDashboardRenderer from "./FraudMonitoringDashboardRenderer";
import { useOfflineFraudDashboard } from "../integration/useOfflineFraudDashboard";

// =====================================================
// HNC FRAUD MONITORING DASHBOARD
// STEP 15R.22E
//
// MOCK DATA BY DEFAULT; VALIDATED OFFLINE DATA REQUIRES EXPLICIT OPT-IN
// NO API REQUESTS
// NO DATABASE CONNECTIONS
// NO PRIZE DECISION ACTIONS
// =====================================================

const MOCK_REPORTS = [
  {
    sessionId: "SANDBOX-M001",
    campaignId: "hnc-sandbox",
    gameId: "monkey",
    status: "completed",
    outcome: "qualified",
    score: 7,
    startedAt: "2026-10-22T10:00:00Z",
    completedAt: "2026-10-22T10:00:24Z",
    integrity: {
      assessmentVersion: 2,
      reviewRequired: false,
      riskReasons: [],
    },
    behavior: {
      behaviorVersion: 1,
      reviewSuggested: false,
      signals: [],
      enforcementAllowed: false,
    },
  },
  {
    sessionId: "SANDBOX-M002",
    campaignId: "hnc-sandbox",
    gameId: "monkey",
    status: "completed",
    outcome: "qualified",
    score: 7,
    startedAt: "2026-10-22T10:10:00Z",
    completedAt: "2026-10-22T10:10:21Z",
    integrity: {
      assessmentVersion: 2,
      reviewRequired: false,
      riskReasons: [],
    },
    behavior: {
      behaviorVersion: 1,
      reviewSuggested: true,
      signals: ["HIGHLY_REGULAR_TAP_CADENCE"],
      enforcementAllowed: false,
    },
  },
  {
    sessionId: "SANDBOX-M003",
    campaignId: "hnc-sandbox",
    gameId: "monkey",
    status: "completed",
    outcome: "qualified",
    score: 99,
    startedAt: "2026-10-22T10:20:00Z",
    completedAt: "2026-10-22T10:20:18Z",
    integrity: {
      assessmentVersion: 2,
      reviewRequired: true,
      riskReasons: ["MONKEY_SCORE_MISMATCH"],
    },
    behavior: {
      behaviorVersion: 1,
      reviewSuggested: false,
      signals: [],
      enforcementAllowed: false,
    },
  },
  {
    sessionId: "SANDBOX-P001",
    campaignId: "hnc-sandbox",
    gameId: "perfect-shot",
    status: "completed",
    outcome: "qualified",
    score: 380,
    startedAt: "2026-10-22T10:30:00Z",
    completedAt: "2026-10-22T10:30:14Z",
    integrity: {
      assessmentVersion: 2,
      reviewRequired: false,
      riskReasons: [],
    },
    behavior: {
      behaviorVersion: 1,
      reviewSuggested: false,
      signals: [],
      enforcementAllowed: false,
    },
  },
];

function MockFraudMonitoringDashboard() {
  const [gameFilter, setGameFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return MOCK_REPORTS.filter((report) => {
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
        (report.integrity.reviewRequired ||
          report.behavior.reviewSuggested)
      ) {
        return false;
      }

      return (
        report.sessionId.toLowerCase().includes(query) ||
        report.campaignId.toLowerCase().includes(query)
      );
    });
  }, [gameFilter, reviewFilter, search]);

  const metrics = useMemo(
    () => ({
      total: filtered.length,

      integrity: filtered.filter(
        (report) => report.integrity.reviewRequired
      ).length,

      behavioral: filtered.filter(
        (report) => report.behavior.reviewSuggested
      ).length,

      normal: filtered.filter(
        (report) =>
          !report.integrity.reviewRequired &&
          !report.behavior.reviewSuggested
      ).length,
    }),
    [filtered]
  );

  const selectedReport = filtered.find(
    (report) => report.sessionId === selectedId
  ) || null;

  const resetFilters = () => {
    setGameFilter("all");
    setReviewFilter("all");
    setSearch("");
    setSelectedId(null);
  };

  return (
    <FraudMonitoringDashboardRenderer
      sessions={filtered}
      metrics={metrics}
      selectedReport={selectedReport}
      gameFilter={gameFilter}
      reviewFilter={reviewFilter}
      search={search}
      onGameFilterChange={setGameFilter}
      onReviewFilterChange={setReviewFilter}
      onSearchChange={setSearch}
      onSelectSession={setSelectedId}
      onCloseDetails={() => setSelectedId(null)}
      onResetFilters={resetFilters}
    />
  );
}

function OfflineFraudMonitoringDashboard({ enabled = false, report = null, modeError = "" }) {
  const { view, filters, error, update, reset } = useOfflineFraudDashboard({ enabled, report });
  const validated = view.mode === "validated-sandbox";

  return (
    <FraudMonitoringDashboardRenderer
      sessions={view.sessions}
      metrics={view.metrics}
      selectedReport={view.selectedReport}
      gameFilter={filters.gameFilter}
      reviewFilter={filters.reviewFilter}
      search={filters.search}
      onGameFilterChange={gameFilter => update({ gameFilter })}
      onReviewFilterChange={reviewFilter => update({ reviewFilter })}
      onSearchChange={search => update({ search })}
      onSelectSession={selectedId => update({ selectedId })}
      onCloseDetails={() => update({ selectedId: null })}
      onResetFilters={reset}
      dataLabel={validated ? "VALIDATED SYNTHETIC OFFLINE DATA" : "OFFLINE · DISABLED"}
      footerText={validated
        ? "Validated synthetic offline data only; not live data. Behavioral warnings are advisory and cannot trigger prize rejection or allocation. No backend connection is configured."
        : "Offline dashboard disabled. No report data is displayed. No backend connection is configured."}
      error={modeError || error}
    />
  );
}

export default function FraudMonitoringDashboard({ dataMode = "mock", report = null } = {}) {
  if (dataMode === "mock") return <MockFraudMonitoringDashboard />;
  if (dataMode === "validated-offline") {
    return <OfflineFraudMonitoringDashboard key="validated-offline" enabled report={report} />;
  }
  if (dataMode === "disabled") return <OfflineFraudMonitoringDashboard key="disabled" />;
  return (
    <OfflineFraudMonitoringDashboard
      key="unknown"
      modeError="Unknown dashboard data mode. Dashboard remains disabled."
    />
  );
}
