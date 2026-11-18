// client/src/pages/vendor/VendorScanPage.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../authentication/context/AuthContext';
import {
  scanQrToken,
  getVendorDashboard,
  exportVendorRedemptionsExcel,
} from '../api/vendorApi';
import {
  Form,
  Button,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Spinner,
  Badge,
} from 'react-bootstrap';
import { Scanner } from '@yudiel/react-qr-scanner';

// 🔹 helper: get pure token from URL or plain code
const extractQrToken = (raw) => {
  if (!raw) return '';
  if (typeof raw !== 'string' || raw.length > 2048) return '';
  const trimmed = raw.trim();

  // If it looks like a URL, try to pull the last path segment
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || '';
    } catch (e) {
      console.warn('Failed to parse QR URL, falling back to raw:', e);
      return trimmed;
    }
  }

  return trimmed;
};

const VendorScanPage = () => {
  const { profile } = useAuth();

  // Scan mode
  const [mode, setMode] = useState('manual'); // Camera requires an explicit choice.

  // Scan / redeem states
  const [qrToken, setQrToken] = useState('');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Prevent duplicate redemptions from the same scanned token
  const lastCameraToken = useRef(null);
  const inFlight = useRef(false);

  // Dashboard states
  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError(null);
    try {
      // last 30 days, latest 10 rows
      const res = await getVendorDashboard({ days: 30, limit: 10 });
      setDash(res.data);
    } catch (e) {
      setDashError(
        e?.response?.data?.message || e?.message || 'Failed to load dashboard'
      );
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const redeem = useCallback(
    async (tokenValue) => {
      const extracted = extractQrToken(tokenValue);
      if (inFlight.current) return;
      if (!/^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$/.test(extracted)) {
        setInfo(null);
        setError('Enter a valid QR code or redemption link.');
        return;
      }

      inFlight.current = true;

      setProcessing(true);
      setError(null);
      setInfo(null);

      try {
        const res = await scanQrToken(extracted);
        setInfo(res.data);
        setQrToken(extracted);

        // refresh dashboard after successful redemption
        await loadDashboard();
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Scan failed. Please try again.';
        setError(msg);
      } finally {
        inFlight.current = false;
        setProcessing(false);
      }
    },
    [loadDashboard]
  );

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    await redeem(qrToken);
  };

  const handleScanResults = (results) => {
    if (inFlight.current) return;

    const result = results?.[0];
    const token = extractQrToken(result?.rawValue || result?.raw || result?.value);
    if (!token || lastCameraToken.current === token) return;

    lastCameraToken.current = token;
    void redeem(token);
  };

  // ✅ Excel download (vendor only)
  const downloadExcel = async (days = 30) => {
    if (exporting) return;
    setExporting(true);
    setDashError(null);

    try {
      const res = await exportVendorRedemptionsExcel(days ? { days } : {});
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const suffix = days ? `last_${days}_days` : 'all_time';
      a.download = `vendor_redemptions_${suffix}.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setDashError(e?.response?.data?.message || e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const totals = dash?.totals;
  const recent = dash?.recentRedemptions || [];
  const topPrizes = dash?.topPrizes || [];

  return (
    <section className="hnc-vendor-scan" aria-labelledby="vendor-scan-title">
      <style>{vendorScanCss}</style>

      <header className="hnc-vendor-scan__header">
        <h1 id="vendor-scan-title">Vendor QR Scan</h1>
        <p>Logged in as <strong>{profile?.name || 'Unknown Vendor'}</strong></p>
      </header>

      <div className="hnc-vendor-scan__grid">
        <section className="hnc-vendor-scan__panel" aria-labelledby="vendor-redeem-title">
          <h2 id="vendor-redeem-title">Redeem a prize</h2>

          <ToggleButtonGroup
            className="hnc-vendor-scan__modes"
            type="radio"
            name="scanMode"
            value={mode}
            onChange={(value) => {
              setMode(value);
              setError(null);
              setInfo(null);
              lastCameraToken.current = null;
            }}
          >
            <ToggleButton
              id="mode-camera"
              value="camera"
              variant={mode === 'camera' ? 'danger' : 'outline-light'}
              disabled={processing}
            >
              Camera Scan
            </ToggleButton>
            <ToggleButton
              id="mode-manual"
              value="manual"
              variant={mode === 'manual' ? 'danger' : 'outline-light'}
              disabled={processing}
            >
              Manual Code
            </ToggleButton>
          </ToggleButtonGroup>

          {error && <Alert variant="danger" role="alert">{error}</Alert>}
          {info && (
            <Alert variant="success" role="status">
              <strong>{info.message || 'Prize redeemed successfully.'}</strong>
              {info.prize && <div>Prize: {info.prize}</div>}
              {(info.user?.name || info.user?.email) && (
                <div>Customer: {[info.user.name, info.user.email].filter(Boolean).join(' · ')}</div>
              )}
            </Alert>
          )}

          {mode === 'camera' ? (
            <>
              <div className="hnc-vendor-scan__camera">
                <Scanner
                  onScan={handleScanResults}
                  onError={() => {
                    setError('Camera unavailable. Check camera permissions or use Manual Code.');
                  }}
                  components={{}}
                />
              </div>
              <p className="hnc-vendor-scan__help">
                Point the camera at the customer’s QR code. A valid scan submits immediately.
              </p>
              {processing && <p role="status">Processing scan…</p>}
            </>
          ) : (
            <Form onSubmit={handleManualSubmit}>
              <Form.Group className="mb-3" controlId="vendor-qr-token">
                <Form.Label>QR token or redemption link</Form.Label>
                <Form.Control
                  type="text"
                  value={qrToken}
                  onChange={(event) => setQrToken(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={2048}
                  required
                  placeholder="Paste the code or full link"
                />
              </Form.Group>
              <Button type="submit" className="w-100" variant="danger" disabled={processing}>
                {processing ? 'Processing…' : 'Redeem prize'}
              </Button>
            </Form>
          )}
        </section>

        <section className="hnc-vendor-scan__panel" aria-labelledby="vendor-summary-title">
          <div className="hnc-vendor-scan__summary-head">
            <h2 id="vendor-summary-title">Redemption summary</h2>
            <Button type="button" variant="outline-light" onClick={loadDashboard} disabled={dashLoading}>
              {dashLoading && <Spinner animation="border" size="sm" aria-hidden="true" />}
              {dashLoading ? ' Refreshing…' : 'Refresh'}
            </Button>
          </div>

          {dashError && <Alert variant="danger" role="alert">{dashError}</Alert>}

          <dl className="hnc-vendor-scan__stats">
            <div>
              <dt>All time</dt>
              <dd>{totals?.totalRedeemed ?? '—'}</dd>
            </div>
            <div>
              <dt>Last {totals?.days ?? 30} days</dt>
              <dd>{totals?.redeemedLastNDays ?? '—'}</dd>
            </div>
            <div>
              <dt>Top prize</dt>
              <dd>
                {topPrizes[0]?.title || '—'}
                {topPrizes[0]?.title && (
                  <Badge bg="secondary" pill className="ms-2">{topPrizes[0].count}</Badge>
                )}
              </dd>
            </div>
          </dl>

          <h3>Recent redemptions</h3>
          {dashLoading ? (
            <p className="hnc-vendor-scan__help" role="status">Loading redemptions…</p>
          ) : recent.length > 0 ? (
            <ul className="hnc-vendor-scan__recent">
              {recent.map((redemption) => (
                <li key={redemption.id}>
                  <div>
                    <strong>{redemption.prize}</strong>
                    <span>{[redemption.user?.name || 'User', redemption.user?.email].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span>
                    {redemption.redeemedAt ? new Date(redemption.redeemedAt).toLocaleString() : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : !dashError ? (
            <p className="hnc-vendor-scan__help">No redemptions yet.</p>
          ) : null}

          <div className="hnc-vendor-scan__exports">
            <Button type="button" variant="outline-light" onClick={() => downloadExcel(30)} disabled={exporting}>
              Export last 30 days
            </Button>
            <Button type="button" variant="outline-light" onClick={() => downloadExcel(null)} disabled={exporting}>
              Export all
            </Button>
          </div>
          {exporting && <p className="hnc-vendor-scan__help" role="status">Preparing Excel download…</p>}
        </section>
      </div>
    </section>
  );
};

const vendorScanCss = `
  .hnc-vendor-scan {
    --scan-text: #fff7f6;
    --scan-muted: #dbc4ca;
    --scan-border: #75404e;
    width: min(100%, 1120px);
    margin-inline: auto;
    padding: clamp(20px, 4vw, 48px) clamp(12px, 3vw, 28px);
    color: var(--scan-text);
    overflow-wrap: anywhere;
  }

  .hnc-vendor-scan__header { margin-bottom: 22px; }
  .hnc-vendor-scan__header h1 {
    margin: 0 0 6px;
    font-size: clamp(28px, 5vw, 44px);
    font-weight: 800;
  }
  .hnc-vendor-scan__header p,
  .hnc-vendor-scan__help { margin: 0; color: var(--scan-muted); }
  .hnc-vendor-scan__help { margin-top: 10px; font-size: 14px; }

  .hnc-vendor-scan__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    align-items: start;
    gap: 16px;
  }
  .hnc-vendor-scan__panel {
    min-width: 0;
    padding: clamp(16px, 3vw, 24px);
    border: 1px solid var(--scan-border);
    border-radius: 18px;
    background: #23131d;
  }
  .hnc-vendor-scan__panel h2 { margin: 0 0 14px; font-size: 21px; font-weight: 750; }
  .hnc-vendor-scan__panel h3 { margin: 0; font-size: 16px; font-weight: 700; }

  .hnc-vendor-scan__modes { display: flex; width: 100%; margin-bottom: 16px; }
  .hnc-vendor-scan .btn { min-height: 44px; white-space: normal; }
  .hnc-vendor-scan .btn-outline-light {
    --bs-btn-color: #ffebef;
    --bs-btn-border-color: #a47082;
  }
  .hnc-vendor-scan .btn-danger {
    --bs-btn-bg: #b9253d;
    --bs-btn-border-color: #b9253d;
    --bs-btn-hover-bg: #a71d32;
    --bs-btn-hover-border-color: #a71d32;
  }

  .hnc-vendor-scan .form-control {
    min-height: 48px;
    border-color: #a47082;
    background: #321e2b;
    color: var(--scan-text);
    font-size: 16px;
  }
  .hnc-vendor-scan .form-control::placeholder { color: #dbc4ca; }
  .hnc-vendor-scan .form-control:focus {
    border-color: #ffc5cb;
    background: #321e2b;
    color: var(--scan-text);
    box-shadow: 0 0 0 3px #ffc5cb33;
  }
  .hnc-vendor-scan :is(button, input, .btn):focus-visible,
  .hnc-vendor-scan .btn-check:focus-visible + .btn {
    outline: 2px solid #ffc5cb;
    outline-offset: 2px;
  }

  .hnc-vendor-scan__camera {
    width: min(100%, 360px);
    margin-inline: auto;
    overflow: hidden;
    border: 1px solid #a47082;
    border-radius: 14px;
    background: #090609;
  }

  .hnc-vendor-scan__summary-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }
  .hnc-vendor-scan__summary-head h2 { margin: 0; }
  .hnc-vendor-scan__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 112px), 1fr));
    gap: 8px;
    margin: 0 0 18px;
  }
  .hnc-vendor-scan__stats > div {
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--scan-border);
    border-radius: 10px;
    background: #321e2b;
  }
  .hnc-vendor-scan__stats dt { color: var(--scan-muted); font-size: 12px; }
  .hnc-vendor-scan__stats dd { margin: 4px 0 0; font-weight: 750; }
  .hnc-vendor-scan__recent { padding: 0; margin: 8px 0 0; list-style: none; }
  .hnc-vendor-scan__recent li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--scan-border);
  }
  .hnc-vendor-scan__recent span {
    display: block;
    color: var(--scan-muted);
    font-size: 13px;
  }
  .hnc-vendor-scan__exports { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }

  @media (max-width: 850px) {
    .hnc-vendor-scan__grid { grid-template-columns: minmax(0, 1fr); }
  }
`;

export default VendorScanPage;
