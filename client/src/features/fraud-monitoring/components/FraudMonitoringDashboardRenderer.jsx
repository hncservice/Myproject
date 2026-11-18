import React, { useId, useLayoutEffect, useRef } from "react";

const formatCode = (value) => String(value).replaceAll("_", " ").toLowerCase();

const qatarDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Qatar",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function SessionTime({ value }) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return <time dateTime={date.toISOString()}>{qatarDate.format(date)}</time>;
}

function gameName(gameId) {
  if (gameId === "monkey") return "Whack the Monkey";
  if (gameId === "perfect-shot") return "Perfect Shot";
  return gameId;
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className="fraud-monitor__badge" data-tone={tone}>{children}</span>;
}

function Metric({ title, value, tone }) {
  return (
    <div className="fraud-monitor__metric" data-tone={tone}>
      <dt>{title}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Findings({ entries, flagged, advisory = false, detailed = false }) {
  if (!Array.isArray(entries) || typeof flagged !== "boolean") {
    return <StatusPill>Assessment unavailable</StatusPill>;
  }
  const label = advisory
    ? (flagged ? "Advisory Warning" : "No Warning")
    : (flagged ? "Review Required" : "No Integrity Warning");

  return (
    <div className="fraud-monitor__findings">
      <StatusPill tone={flagged ? (advisory ? "warning" : "danger") : "success"}>{label}</StatusPill>
      {entries.length > 0 ? (
        <ul>
          {entries.map((entry, index) => <li key={index}>{formatCode(entry)}</li>)}
        </ul>
      ) : detailed ? (
        <p>{advisory ? "No behavioral warnings reported." : "No integrity issues reported."}</p>
      ) : null}
    </div>
  );
}

function DetailItem({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function SessionDetails({ report, onClose, id, headingRef }) {
  return (
    <section id={id} className="fraud-monitor__panel fraud-monitor__details" aria-label="Session details">
      <header className="fraud-monitor__panel-head">
        <div>
          <h2 ref={headingRef} tabIndex={-1}>Session Details</h2>
          <p className="fraud-monitor__muted">Session times are shown in Qatar time.</p>
        </div>
        <button type="button" onClick={onClose}>Close Details</button>
      </header>

      <dl className="fraud-monitor__metadata">
        <DetailItem label="Session ID"><code>{report.sessionId}</code></DetailItem>
        <DetailItem label="Campaign">{report.campaignId}</DetailItem>
        <DetailItem label="Game">{gameName(report.gameId)}</DetailItem>
        <DetailItem label="Score">{report.score ?? "—"}</DetailItem>
        <DetailItem label="Status">{report.status}</DetailItem>
        <DetailItem label="Outcome">{report.outcome}</DetailItem>
        <DetailItem label="Started"><SessionTime value={report.startedAt} /></DetailItem>
        <DetailItem label="Completed"><SessionTime value={report.completedAt} /></DetailItem>
      </dl>

      <div className="fraud-monitor__assessments">
        <section>
          <h3>Integrity Assessment V2</h3>
          <Findings entries={report.integrity?.riskReasons} flagged={report.integrity?.reviewRequired} detailed />
        </section>
        <section>
          <h3>Behavioral Assessment V1</h3>
          <Findings entries={report.behavior?.signals} flagged={report.behavior?.reviewSuggested} advisory detailed />
          <p className="fraud-monitor__muted">Advisory signals cannot trigger prize rejection or allocation.</p>
        </section>
      </div>
    </section>
  );
}

export default function FraudMonitoringDashboardRenderer({
  sessions,
  metrics,
  selectedReport,
  gameFilter,
  reviewFilter,
  search,
  onGameFilterChange,
  onReviewFilterChange,
  onSearchChange,
  onSelectSession,
  onCloseDetails,
  onResetFilters,
  dataLabel = "SANDBOX · MOCK DATA",
  footerText = "Mock data only. Behavioral warnings are advisory and cannot trigger prize rejection or allocation. No backend connection is configured.",
  error = "",
  loading = false,
  scopeNote,
  searchMaxLength,
  pagination,
}) {
  const detailsId = useId();
  const headingRef = useRef(null);
  const opener = useRef(null);
  const selectedId = selectedReport?.sessionId;

  useLayoutEffect(() => {
    if (selectedId) headingRef.current?.focus();
  }, [selectedId]);

  function closeDetails() {
    onCloseDetails();
    if (opener.current?.isConnected) opener.current.focus();
    opener.current = null;
  }

  return (
    <main className="fraud-monitor">
      <style>{pageStyles}</style>
      <div className="fraud-monitor__shell">
        <header className="fraud-monitor__heading">
          <h1>Fraud Monitoring</h1>
          <StatusPill tone="warning">{dataLabel}</StatusPill>
        </header>

        {error && <p className="fraud-monitor__error" role="alert">{error}</p>}
        <p className="fraud-monitor__note">
          <strong>Read-only monitoring.</strong> Behavioral warnings are advisory.
        </p>

        <dl className="fraud-monitor__metrics" aria-label="Metrics for matching sessions">
          <Metric title="Sessions Analyzed" value={metrics.total} tone="neutral" />
          <Metric title="Integrity Reviews" value={metrics.integrity} tone="danger" />
          <Metric title="Behavioral Warnings" value={metrics.behavioral} tone="warning" />
          <Metric title="Normal Sessions" value={metrics.normal} tone="success" />
          {metrics.unavailable !== undefined && (
            <Metric title="Assessment Unavailable" value={metrics.unavailable} tone="neutral" />
          )}
        </dl>

        <section className="fraud-monitor__panel" aria-label="Gameplay fraud reports">
          <header className="fraud-monitor__panel-head">
            <div>
              <h2>Gameplay Fraud Reports</h2>
              <p className="fraud-monitor__muted" role="status">
                {loading ? "Loading sessions…" : error ? "Session list unavailable" : (
                  <>{sessions.length} matching {sessions.length === 1 ? "session" : "sessions"}</>
                )}
              </p>
            </div>
            <button type="button" onClick={onResetFilters}>Reset Filters</button>
          </header>

          {scopeNote && <p className="fraud-monitor__muted">{scopeNote}</p>}
          <div className="fraud-monitor__filters">
            <label>
              Session or campaign
              <input type="search" aria-label="Search session or campaign"
                placeholder="Search session or campaign" value={search} maxLength={searchMaxLength}
                onChange={(event) => onSearchChange(event.target.value)} />
            </label>
            <label>
              Game
              <select aria-label="Filter game" value={gameFilter}
                onChange={(event) => onGameFilterChange(event.target.value)}>
                <option value="all">All Games</option>
                <option value="monkey">Monkey</option>
                <option value="perfect-shot">Perfect Shot</option>
              </select>
            </label>
            <label>
              Review status
              <select aria-label="Filter review status" value={reviewFilter}
                onChange={(event) => onReviewFilterChange(event.target.value)}>
                <option value="all">All Sessions</option>
                <option value="integrity">Integrity Reviews</option>
                <option value="behavior">Behavioral Warnings</option>
                <option value="normal">Normal Sessions</option>
                {metrics.unavailable !== undefined && <option value="unavailable">Assessment Unavailable</option>}
              </select>
            </label>
          </div>

          {sessions.length > 0 ? (
            <table className="fraud-monitor__table" role="table" aria-label="Matching gameplay sessions">
              <thead role="rowgroup">
                <tr role="row">
                  {["Session", "Game", "Outcome", "Integrity", "Behavior", "Details"].map((label) => (
                    <th key={label} scope="col" role="columnheader">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {sessions.map((report) => {
                  const selected = selectedId === report.sessionId;

                  return (
                    <tr key={report.sessionId} role="row" data-selected={selected}>
                      <td role="cell">
                        <span className="fraud-monitor__mobile-label" aria-hidden="true">Session</span>
                        <strong><code>{report.sessionId}</code></strong>
                      </td>
                      <td role="cell">
                        <span className="fraud-monitor__mobile-label" aria-hidden="true">Game</span>
                        <span>{gameName(report.gameId)}</span>
                      </td>
                      <td role="cell">
                        <span className="fraud-monitor__mobile-label" aria-hidden="true">Outcome</span>
                        <div><StatusPill>{report.outcome}</StatusPill></div>
                      </td>
                      <td role="cell">
                        <span className="fraud-monitor__mobile-label" aria-hidden="true">Integrity</span>
                        <Findings entries={report.integrity?.riskReasons} flagged={report.integrity?.reviewRequired} />
                      </td>
                      <td role="cell">
                        <span className="fraud-monitor__mobile-label" aria-hidden="true">Behavior</span>
                        <Findings entries={report.behavior?.signals} flagged={report.behavior?.reviewSuggested} advisory />
                      </td>
                      <td role="cell">
                        <span className="fraud-monitor__mobile-label" aria-hidden="true">Details</span>
                        <div>
                          <button type="button" aria-label={"View Details for " + report.sessionId}
                            aria-expanded={selected} aria-controls={selected ? detailsId : undefined}
                            onClick={(event) => {
                              opener.current = event.currentTarget;
                              onSelectSession(report.sessionId);
                              if (selected) headingRef.current?.focus();
                            }}>
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : !loading && !error ? <p className="fraud-monitor__empty">No matching sessions</p> : null}
          {pagination}
        </section>

        {selectedReport && (
          <SessionDetails report={selectedReport} onClose={closeDetails} id={detailsId} headingRef={headingRef} />
        )}

        <footer className="fraud-monitor__muted fraud-monitor__footer">{footerText}</footer>
      </div>
    </main>
  );
}

const pageStyles = `
  .fraud-monitor {
    --fraud-border: #75404e;
    --fraud-muted: #dcc8d0;
    --fraud-panel: #23131d;
    --fraud-card: #301b28;
    min-height: 100vh;
    min-height: 100dvh;
    padding: clamp(12px, 3vw, 36px);
    background: #170e15;
    color: #fff7f6;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow-wrap: anywhere;
  }

  .fraud-monitor, .fraud-monitor * { box-sizing: border-box; }
  .fraud-monitor__shell { max-width: 1360px; margin-inline: auto; }
  .fraud-monitor__heading, .fraud-monitor__panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    margin-bottom: 14px;
  }
  .fraud-monitor h1 { margin: 0; font-size: clamp(27px, 4vw, 42px); font-weight: 800; }
  .fraud-monitor h2 { margin: 0 0 4px; font-size: clamp(18px, 2.5vw, 25px); font-weight: 750; scroll-margin-top: 92px; }
  .fraud-monitor h3 { margin: 0 0 8px; font-size: 16px; font-weight: 750; }
  .fraud-monitor__muted { color: var(--fraud-muted); font-size: 14px; line-height: 1.5; }
  .fraud-monitor__panel-head p { margin: 0; }
  .fraud-monitor code { color: #ffc5d1; font-family: ui-monospace, Consolas, monospace; }
  .fraud-monitor__note, .fraud-monitor__error {
    margin: 0 0 14px;
    padding: 10px 12px;
    border: 1px solid var(--fraud-border);
    border-radius: 9px;
    background: #38232f;
    color: #ffe7bf;
    font-size: 14px;
  }
  .fraud-monitor__error { background: #481825; color: #ffe1e5; }

  .fraud-monitor__metrics, .fraud-monitor__metadata { display: grid; gap: 8px 12px; }
  .fraud-monitor__metrics { grid-template-columns: repeat(auto-fit, minmax(min(100%, 155px), 1fr)); margin: 0 0 14px; }
  .fraud-monitor__page-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
  .fraud-monitor__page-nav button:disabled { opacity: 0.55; cursor: default; }
  .fraud-monitor__metric, .fraud-monitor__panel, .fraud-monitor__assessments > section {
    min-width: 0;
    padding: clamp(12px, 2.2vw, 20px);
    border: 1px solid var(--fraud-border);
    border-radius: 12px;
    background: var(--fraud-panel);
  }
  .fraud-monitor__metric { border-top-width: 3px; }
  .fraud-monitor__metric[data-tone="danger"] { border-top-color: #dc8395; }
  .fraud-monitor__metric[data-tone="warning"] { border-top-color: #d6a467; }
  .fraud-monitor__metric[data-tone="success"] { border-top-color: #73a98d; }
  .fraud-monitor__metric dt, .fraud-monitor__metadata dt { color: var(--fraud-muted); font-size: 13px; }
  .fraud-monitor__metric dd { margin: 2px 0 0; font-size: clamp(23px, 3vw, 32px); font-weight: 750; }

  .fraud-monitor__filters {
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 9px 12px;
    margin-bottom: 14px;
  }
  .fraud-monitor__filters label { display: grid; gap: 5px; min-width: 0; font-size: 14px; font-weight: 650; }
  .fraud-monitor :is(input, select, button) {
    min-height: 44px;
    padding: 7px 11px;
    border: 1px solid #a47082;
    border-radius: 8px;
    background: #39202e;
    color: #fff7f6;
    font: inherit;
  }
  .fraud-monitor :is(input, select) { width: 100%; min-width: 0; font-size: 16px; }
  .fraud-monitor input::placeholder { color: var(--fraud-muted); }
  .fraud-monitor button { cursor: pointer; }
  .fraud-monitor button:hover { background: #53283e; }
  .fraud-monitor :is(input, select, button, h2):focus-visible { outline: 2px solid #ffc5cb; outline-offset: 2px; }

  .fraud-monitor__table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .fraud-monitor__table :is(th, td) { padding: 10px; border-bottom: 1px solid #593240; text-align: start; vertical-align: top; }
  .fraud-monitor__table th { background: #39202e; color: #f5d9e2; }
  .fraud-monitor__table tr[data-selected="true"] td { background: #39202e; }
  .fraud-monitor__mobile-label { display: none; }
  .fraud-monitor__badge {
    display: inline-block;
    padding: 4px 8px;
    border: 1px solid #a47082;
    border-radius: 999px;
    background: #39202e;
    color: #f5dce6;
    font-size: 12px;
    font-weight: 700;
  }
  .fraud-monitor__badge[data-tone="danger"] { border-color: #c76b7e; background: #481825; color: #ffe1e5; }
  .fraud-monitor__badge[data-tone="warning"] { border-color: #c1985d; background: #462b25; color: #ffe7bf; }
  .fraud-monitor__badge[data-tone="success"] { border-color: #559775; background: #17372b; color: #cff5df; }
  .fraud-monitor__findings ul { margin: 5px 0 0; padding-inline-start: 16px; color: var(--fraud-muted); font-size: 13px; }
  .fraud-monitor__findings p, .fraud-monitor__assessments p { margin: 8px 0 0; }
  .fraud-monitor__empty { margin: 0; padding: 16px 0; color: var(--fraud-muted); }

  .fraud-monitor__details { margin-top: 14px; }
  .fraud-monitor__metadata { grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); margin: 0 0 14px; }
  .fraud-monitor__metadata dd { margin: 3px 0 0; font-size: 14px; }
  .fraud-monitor__assessments { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 10px; }
  .fraud-monitor__assessments > section { background: var(--fraud-card); }
  .fraud-monitor__footer { margin-top: 16px; }

  @media (max-width: 780px) {
    .fraud-monitor__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .fraud-monitor__filters { grid-template-columns: minmax(0, 1fr); }
    .fraud-monitor__table, .fraud-monitor__table tbody { display: block; }
    .fraud-monitor__table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .fraud-monitor__table tbody tr {
      display: grid;
      gap: 8px;
      margin-bottom: 8px;
      padding: 10px;
      border: 1px solid var(--fraud-border);
      border-radius: 9px;
      background: var(--fraud-card);
    }
    .fraud-monitor__table tr[data-selected="true"] { border-color: #f09bb0; }
    .fraud-monitor__table tr[data-selected="true"] td { background: transparent; }
    .fraud-monitor__table td {
      display: grid;
      grid-template-columns: minmax(0, 4.5rem) minmax(0, 1fr);
      gap: 8px;
      padding: 0;
      border: 0;
    }
    .fraud-monitor__mobile-label { display: block; color: var(--fraud-muted); font-size: 12px; font-weight: 650; }
  }
`;
