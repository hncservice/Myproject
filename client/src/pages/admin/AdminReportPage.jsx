// client/src/pages/admin/AdminReportPage.jsx
import React, { useEffect, useState } from 'react';
import { downloadReport, getReportStats } from '../../api/adminApi';

const AdminReportPage = () => {
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState(null);

  // Inject page-specific styles once
  useEffect(() => {
    if (document.getElementById('admin-report-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'admin-report-styles';
    styleEl.textContent = `
      .admin-report-page {
        padding-top: 8px;
        padding-bottom: 24px;
      }

      .admin-report-card {
        background: radial-gradient(circle at top left, rgba(31, 41, 55, 0.98), rgba(15, 23, 42, 0.98));
        border-radius: 24px;
        padding: 24px 20px 20px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        box-shadow:
          0 26px 60px rgba(0, 0, 0, 0.85),
          0 0 0 1px rgba(248, 113, 113, 0.15);
        backdrop-filter: blur(20px);
        color: #e5e7eb;
        animation: arFadeInUp 0.55s ease-out;
      }

      .admin-report-header {
        margin-bottom: 18px;
      }

      .admin-report-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(248, 113, 113, 0.8);
        background: rgba(24, 24, 27, 0.9);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #fecaca;
        margin-bottom: 10px;
      }

      .admin-report-pill-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
      }

      .admin-report-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #f9fafb;
      }

      .admin-report-subtitle {
        margin: 0;
        font-size: 13px;
        color: rgba(148, 163, 184, 0.94);
      }

      .admin-report-alert {
        border-radius: 14px;
        padding: 10px 11px;
        font-size: 13px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 12px;
      }

      .admin-report-alert--error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fb7185;
      }

      .admin-report-alert-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .admin-report-section-title {
        font-size: 13px;
        font-weight: 600;
        color: rgba(209, 213, 219, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        margin-bottom: 8px;
      }

      .admin-report-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }

      .admin-report-kpi-card {
        border-radius: 16px;
        padding: 10px 12px;
        background: radial-gradient(circle at top, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.95));
        border: 1px solid rgba(55, 65, 81, 0.9);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.8);
      }

      .admin-report-kpi-label {
        font-size: 11px;
        color: rgba(148, 163, 184, 0.95);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: 4px;
      }

      .admin-report-kpi-value {
        font-size: 20px;
        font-weight: 700;
        color: #f9fafb;
        margin-bottom: 2px;
      }

      .admin-report-kpi-sub {
        font-size: 11px;
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-report-kpi-highlight {
        color: #f97373;
      }

      .admin-report-kpi-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(52, 211, 153, 0.8);
        font-size: 10px;
        color: #bbf7d0;
        margin-left: 4px;
      }

      .admin-report-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: 14px;
        align-items: flex-start;
      }

      .admin-report-chart-card,
      .admin-report-side-card {
        border-radius: 16px;
        padding: 12px 12px 10px;
        background: radial-gradient(circle at top left, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.96));
        border: 1px solid rgba(55, 65, 81, 0.9);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.8);
      }

      .admin-report-chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .admin-report-chart-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(191, 219, 254, 0.95);
      }

      .admin-report-chart-subtitle {
        font-size: 11px;
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-report-chart {
        position: relative;
        height: 150px;
        display: flex;
        align-items: flex-end;
        gap: 6px;
        padding: 8px 4px 2px;
      }

      .admin-report-chart-bar {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .admin-report-chart-bar-fill {
        width: 100%;
        border-radius: 999px 999px 4px 4px;
        background: linear-gradient(180deg, #f97373 0%, #b91c1c 100%);
        box-shadow: 0 10px 18px rgba(248, 113, 113, 0.6);
        transition: height 0.25s ease, transform 0.16s ease;
      }

      .admin-report-chart-bar-fill:hover {
        transform: translateY(-2px);
      }

      .admin-report-chart-bar-label {
        margin-top: 4px;
        font-size: 10px;
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-report-chart-bar-value {
        font-size: 10px;
        color: rgba(226, 232, 240, 0.95);
        margin-bottom: 2px;
      }

      .admin-report-toplist {
        list-style: none;
        padding: 0;
        margin: 6px 0 0;
      }

      .admin-report-toplist-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 0;
        border-bottom: 1px dashed rgba(55, 65, 81, 0.9);
        font-size: 12px;
      }

      .admin-report-toplist-item:last-child {
        border-bottom: none;
      }

      .admin-report-toplist-title {
        color: #e5e7eb;
      }

      .admin-report-toplist-value {
        color: #f97373;
        font-weight: 600;
      }

      .admin-report-download-card {
        margin-top: 16px;
        border-radius: 16px;
        padding: 12px 12px 10px;
        background: radial-gradient(circle at top right, rgba(127, 29, 29, 0.9), rgba(15, 23, 42, 0.98));
        border: 1px solid rgba(248, 113, 113, 0.9);
        box-shadow:
          0 18px 40px rgba(248, 113, 113, 0.75),
          0 0 0 1px rgba(248, 113, 113, 0.55);
      }

      .admin-report-download-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .admin-report-download-title {
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #fee2e2;
      }

      .admin-report-download-text {
        font-size: 11px;
        color: #fecaca;
        margin: 0;
      }

      .admin-report-download-button {
        padding: 9px 16px;
        border-radius: 999px;
        border: none;
        outline: none;
        background: #fef2f2;
        color: #b91c1c;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        box-shadow:
          0 14px 30px rgba(248, 113, 113, 0.75),
          0 0 0 1px rgba(248, 113, 113, 0.7);
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        white-space: nowrap;
      }

      .admin-report-download-button:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.01);
        box-shadow:
          0 18px 40px rgba(248, 113, 113, 0.9),
          0 0 0 1px rgba(248, 113, 113, 0.9);
        filter: brightness(1.02);
      }

      .admin-report-download-button:active:not(:disabled) {
        transform: translateY(0) scale(0.99);
        box-shadow: 0 10px 26px rgba(248, 113, 113, 0.8);
      }

      .admin-report-download-button:disabled {
        cursor: not-allowed;
        opacity: 0.9;
        box-shadow: 0 10px 24px rgba(148, 163, 184, 0.5);
        filter: grayscale(0.1);
      }

      .admin-report-spinner {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        animation: arSpin 0.65s linear infinite;
      }

      .admin-report-note {
        margin-top: 4px;
        font-size: 11px;
        color: rgba(254, 242, 242, 0.9);
      }

      .admin-report-placeholder {
        font-size: 12px;
        color: rgba(148, 163, 184, 0.9);
        padding: 8px 0 2px;
      }

      @keyframes arSpin {
        to { transform: rotate(360deg); }
      }

      @keyframes arFadeInUp {
        from {
          opacity: 0;
          transform: translate3d(0, 16px, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @media (max-width: 992px) {
        .admin-report-kpi-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .admin-report-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 576px) {
        .admin-report-card {
          padding: 20px 14px 16px;
          border-radius: 20px;
        }
        .admin-report-title {
          font-size: 18px;
        }
        .admin-report-download-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .admin-report-download-button {
          width: 100%;
          justify-content: center;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

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

  return (
    <div className="admin-report-page">
      <div className="admin-report-card">
        <div className="admin-report-header">
          <div className="admin-report-pill">
            <span className="admin-report-pill-dot" />
            <span>Analytics & Reports</span>
          </div>
          <h3 className="admin-report-title">Performance Overview</h3>
          <p className="admin-report-subtitle">
            Track spins, prizes, and redemptions, and export a full Excel report for deeper analysis.
          </p>
        </div>

        {error && (
          <div className="admin-report-alert admin-report-alert--error">
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
        <div className="admin-report-section-title">Key Metrics</div>
        {loadingStats && !stats ? (
          <div className="admin-report-placeholder">
            <span className="admin-report-spinner" /> Loading performance data…
          </div>
        ) : (
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
                <span className="admin-report-kpi-chip">
                  <span>Goal</span> <strong>70%</strong>
                </span>
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
        )}

        {/* Charts + Top prizes */}
        <div className="admin-report-layout">
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
                    maxDaily > 0 ? Math.max((d.count / maxDaily) * 100, 6) : 0;
                  const label =
                    typeof d.label === 'string'
                      ? d.label
                      : new Date(d.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        });
                  return (
                    <div key={d.date} className="admin-report-chart-bar">
                      <div className="admin-report-chart-bar-value">
                        {d.count}
                      </div>
                      <div
                        className="admin-report-chart-bar-fill"
                        style={{ height: `${height}%` }}
                      />
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
                {topPrizes.slice(0, 5).map((p) => (
                  <li key={p.title} className="admin-report-toplist-item">
                    <span className="admin-report-toplist-title">
                      {p.title}
                    </span>
                    <span className="admin-report-toplist-value">
                      {p.wins}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

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
    </div>
  );
};

export default AdminReportPage;
