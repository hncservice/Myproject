import React, { useEffect, useState } from "react";
import { getLiveFraudSessions } from "../../administration/api/adminApi";
import FraudMonitoringDashboardRenderer from "./FraudMonitoringDashboardRenderer";

const PAGE_SIZE = 20;
const defaults = { gameFilter: "all", search: "", page: 1 };

function matchesReview(report, filter) {
  if (filter === "all") return true;
  if (filter === "unavailable") return !report.assessmentAvailable;
  if (!report.assessmentAvailable) return false;
  if (filter === "integrity") return report.integrity.reviewRequired;
  if (filter === "behavior") return report.behavior.reviewSuggested;
  return !report.integrity.reviewRequired && !report.behavior.reviewSuggested;
}

function countSessions(sessions) {
  const assessed = sessions.filter(report => report.assessmentAvailable);
  return {
    total: sessions.length,
    integrity: assessed.filter(report => report.integrity.reviewRequired).length,
    behavioral: assessed.filter(report => report.behavior.reviewSuggested).length,
    normal: assessed.filter(report => matchesReview(report, "normal")).length,
    unavailable: sessions.length - assessed.length,
  };
}

export default function LiveFraudMonitoringDashboard() {
  const [query, setQuery] = useState(defaults);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [reload, setReload] = useState(0);
  const [request, setRequest] = useState(null);
  const { gameFilter, search, page } = query;
  const requestKey = JSON.stringify([gameFilter, search, page, reload]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await getLiveFraudSessions({ gameId: gameFilter, q: search.trim(), page, limit: PAGE_SIZE });
        if (active) setRequest({ key: requestKey, data });
      } catch {
        if (active) setRequest({ key: requestKey, error: "Unable to load live gameplay sessions." });
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [gameFilter, search, page, requestKey]);

  const current = request?.key === requestKey ? request : null;
  const data = current?.data;
  const sessions = (data?.items ?? []).filter(report => matchesReview(report, reviewFilter));
  const selectedReport = sessions.find(report => report.sessionId === selectedId) ?? null;

  function changeQuery(patch) {
    setSelectedId(null);
    setQuery(previous => ({ ...previous, page: 1, ...patch }));
  }

  return (
    <FraudMonitoringDashboardRenderer
      sessions={sessions}
      metrics={countSessions(sessions)}
      selectedReport={selectedReport}
      gameFilter={gameFilter}
      reviewFilter={reviewFilter}
      search={search}
      onGameFilterChange={value => changeQuery({ gameFilter: value })}
      onReviewFilterChange={value => { setSelectedId(null); setReviewFilter(value); }}
      onSearchChange={value => changeQuery({ search: value })}
      onSelectSession={setSelectedId}
      onCloseDetails={() => setSelectedId(null)}
      onResetFilters={() => {
        setQuery(defaults);
        setReviewFilter("all");
        setSelectedId(null);
      }}
      dataLabel="LIVE GAMEPLAY · READ ONLY"
      footerText="Sessions are from the configured campaign. Completed sessions are assessed for display. Behavioral warnings are advisory."
      error={current?.error}
      loading={!current}
      scopeNote="Search by full session ID or campaign ID fragment. Assessment filters and counts apply to the current page."
      searchMaxLength={100}
      pagination={(
        <nav className="fraud-monitor__page-nav" aria-label="Live session pages">
          <button type="button" disabled={page <= 1 || !current} onClick={() => changeQuery({ page: page - 1 })}>
            Previous
          </button>
          {data && <span>Page {data.page} of {data.pages} · {data.total} sessions before assessment filtering</span>}
          <button type="button" disabled={!data || page >= Math.min(data.pages, 100000)} onClick={() => changeQuery({ page: page + 1 })}>
            Next
          </button>
          <button type="button" disabled={!current} onClick={() => setReload(value => value + 1)}>
            {current?.error ? "Try again" : "Refresh"}
          </button>
        </nav>
      )}
    />
  );
}
