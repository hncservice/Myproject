// client/src/features/administration/pages/AdminReportPage.jsx
import React, { useEffect, useState } from 'react';
import { downloadReport, getAdminOperations, getReportStats } from '../api/adminApi';

const REDEMPTIONS_PER_PAGE = 20;
const redemptionDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Qatar',
  dateStyle: 'medium',
  timeStyle: 'short',
});

function getRedemptionPage(data) {
  const items = Array.isArray(data) ? data : data?.items ?? data?.rows ?? data?.redemptions;
  if (!Array.isArray(items)) {
    throw new Error('The server did not return a redemption list.');
  }

  const pagination = data?.pagination ?? data;
  const total = pagination?.total ?? pagination?.totalCount;
  const pageSize = pagination?.limit ?? REDEMPTIONS_PER_PAGE;
  const pageCount =
    pagination?.totalPages ??
    pagination?.pages ??
    (Number.isFinite(total) && pageSize > 0 ? Math.ceil(total / pageSize) : undefined);

  return {
    items,
    pageCount: Number.isSafeInteger(pageCount) ? Math.max(pageCount, 1) : undefined,
    hasNextPage: pagination?.hasNextPage === true || pagination?.hasNext === true,
  };
}

function RedemptionHistory() {
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await getAdminOperations('redemptions', {
          page,
          limit: REDEMPTIONS_PER_PAGE,
        });
        if (!active) return;

        const nextResult = getRedemptionPage(data);
        if (nextResult.pageCount && page > nextResult.pageCount) {
          setPage(nextResult.pageCount);
          return;
        }
        setResult({ ...nextResult, page });
      } catch (err) {
        if (active) {
          setError(
            err?.response?.data?.message || err?.message || 'Unable to load redemptions.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [page, refreshKey]);

  const currentResult = result?.page === page ? result : null;

  return (
    <section className="admin-report-redemptions" aria-labelledby="admin-redemptions-title">
      <header className="admin-report-redemptions-header">
        <div>
          <h2 id="admin-redemptions-title">Redemptions</h2>
          <p>Prizes collected by customers. Times are shown in Qatar time.</p>
        </div>
        <button
          type="button"
          className="admin-report-redemptions-button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          {error ? 'Try again' : 'Refresh'}
        </button>
      </header>

      {loading && (
        <p className="admin-report-redemptions-message" role="status">Loading redemptions…</p>
      )}

      {error && (
        <p className="admin-report-redemptions-message admin-report-redemptions-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && currentResult?.items.length === 0 && (
        <p className="admin-report-redemptions-message">No redemptions found.</p>
      )}

      {!error && currentResult?.items.length > 0 && (
        <table className="admin-report-redemptions-table" role="table" aria-label="Prize redemptions">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Prize</th>
              <th scope="col" role="columnheader">Vendor</th>
              <th scope="col" role="columnheader">Redeemed at</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {currentResult.items.map((row, index) => {
              const prize =
                row.prizeTitle ||
                row.prize?.title ||
                row.wheelItemId?.title ||
                (typeof row.prize === 'string' ? row.prize : '');
              const vendor =
                row.vendorName ||
                row.redeemedByVendorName ||
                row.vendor?.name ||
                row.redeemedByVendor?.name ||
                row.redeemedByVendorId?.name ||
                (typeof row.vendor === 'string' ? row.vendor : '');
              const date = row.redeemedAt ? new Date(row.redeemedAt) : null;
              const hasDate = date && Number.isFinite(date.getTime());

              return (
                <tr key={row.id ?? row._id ?? index} role="row">
                  <td role="cell">
                    <span className="admin-report-redemptions-mobile-label" aria-hidden="true">Prize</span>
                    <strong>{prize || '—'}</strong>
                  </td>
                  <td role="cell">
                    <span className="admin-report-redemptions-mobile-label" aria-hidden="true">Vendor</span>
                    <span>{vendor || '—'}</span>
                  </td>
                  <td role="cell">
                    <span className="admin-report-redemptions-mobile-label" aria-hidden="true">Redeemed at</span>
                    {hasDate ? (
                      <time dateTime={date.toISOString()}>{redemptionDateFormat.format(date)}</time>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {(page > 1 || currentResult?.pageCount > 1 || currentResult?.hasNextPage) && (
        <nav className="admin-report-redemptions-nav" aria-label="Redemption pages">
          <button
            type="button"
            className="admin-report-redemptions-button"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span aria-live="polite">
            Page {page}{currentResult?.pageCount ? ' of ' + currentResult.pageCount : ''}
          </span>
          <button
            type="button"
            className="admin-report-redemptions-button"
            disabled={
              loading ||
              Boolean(error) ||
              !(currentResult?.pageCount > page || currentResult?.hasNextPage)
            }
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

const AdminReportPage = () => {
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState(null);

  // Load stats (from backend summary endpoint)
  useEffect(() => {
    const loadStats = async () => {
      setLoadingStats(true);
      setError(null);
      try {
        const res = await getReportStats();
        setStats(res.data || null);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load report stats';
        setError(msg);
      } finally {
        setLoadingStats(false);
      }
    };

    loadStats();
  }, []);

  const handleDownload = async () => {
    if (downloading) return;
    setError(null);
    setDownloading(true);

    try {
      const res = await downloadReport();

      if (!res || !res.data) {
        throw new Error('Empty response from server');
      }

      const blob = new Blob([res.data], {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);

      link.href = url;
      link.setAttribute('download', `spin_report_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to download report';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  // Derived values for UI
  const totalSpins = stats?.totalSpins ?? 0;
  const uniqueUsers = stats?.uniqueUsers ?? 0;
  const redeemedCount = stats?.redeemedCount ?? 0;
  const totalPrizes = stats?.totalPrizesWon ?? 0;
  const redemptionRate =
    totalPrizes > 0 ? Math.round((redeemedCount / totalPrizes) * 100) : 0;
  const pendingCount = stats?.pendingCount ?? 0;

  const dailySpins = stats?.dailySpins || []; // [{ date: '2025-11-20', count: 12 }, ...]
  const maxDaily = dailySpins.reduce(
    (max, d) => (d.count > max ? d.count : max),
    0
  );

  const topPrizes = stats?.topPrizes || []; // [{ title, wins }]
  const maxPrizeWins = topPrizes.reduce(
    (max, p) => (p.wins > max ? p.wins : max),
    0
  );

  // For donut chart (redemption)
  const ringRadius = 36;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference - (Math.min(redemptionRate, 100) / 100) * ringCircumference;

  return (
    <main className="admin-report-page">
      <style>{adminReportCss}</style>
      <div className="admin-report-card">
        <div className="admin-report-header">
          <h1 className="admin-report-title">Performance overview</h1>
          <p className="admin-report-subtitle">
            Track rewards, review redemptions, and download your campaign report.
          </p>
        </div>

        {error && (
          <div className="admin-report-alert admin-report-alert--error" role="alert">
            <svg
              className="admin-report-alert-icon"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* KPI cards */}
        {loadingStats && !stats ? (
          <div className="admin-report-placeholder">
            <span className="admin-report-spinner" /> Loading performance data…
          </div>
        ) : stats ? (
          <>
            <div className="admin-report-kpi-grid">
              <div className="admin-report-kpi-card">
                <div className="admin-report-kpi-label">Total Spins</div>
                <div className="admin-report-kpi-value">
                  {totalSpins}
                </div>
                <div className="admin-report-kpi-sub">
                  Unique users:{' '}
                  <span className="admin-report-kpi-highlight">
                    {uniqueUsers}
                  </span>
                </div>
              </div>

              <div className="admin-report-kpi-card">
                <div className="admin-report-kpi-label">Prizes Won</div>
                <div className="admin-report-kpi-value">
                  {totalPrizes}
                </div>
                <div className="admin-report-kpi-sub">
                  Redeemed:{' '}
                  <span className="admin-report-kpi-highlight">
                    {redeemedCount}
                  </span>{' '}
                  / Pending: {pendingCount}
                </div>
              </div>

              <div className="admin-report-kpi-card">
                <div className="admin-report-kpi-label">Redemption Rate</div>
                <div className="admin-report-kpi-value">
                  {redemptionRate}
                  <span style={{ fontSize: 13 }}>%</span>
                </div>
                <div className="admin-report-kpi-sub">
                  Prizes collected by customers
                </div>
              </div>

              <div className="admin-report-kpi-card">
                <div className="admin-report-kpi-label">Top Prize</div>
                <div className="admin-report-kpi-value">
                  {topPrizes[0]?.title || '—'}
                </div>
                <div className="admin-report-kpi-sub">
                  Wins:{' '}
                  <span className="admin-report-kpi-highlight">
                    {topPrizes[0]?.wins ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Redemption donut / visual summary */}
            <div className="admin-report-ring-row">
              <div className="admin-report-ring-card">
                <div className="admin-report-section-title">
                  Redemption Overview
                </div>
                <div className="admin-report-ring-layout">
                  <div className="admin-report-ring-wrapper">
                    <svg
                      className="admin-report-ring-svg"
                      width="86"
                      height="86"
                      viewBox="0 0 86 86"
                      aria-hidden="true"
                    >
                      <circle
                        cx="43"
                        cy="43"
                        r={ringRadius}
                        fill="none"
                        stroke="#3b5750"
                        strokeWidth="8"
                      />
                      <circle
                        cx="43"
                        cy="43"
                        r={ringRadius}
                        fill="none"
                        stroke="url(#ringGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                      />
                      <defs>
                        <linearGradient
                          id="ringGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#99dcc0" />
                          <stop offset="50%" stopColor="#bcdfb7" />
                          <stop offset="100%" stopColor="#f0bd88" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="admin-report-ring-center">
                      <div className="admin-report-ring-value">
                        {redemptionRate}
                        <span>%</span>
                      </div>
                      <div className="admin-report-ring-label">
                        redeemed 
                      </div>
                    </div>
                  </div>

                  <div className="admin-report-ring-meta">
                    <div className="admin-report-ring-meta-row">
                      <span className="admin-report-ring-meta-label">
                        Total prizes won
                      </span>
                      <span className="admin-report-ring-meta-value">
                        {totalPrizes}
                      </span>
                    </div>
                    <div className="admin-report-ring-meta-row">
                      <span className="admin-report-ring-meta-label">
                        Redeemed vs pending
                      </span>
                      <span className="admin-report-ring-meta-value">
                        {redeemedCount} / {pendingCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* Charts + Top prizes */}
        {stats && <div className="admin-report-layout">
          <div className="admin-report-chart-card">
            <div className="admin-report-chart-header">
              <div>
                <div className="admin-report-chart-title">
                  Daily Spins (recent)
                </div>
                <div className="admin-report-chart-subtitle">
                  How many times users spun the wheel per day
                </div>
              </div>
              {dailySpins && dailySpins.length > 0 && (
                <div className="admin-report-chart-tag">
                  Peak day:&nbsp;
                  {dailySpins.reduce(
                    (best, d) =>
                      !best || d.count > best.count ? d : best,
                    null
                  )?.count}{' '}
                  spins
                </div>
              )}
            </div>

            {(!dailySpins || dailySpins.length === 0) && !loadingStats ? (
              <div className="admin-report-placeholder">
                No daily spin data yet. Once users start spinning, you’ll see a bar
                chart here.
              </div>
            ) : (
              <div className="admin-report-chart">
                {dailySpins.map((d) => {
                  const height =
                    maxDaily > 0 ? Math.max((d.count / maxDaily) * 85, d.count > 0 ? 2 : 0) : 0;
                  const label =
                    typeof d.label === 'string'
                      ? d.label
                      : new Date(d.date).toLocaleDateString('en-GB', {
                          timeZone: 'Asia/Qatar',
                          month: 'short',
                          day: 'numeric',
                        });
                  return (
                    <div key={d.date} className="admin-report-chart-bar">
                      <div className="admin-report-chart-bar-track">
                        <div className="admin-report-chart-bar-value">{d.count}</div>
                        <div
                          className="admin-report-chart-bar-fill"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="admin-report-chart-bar-label">
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-report-side-card">
            <div className="admin-report-chart-header">
              <div>
                <div className="admin-report-chart-title">
                  Top Prizes
                </div>
                <div className="admin-report-chart-subtitle">
                  Best performing rewards by wins
                </div>
              </div>
            </div>

            {(!topPrizes || topPrizes.length === 0) && !loadingStats ? (
              <div className="admin-report-placeholder">
                No prize data yet. When users start winning, top prizes will appear
                here.
              </div>
            ) : (
              <ul className="admin-report-toplist">
                {topPrizes.slice(0, 5).map((p) => {
                  const width =
                    maxPrizeWins > 0
                      ? Math.max((p.wins / maxPrizeWins) * 100, p.wins > 0 ? 2 : 0)
                      : 0;
                  return (
                    <li key={p.title} className="admin-report-toplist-item">
                      <div className="admin-report-toplist-row">
                        <span className="admin-report-toplist-title">
                          {p.title}
                        </span>
                        <span className="admin-report-toplist-value">
                          {p.wins}
                        </span>
                      </div>
                      <div className="admin-report-toplist-bar-track">
                        <div
                          className="admin-report-toplist-bar-fill"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>}

        <RedemptionHistory />

        {/* Download section */}
        <div className="admin-report-download-card">
          <div className="admin-report-download-header">
            <div>
              <div className="admin-report-download-title">
                Export Full Excel Report
              </div>
              <p className="admin-report-download-text">
                Download a detailed spreadsheet of all spins, users, prizes, and redemption data.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="admin-report-download-button"
            >
              {downloading ? (
                <>
                  <span className="admin-report-spinner" />
                  <span>Downloading…</span>
                </>
              ) : (
                <>
                  <span>Download Excel</span>
                </>
              )}
            </button>
          </div>
          <div className="admin-report-note">
            Tip: Open in Excel or Google Sheets to filter by date, prize, or vendor.
          </div>
        </div>
      </div>
    </main>
  );
};

const adminReportCss = `
.admin-report-page {
  --report-text: #fff6f1;
  --report-muted: #c9b6bd;
  --report-border: #62404d;
  --report-accent: #efab79;
  padding: clamp(16px, 3vw, 36px) 0 32px;
  color: var(--report-text);
  font-family: 'Segoe UI', system-ui, sans-serif;
}
.admin-report-page,
.admin-report-page *,
.admin-report-page *::before,
.admin-report-page *::after { box-sizing: border-box; }
.admin-report-card { display: grid; gap: 24px; min-width: 0; }
.admin-report-header {
  padding: clamp(22px, 4vw, 40px);
  border: 1px solid #825060;
  border-radius: 24px;
  background: radial-gradient(ellipse at top right, #843b44 0, transparent 64%), #321923;
}
.admin-report-title {
  margin: 0 0 12px;
  font-size: clamp(30px, 4.5vw, 48px);
  font-weight: 750;
  line-height: 1.1;
  letter-spacing: -.045em;
  color: var(--report-text);
}
.admin-report-subtitle { max-width: 610px; margin: 0; font-size: 15px; line-height: 1.65; color: #ead4d8; }
.admin-report-page button {
  min-height: 44px;
  padding: 10px 17px;
  border: 1px solid #9b6c7c;
  border-radius: 10px;
  background: #452635;
  color: var(--report-text);
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  transition: background-color .15s ease;
}
.admin-report-page button:hover:not(:disabled) { background: #603347; }
.admin-report-page button:disabled { opacity: .55; cursor: default; }
.admin-report-page button:focus-visible { outline: 3px solid #ffd2a8; outline-offset: 3px; }
.admin-report-alert { display: flex; gap: 12px; align-items: start; padding: 15px 18px; border-radius: 12px; border: 1px solid #c06779; background: #481e2c; color: #ffced8; overflow-wrap: anywhere; }
.admin-report-alert-icon { width: 21px; height: 21px; flex: none; }
.admin-report-section-title { margin: 0 0 14px; font-size: 18px; font-weight: 700; color: var(--report-text); }
.admin-report-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.admin-report-kpi-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 158px;
  padding: 22px;
  border: 1px solid var(--report-border);
  border-radius: 18px;
  background: #291c27;
}
.admin-report-kpi-card:first-child { background: #462633; border-color: #a46675; }
.admin-report-kpi-label { color: #dec6ce; font-size: 13px; font-weight: 600; }
.admin-report-kpi-value {
  margin: 12px 0 10px;
  font-size: clamp(30px, 3.6vw, 44px);
  font-weight: 750;
  letter-spacing: -.035em;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.admin-report-kpi-card:last-child .admin-report-kpi-value { font-size: clamp(20px, 2vw, 27px); letter-spacing: -.02em; }
.admin-report-kpi-sub { margin-top: auto; color: var(--report-muted); font-size: 12px; line-height: 1.6; }
.admin-report-kpi-highlight { color: #ffc493; font-weight: 650; }
.admin-report-ring-row { min-width: 0; }
.admin-report-ring-card {
  padding: 24px;
  border: 1px solid #466a63;
  border-radius: 18px;
  background: #1d302e;
}
.admin-report-ring-layout { display: flex; align-items: center; gap: 28px; }
.admin-report-ring-wrapper { position: relative; width: 116px; height: 116px; flex: 0 0 116px; }
.admin-report-ring-svg { display: block; width: 116px; height: 116px; transform: rotate(-90deg); }
.admin-report-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.admin-report-ring-value { color: #effdf5; font-size: 28px; font-weight: 750; line-height: 1.1; }
.admin-report-ring-value span { font-size: 15px; }
.admin-report-ring-label { margin-top: 5px; color: #b9d5cb; font-size: 11px; }
.admin-report-ring-meta { flex: 1; min-width: 0; max-width: 520px; }
.admin-report-ring-meta-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #3e5650; font-size: 14px; color: #cce0d8; }
.admin-report-ring-meta-value { color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
.admin-report-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); align-items: stretch; gap: 20px; }
.admin-report-chart-card,
.admin-report-side-card { min-width: 0; padding: 24px; border: 1px solid var(--report-border); border-radius: 18px; background: #291c27; }
.admin-report-chart-header { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
.admin-report-chart-title { color: var(--report-text); font-size: 18px; font-weight: 700; line-height: 1.4; }
.admin-report-chart-subtitle { margin-top: 5px; color: var(--report-muted); font-size: 13px; line-height: 1.5; }
.admin-report-chart-tag { padding: 5px 9px; border: 1px solid #87604c; border-radius: 8px; color: #fbd1a3; background: #3c2c27; font-size: 12px; }
.admin-report-chart { display: flex; align-items: stretch; gap: 12px; height: 230px; overflow-x: auto; padding: 8px 2px 0; }
.admin-report-chart-bar { flex: 1 0 38px; min-width: 38px; height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) 30px; text-align: center; }
.admin-report-chart-bar-track { position: relative; display: flex; flex-direction: column; justify-content: end; align-items: center; min-height: 0; border-bottom: 1px solid #876777; background: repeating-linear-gradient(to top, transparent 0, transparent calc(25% - 1px), #ffffff09 calc(25% - 1px), #ffffff09 25%); }
.admin-report-chart-bar-value { margin-bottom: 5px; color: #f4d6bf; font-size: 12px; font-weight: 650; }
.admin-report-chart-bar-fill { width: min(100%, 36px); flex: 0 0 auto; max-height: calc(100% - 25px); border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #f1b180, #ae405d); }
.admin-report-chart-bar-label { padding-top: 8px; color: var(--report-muted); font-size: 11px; white-space: nowrap; }
.admin-report-toplist { list-style: none; margin: 0; padding: 0; }
.admin-report-toplist-item { padding: 15px 0; border-bottom: 1px solid #533746; }
.admin-report-toplist-item:first-child { padding-top: 0; }
.admin-report-toplist-item:last-child { border-bottom: 0; }
.admin-report-toplist-row { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin-bottom: 10px; font-size: 14px; }
.admin-report-toplist-title { overflow-wrap: anywhere; }
.admin-report-toplist-value { flex: none; color: #f5bb8c; font-weight: 700; }
.admin-report-toplist-bar-track { height: 7px; border-radius: 10px; overflow: hidden; background: #4c3440; }
.admin-report-toplist-bar-fill { height: 100%; border-radius: inherit; background: #d69670; }
.admin-report-download-card { padding: 24px; border: 1px solid #9c5c6c; border-radius: 18px; background: #432332; }
.admin-report-download-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.admin-report-download-title { color: var(--report-text); font-size: 18px; font-weight: 700; }
.admin-report-download-text { margin: 5px 0 0; max-width: 600px; color: #e0c1cb; font-size: 13px; line-height: 1.6; }
.admin-report-page .admin-report-download-button { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 9px; border-color: #f6bd92; background: #f6bd92; color: #351b24; }
.admin-report-page .admin-report-download-button:hover:not(:disabled) { background: #ffcea6; }
.admin-report-note { margin-top: 14px; color: #e0c1cb; font-size: 12px; line-height: 1.6; }
.admin-report-placeholder { display: flex; align-items: center; gap: 10px; padding: 26px 0; color: var(--report-muted); font-size: 14px; line-height: 1.6; }
.admin-report-spinner { display: inline-block; width: 16px; height: 16px; flex: none; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: adminReportSpin .7s linear infinite; }
.admin-report-redemptions { min-width: 0; padding: 24px; border: 1px solid var(--report-border); border-radius: 18px; background: #291c27; overflow-wrap: anywhere; }
.admin-report-redemptions-header,
.admin-report-redemptions-nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.admin-report-redemptions-header { margin-bottom: 20px; }
.admin-report-redemptions-header h2 { margin: 0 0 5px; color: var(--report-text); font-size: 22px; font-weight: 700; }
.admin-report-redemptions-header p,
.admin-report-redemptions-message,
.admin-report-redemptions-nav span { margin: 0; color: var(--report-muted); font-size: 13px; line-height: 1.6; }
.admin-report-redemptions-message { padding: 12px 0; }
.admin-report-redemptions-error { color: #ffbdcd; }
.admin-report-redemptions-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 14px; line-height: 1.55; }
.admin-report-redemptions-table :is(th, td) { padding: 15px 12px; border-bottom: 1px solid #573b49; text-align: start; vertical-align: top; }
.admin-report-redemptions-table th { color: #dfbdcb; font-size: 12px; background: #35232e; font-weight: 650; }
.admin-report-redemptions-table td { color: #eadbe2; }
.admin-report-redemptions-table td strong { color: #ffceaa; }
.admin-report-redemptions-table tbody tr:hover { background: #3a2833; }
.admin-report-redemptions-mobile-label { display: none; }
.admin-report-redemptions-nav { margin-top: 20px; }
@keyframes adminReportSpin { to { transform: rotate(360deg); } }
@media (max-width: 1000px) {
  .admin-report-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .admin-report-layout { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 576px) {
  .admin-report-card { gap: 16px; }
  .admin-report-header { padding: 25px 20px; border-radius: 18px; }
  .admin-report-kpi-grid { gap: 10px; }
  .admin-report-kpi-card { min-height: 145px; padding: 16px; border-radius: 14px; }
  .admin-report-kpi-value { font-size: 32px; }
  .admin-report-kpi-card:last-child .admin-report-kpi-value { font-size: 20px; }
  .admin-report-ring-card, .admin-report-chart-card, .admin-report-side-card,
  .admin-report-redemptions, .admin-report-download-card { padding: 18px; border-radius: 16px; }
  .admin-report-ring-layout { flex-wrap: wrap; gap: 18px; }
  .admin-report-ring-meta { flex: 1 1 180px; }
  .admin-report-download-header { flex-direction: column; align-items: stretch; }
  .admin-report-redemptions-table,
  .admin-report-redemptions-table tbody { display: block; }
  .admin-report-redemptions-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .admin-report-redemptions-table tbody tr { display: grid; gap: 10px; padding: 15px; margin-bottom: 10px; border: 1px solid #614151; border-radius: 12px; background: #35232e; }
  .admin-report-redemptions-table td { display: grid; grid-template-columns: 75px minmax(0, 1fr); gap: 12px; padding: 0; border: 0; }
  .admin-report-redemptions-mobile-label { display: block; color: #c9a9b7; font-size: 12px; }
}
@media (max-width: 340px) {
  .admin-report-kpi-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .admin-report-page *, .admin-report-page *::before, .admin-report-page *::after { animation: none !important; transition: none !important; }
}
`;

export default AdminReportPage;