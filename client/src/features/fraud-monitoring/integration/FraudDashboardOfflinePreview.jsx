import React from "react";
import { useOfflineFraudDashboard } from "./useOfflineFraudDashboard";

// Reports are supplied by the caller; this preview never loads data itself.
export default function FraudDashboardOfflinePreview({ enabled = false, report = null }) {
  const { view, filters, error, update, reset } = useOfflineFraudDashboard({ enabled, report });
  const selected = view.selectedReport;
  return (
    <section aria-label="Offline fraud dashboard preview">
      <h1>Offline Fraud Dashboard Preview</h1>
      <p>Mode: {view.mode}</p>
      <p>Read-only advisory information. No enforcement or prize actions.</p>
      {error && <p role="alert">{error}</p>}
      <dl aria-label="Dashboard counts">
        <dt>Total sessions</dt><dd>{view.metrics.total}</dd>
        <dt>Integrity review</dt><dd>{view.metrics.integrity}</dd>
        <dt>Behavioral review</dt><dd>{view.metrics.behavioral}</dd>
        <dt>Normal sessions</dt><dd>{view.metrics.normal}</dd>
      </dl>
      <label>
        Filter game
        <select value={filters.gameFilter} onChange={event => update({ gameFilter: event.target.value })}>
          <option value="all">All games</option>
          <option value="monkey">Monkey</option>
          <option value="perfect-shot">Perfect Shot</option>
        </select>
      </label>
      <label>
        Filter review
        <select value={filters.reviewFilter} onChange={event => update({ reviewFilter: event.target.value })}>
          <option value="all">All reviews</option>
          <option value="integrity">Integrity</option>
          <option value="behavior">Behavior</option>
          <option value="normal">Normal</option>
        </select>
      </label>
      <label>
        Search sessions
        <input type="search" value={filters.search} onChange={event => update({ search: event.target.value })} />
      </label>
      <button type="button" onClick={reset}>Reset filters</button>
      {view.sessions.length === 0 && <p>No sessions.</p>}
      <ul aria-label="Sessions">
        {view.sessions.map(session => (
          <li key={session.sessionId}>
            <button type="button" onClick={() => update({ selectedId: session.sessionId })}>
              {session.sessionId}
            </button>
            <p>Game: {session.gameId === "monkey" ? "Monkey" : "Perfect Shot"}</p>
            <p>Integrity V{session.integrity.assessmentVersion}: {session.integrity.reviewRequired ? "Review required" : "No review required"}</p>
            <p>Behavioral Signals V{session.behavior.behaviorVersion}: {session.behavior.reviewSuggested ? "Review suggested" : "No review suggested"} (advisory only)</p>
          </li>
        ))}
      </ul>
      <section aria-label="Selected session details">
        <h2>Selected session</h2>
        {selected ? (
          <>
            <p>Session: {selected.sessionId}</p>
            <p>Campaign: {selected.campaignId}</p>
            <p>Game: {selected.gameId}</p>
            <p>Status: {selected.status}</p>
            <p>Outcome: {selected.outcome}</p>
            <p>Score: {selected.score}</p>
            <h3>Integrity V{selected.integrity.assessmentVersion}</h3>
            <p>{selected.integrity.reviewRequired ? "Review required" : "No review required"}</p>
            <p>Risk reasons: {selected.integrity.riskReasons.join(", ") || "None"}</p>
            <h3>Behavioral Signals V{selected.behavior.behaviorVersion}</h3>
            <p>{selected.behavior.reviewSuggested ? "Review suggested" : "No review suggested"} (advisory only)</p>
            <p>Signals: {selected.behavior.signals.join(", ") || "None"}</p>
          </>
        ) : <p>No session selected.</p>}
      </section>
    </section>
  );
}
