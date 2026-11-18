import React, { useEffect, useState } from 'react';
import { getAdminOperations } from '../api/adminApi';
import { reportCsv } from '../reportCsv';

const REPORTS = {
  sessions: 'Gameplay sessions',
  redemptions: 'Redemptions',
  'audit-logs': 'Audit logs',
  configuration: 'Configuration',
};

const defaultParams = () => ({ page: 1, limit: 20, q: '', sort: 'newest' });

const leadingColumns = {
  sessions: ['gameId', 'status', 'outcome', 'score', 'startedAt', 'completedAt'],
  redemptions: ['prizeTitle', 'prize', 'vendorName', 'vendor', 'status', 'redemptionStatus', 'redeemedAt'],
  'audit-logs': ['action', 'resource', 'entityType', 'createdAt', 'adminId'],
};

function reportColumns(resource, rows) {
  const columns = new Set(rows.flatMap(row => Object.keys(row)));
  const first = (leadingColumns[resource] ?? []).filter(column => columns.delete(column));
  return [...first, ...columns];
}

function columnLabel(key) {
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\bid\b/gi, 'ID');
  return label ? label[0].toUpperCase() + label.slice(1) : key;
}

function displayCell(value) {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Results({ resource, params, onPageChange, onRetry }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    let active = true;
    getAdminOperations(resource, resource === 'configuration' ? undefined : params)
      .then(response => { if (active) setResult(response.data); })
      .catch(() => { if (active) setError('Unable to load administrative report.'); });
    return () => { active = false; };
  }, [resource, params]);

  const rows = result?.items ?? [];

  function download() {
    if (!rows.length) return;
    setExportError('');
    let url;
    try {
      const csv = reportCsv(rows);
      url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));

      const link = document.createElement('a');
      link.href = url;
      link.download = resource + '-page.csv';
      link.click();
    } catch {
      setExportError('Unable to export this report page.');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  if (error) {
    return (
      <section className="admin-ops__panel">
        <p className="admin-ops__alert" role="alert">{error}</p>
        <div className="admin-ops__actions">
          {resource !== 'configuration' && params.page > 1 && (
            <button type="button" onClick={() => onPageChange(params.page - 1)}>Previous</button>
          )}
          <button type="button" onClick={onRetry}>Try again</button>
        </div>
      </section>
    );
  }

  if (!result) return <p className="admin-ops__panel" role="status">Loading…</p>;

  if (resource === 'configuration') {
    return (
      <section className="admin-ops__panel" aria-labelledby="admin-ops-config-title">
        <h2 id="admin-ops-config-title">Source-managed configuration</h2>
        <p className="admin-ops__muted">Read only. Changes require a reviewed configuration release.</p>
        <pre className="admin-ops__config" tabIndex={0} aria-label="Configuration JSON">
          {JSON.stringify(result, null, 2)}
        </pre>
      </section>
    );
  }

  const columns = reportColumns(resource, rows);
  const pages = result.pages;
  const canGoNext = Number.isSafeInteger(pages) && params.page < Math.min(pages, 100000);

  return (
    <section className="admin-ops__panel" aria-label="Report results">
      <div className="admin-ops__results-heading">
        <div>
          <h2 id="admin-ops-results-title">{REPORTS[resource]}</h2>
          <p className="admin-ops__muted">
            {result.total} {result.total === 1 ? 'record' : 'records'}
            {pages > 0 ? ' · Page ' + result.page + ' of ' + pages : ''}
          </p>
        </div>
        <button type="button" className="admin-ops__primary" disabled={!rows.length} onClick={download}>
          Export page CSV
        </button>
      </div>

      {exportError && <p className="admin-ops__alert" role="alert">{exportError}</p>}

      {rows.length === 0 ? <p>No records found.</p> : (
        <div className="admin-ops__table-wrap" role="region" aria-labelledby="admin-ops-results-title" tabIndex={0}>
          <table className="admin-ops__table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                {columns.map(key => <th key={key} role="columnheader" scope="col">{columnLabel(key)}</th>)}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {rows.map((row, index) => (
                <tr key={row.id ?? row._id ?? index} role="row">
                  {columns.map(key => (
                    <td key={key} role="cell">
                      <span className="admin-ops__mobile-label" aria-hidden="true">{columnLabel(key)}</span>
                      <span>{displayCell(row[key])}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="admin-ops__actions admin-ops__pagination" aria-label="Report pages">
        <button type="button" disabled={params.page === 1} onClick={() => onPageChange(params.page - 1)}>
          Previous
        </button>
        <button type="button" disabled={!canGoNext} onClick={() => onPageChange(params.page + 1)}>
          Next
        </button>
      </nav>
      <p className="admin-ops__muted admin-ops__export-note">Use Reports for bounded Excel exports of redemption history.</p>
    </section>
  );
}

export default function AdminOperationsPage() {
  const [resource, setResource] = useState('sessions');
  const [params, setParams] = useState(defaultParams);
  const [refresh, setRefresh] = useState(0);

  const change = patch => setParams(previous => ({ ...previous, page: 1, ...patch }));

  function changeReport(event) {
    setResource(event.target.value);
    setParams(defaultParams());
  }

  return (
    <main className="admin-ops">
      <style>{pageStyles}</style>
      <header className="admin-ops__heading">
        <h1>Administrative operations</h1>
      </header>
      <section className="admin-ops__panel admin-ops__filters" aria-label="Report filters">
        <label>
          Report
          <select value={resource} onChange={changeReport}>
            {Object.entries(REPORTS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {resource !== 'configuration' && (
          <>
            <label>
              Search
              <input type="search" value={params.q} maxLength={100}
                onChange={event => change({ q: event.target.value })} />
            </label>
            <label>
              Sort
              <select value={params.sort} onChange={event => change({ sort: event.target.value })}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
          </>
        )}
      </section>

      <Results
        key={resource + ':' + refresh + (resource === 'configuration' ? '' : ':' + JSON.stringify(params))}
        resource={resource}
        params={params}
        onPageChange={page => change({ page })}
        onRetry={() => setRefresh(current => current + 1)}
      />
    </main>
  );
}

const pageStyles = `
  .admin-ops {
    --ops-text: #fff7f6;
    --ops-muted: #dcc8d0;
    --ops-border: #75404e;
    width: min(100%, 1260px);
    margin-inline: auto;
    padding-block: clamp(16px, 3vw, 36px);
    color: var(--ops-text);
    overflow-wrap: anywhere;
  }

  .admin-ops__heading { margin-bottom: 16px; }
  .admin-ops h1 { margin: 0; font-size: clamp(27px, 4vw, 40px); font-weight: 800; }
  .admin-ops h2 { margin: 0 0 6px; font-size: clamp(19px, 2.8vw, 25px); font-weight: 750; }
  .admin-ops__panel {
    min-width: 0;
    margin: 0 0 14px;
    padding: clamp(14px, 2.5vw, 22px);
    border: 1px solid var(--ops-border);
    border-radius: 14px;
    background: #23131d;
  }
  .admin-ops__filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr) minmax(0, 0.7fr);
    gap: 10px 14px;
  }
  .admin-ops__filters label { display: grid; gap: 6px; min-width: 0; font-size: 14px; font-weight: 650; }
  .admin-ops :is(input, select, button) {
    min-height: 44px;
    padding: 7px 12px;
    border: 1px solid #a47082;
    border-radius: 8px;
    background: #39202e;
    color: var(--ops-text);
    font: inherit;
  }
  .admin-ops :is(input, select) { width: 100%; min-width: 0; font-size: 16px; }
  .admin-ops button { cursor: pointer; }
  .admin-ops button:hover:not(:disabled) { background: #53283e; }
  .admin-ops button:disabled { opacity: 0.55; cursor: default; }
  .admin-ops button.admin-ops__primary { background: #a51d37; }
  .admin-ops :is(input, select, button, [tabindex]):focus-visible { outline: 2px solid #ffc5cb; outline-offset: 2px; }

  .admin-ops__muted { color: var(--ops-muted); font-size: 14px; }
  .admin-ops__results-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }
  .admin-ops__results-heading p { margin: 0; }
  .admin-ops__alert { padding: 10px 12px; border-radius: 8px; background: #481825; color: #ffe1e5; }
  .admin-ops__actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .admin-ops__pagination { margin-top: 14px; }
  .admin-ops__export-note { margin: 10px 0 0; }

  .admin-ops__table-wrap { max-width: 100%; overflow-x: auto; border: 1px solid var(--ops-border); border-radius: 10px; }
  .admin-ops__table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .admin-ops__table :is(th, td) { padding: 10px 12px; border-bottom: 1px solid #593240; text-align: start; vertical-align: top; }
  .admin-ops__table th { background: #39202e; color: #f5d9e2; white-space: nowrap; }
  .admin-ops__table td { min-width: 95px; }
  .admin-ops__table tbody tr:last-child td { border-bottom: 0; }
  .admin-ops__mobile-label { display: none; }

  .admin-ops__config {
    margin: 0;
    padding: 12px;
    max-height: 34rem;
    overflow: auto;
    border: 1px solid var(--ops-border);
    border-radius: 9px;
    background: #301b28;
    color: var(--ops-text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  @media (max-width: 700px) {
    .admin-ops__filters { grid-template-columns: minmax(0, 1fr); }
    .admin-ops__table-wrap { border: 0; }
    .admin-ops__table,
    .admin-ops__table tbody { display: block; }
    .admin-ops__table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .admin-ops__table tbody tr {
      display: grid;
      gap: 7px;
      margin-bottom: 8px;
      padding: 10px;
      border: 1px solid var(--ops-border);
      border-radius: 10px;
      background: #301b28;
    }
    .admin-ops__table td {
      display: grid;
      grid-template-columns: minmax(0, 5.8rem) minmax(0, 1fr);
      gap: 8px;
      min-width: 0;
      padding: 0;
      border: 0;
    }
    .admin-ops__mobile-label { display: block; color: #f1cfdd; font-size: 12px; font-weight: 650; }
    .admin-ops__actions > button { flex: 1 1 120px; }
  }
`;
