// client/src/pages/vendor/VendorScanPage.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  scanQrToken,
  getVendorDashboard,
  exportVendorRedemptionsExcel,
} from '../../api/vendorApi';
import {
  Card,
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

// Optional: add some focus / hover global styles once
const ensureVendorScanStyles = () => {
  if (document.getElementById('vendor-scan-extra-styles')) return;
  const styleSheet = document.createElement('style');
  styleSheet.id = 'vendor-scan-extra-styles';
  styleSheet.textContent = `
    .form-control:focus {
      border-color: #dc2626 !important;
      box-shadow: 0 0 0 0.15rem rgba(220, 38, 38, 0.35) !important;
      background-color: rgba(15,23,42,1) !important;
      color: #e5e7eb !important;
    }
    .btn-outline-danger:hover {
      background-color: rgba(220,38,38,0.12) !important;
    }
  `;
  document.head.appendChild(styleSheet);
};

const VendorScanPage = () => {
  const { profile } = useAuth();

  // Scan mode
  const [mode, setMode] = useState('camera'); // 'camera' | 'manual'

  // Scan / redeem states
  const [qrToken, setQrToken] = useState('');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Prevent duplicate redemptions from the same scanned token
  const lastProcessedRef = useRef(null);

  // Dashboard states
  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    ensureVendorScanStyles();
  }, []);

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
      if (!extracted) return;
      if (processing) return;

      // Prevent processing same token repeatedly
      if (lastProcessedRef.current === extracted) return;
      lastProcessedRef.current = extracted;

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

        // allow retry same token if it failed
        lastProcessedRef.current = null;
      } finally {
        setProcessing(false);
      }
    },
    [processing, loadDashboard]
  );

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    await redeem(qrToken);
  };

  const handleScanResults = (results) => {
    if (!results || results.length === 0) return;
    const text = results[0]?.rawValue || results[0]?.raw || results[0]?.value;
    if (!text) return;

    setQrToken(text);
    redeem(text);
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
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <Card style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.logoBox}>
              <svg style={styles.logoIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
              </svg>
            </div>
            <h2 style={styles.title}>Vendor QR Scan</h2>
            <p style={styles.subtitle}>
              Logged in as{' '}
              <span style={{ color: '#fca5a5', fontWeight: 600 }}>
                {profile?.name || 'Unknown Vendor'}
              </span>
            </p>
          </div>

          {/* Dashboard summary */}
          <div style={styles.dashCard}>
            <div style={styles.dashTopRow}>
              <div>
                <div style={styles.dashTitle}>Redeemed Summary</div>
                <div style={styles.dashSub}>
                  Last {totals?.days ?? 30} days + all-time totals
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={loadDashboard}
                  disabled={dashLoading}
                  style={{ borderRadius: 999, fontWeight: 800 }}
                >
                  {dashLoading ? (
                    <>
                      <Spinner animation="border" size="sm" /> Refresh
                    </>
                  ) : (
                    'Refresh'
                  )}
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => downloadExcel(30)}
                  disabled={exporting}
                  style={{ borderRadius: 999, fontWeight: 800 }}
                >
                  {exporting ? 'Exporting…' : 'Export Excel (30d)'}
                </Button>

                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => downloadExcel(null)}
                  disabled={exporting}
                  style={{ borderRadius: 999, fontWeight: 800 }}
                  title="Export all vendor redemptions"
                >
                  {exporting ? 'Exporting…' : 'Export All'}
                </Button>
              </div>
            </div>

            {dashError && (
              <div style={{ marginTop: 10 }}>
                <Alert
                  variant="danger"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#fecaca',
                    marginBottom: 0,
                  }}
                >
                  {dashError}
                </Alert>
              </div>
            )}

            <div style={styles.statsRow}>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>All-time redeemed</div>
                <div style={styles.statValue}>{totals?.totalRedeemed ?? '-'}</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Redeemed (last {totals?.days ?? 30}d)</div>
                <div style={styles.statValue}>{totals?.redeemedLastNDays ?? '-'}</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Top prize</div>
                <div style={styles.statValue} title={topPrizes?.[0]?.title || ''}>
                  {topPrizes?.[0]?.title ? (
                    <>
                      <span style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {topPrizes[0].title}
                      </span>{' '}
                      <Badge bg="secondary" pill style={{ marginLeft: 8 }}>
                        {topPrizes[0].count}
                      </Badge>
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
            </div>

            {/* Recent redemptions mini list */}
            <div style={{ marginTop: 12 }}>
              <div style={styles.miniTitle}>Recent Redemptions</div>

              {dashLoading ? (
                <div style={styles.miniMuted}>Loading…</div>
              ) : recent.length === 0 ? (
                <div style={styles.miniMuted}>No redemptions yet.</div>
              ) : (
                <div style={styles.recentList}>
                  {recent.map((r) => (
                    <div key={r.id} style={styles.recentItem}>
                      <div style={styles.recentLeft}>
                        <div style={styles.recentPrize}>{r.prize}</div>
                        <div style={styles.recentUser}>
                          {r.user?.name || 'User'} • {r.user?.email || '-'}
                        </div>
                      </div>
                      <div style={styles.recentRight}>
                        {r.redeemedAt ? new Date(r.redeemedAt).toLocaleString() : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <ToggleButtonGroup
              type="radio"
              name="scanMode"
              value={mode}
              onChange={(val) => {
                setMode(val);
                setError(null);
                setInfo(null);
                lastProcessedRef.current = null;
              }}
            >
              <ToggleButton
                id="mode-camera"
                value="camera"
                variant={mode === 'camera' ? 'danger' : 'outline-danger'}
                style={styles.toggleButton}
              >
                Camera Scan
              </ToggleButton>
              <ToggleButton
                id="mode-manual"
                value="manual"
                variant={mode === 'manual' ? 'danger' : 'outline-danger'}
                style={styles.toggleButton}
              >
                Manual Code
              </ToggleButton>
            </ToggleButtonGroup>
          </div>

          {/* Alerts */}
          {error && (
            <Alert
              variant="danger"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#fecaca',
              }}
            >
              {error}
            </Alert>
          )}

          {info && (
            <Alert
              variant="success"
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                borderColor: 'rgba(34, 197, 94, 0.4)',
                color: '#bbf7d0',
              }}
            >
              {info.message} <br />
              User: {info.user?.name} ({info.user?.email}) <br />
              Prize: {info.prize}
            </Alert>
          )}

          {/* Camera mode */}
          {mode === 'camera' && (
            <div>
              <div style={styles.scannerWrapper}>
                <div style={styles.scannerFrame}>
                  <Scanner
                    onScan={handleScanResults}
                    onError={(err) => {
                      console.log('QR scanner error:', err);
                    }}
                    components={{}}
                  />
                  {/* Corner highlights */}
                  <div style={{ ...styles.corner, ...styles.cornerTL }} />
                  <div style={{ ...styles.corner, ...styles.cornerTR }} />
                  <div style={{ ...styles.corner, ...styles.cornerBL }} />
                  <div style={{ ...styles.corner, ...styles.cornerBR }} />
                </div>
              </div>
              <p style={styles.helpText}>
                Point the camera at the customer&apos;s QR code. Redemption will be
                processed automatically.
              </p>
              {processing && (
                <p style={{ ...styles.helpText, color: '#bfdbfe' }}>
                  Processing scan… please wait.
                </p>
              )}
            </div>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <Form onSubmit={handleManualSubmit}>
              <Form.Group className="mb-3">
                <Form.Label style={styles.label}>QR Token / Code</Form.Label>
                <Form.Control
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="Paste code or full link here"
                />
              </Form.Group>
              <Button
                type="submit"
                className="w-100"
                disabled={processing}
                variant="danger"
                style={styles.submitButton}
              >
                {processing ? 'Processing…' : 'Redeem'}
              </Button>
              <p style={styles.helpText}>
                You can paste either the plain code or the full link
                <br />
                <code style={styles.codeExample}>
                  https://myproject-three-ecru.vercel.app/redeem/XXXX
                </code>
                .
              </p>
            </Form>
          )}

          {/* Footer helper */}
          <div style={styles.footer}>
            <p style={styles.footerText}>
              🔒 All redemptions are securely recorded against your vendor account.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg, #0b1120 0%, #111827 45%, #1e293b 80%, #7f1d1d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  wrapper: {
    width: '100%',
    maxWidth: '740px', // wider because dashboard is included
  },
  card: {
    background:
      'radial-gradient(circle at top, rgba(30,64,175,0.35), #020617 60%)',
    borderRadius: '24px',
    padding: '22px 20px 18px',
    border: '1px solid rgba(148,163,184,0.35)',
    boxShadow: '0 28px 80px rgba(15,23,42,0.9)',
    color: '#e5e7eb',
  },
  header: {
    textAlign: 'center',
    marginBottom: '14px',
  },
  logoBox: {
    width: '58px',
    height: '58px',
    background:
      'linear-gradient(135deg, #dc2626 0%, #991b1b 50%, #7f1d1d 100%)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 10px',
    boxShadow: '0 12px 32px rgba(248,113,113,0.8)',
  },
  logoIcon: {
    width: '30px',
    height: '30px',
    color: 'white',
  },
  title: {
    color: '#f9fafb',
    fontSize: '22px',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '0.03em',
  },
  subtitle: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: '13px',
    marginTop: 4,
    marginBottom: 0,
  },
  toggleButton: {
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: 999,
    paddingInline: 16,
  },

  // Dashboard styles
  dashCard: {
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    background: 'rgba(2,6,23,0.38)',
    border: '1px solid rgba(148,163,184,0.22)',
    boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
  },
  dashTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  dashTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: '#f9fafb',
    letterSpacing: '0.02em',
  },
  dashSub: {
    fontSize: 12,
    color: 'rgba(148,163,184,0.95)',
    marginTop: 2,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
    marginTop: 12,
  },
  statBox: {
    padding: 12,
    borderRadius: 16,
    background: 'rgba(15,23,42,0.55)',
    border: '1px solid rgba(148,163,184,0.18)',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.95)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    marginTop: 6,
    fontWeight: 900,
    color: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: '#f9fafb',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  miniMuted: {
    fontSize: 12,
    color: 'rgba(148,163,184,0.95)',
    marginTop: 8,
  },
  recentList: {
    marginTop: 8,
    display: 'grid',
    gap: 8,
  },
  recentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    background: 'rgba(15,23,42,0.45)',
    border: '1px solid rgba(148,163,184,0.14)',
    flexWrap: 'wrap',
  },
  recentLeft: { minWidth: 220 },
  recentPrize: { fontWeight: 900, color: '#f9fafb', fontSize: 13 },
  recentUser: { marginTop: 3, color: 'rgba(148,163,184,0.95)', fontSize: 12 },
  recentRight: { color: 'rgba(226,232,240,0.85)', fontSize: 12, textAlign: 'right' },

  scannerWrapper: {
    width: '100%',
    maxWidth: 380,
    margin: '0 auto',
    borderRadius: 24,
    padding: 10,
    background:
      'linear-gradient(135deg, rgba(30,64,175,0.3), rgba(220,38,38,0.25))',
  },
  scannerFrame: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    border: '2px solid rgba(15,23,42,0.9)',
    backgroundColor: '#020617',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#f97316',
    borderStyle: 'solid',
  },
  cornerTL: {
    top: 6,
    left: 6,
    borderWidth: '3px 0 0 3px',
  },
  cornerTR: {
    top: 6,
    right: 6,
    borderWidth: '3px 3px 0 0',
  },
  cornerBL: {
    bottom: 6,
    left: 6,
    borderWidth: '0 0 3px 3px',
  },
  cornerBR: {
    bottom: 6,
    right: 6,
    borderWidth: '0 3px 3px 0',
  },
  helpText: {
    marginTop: 10,
    marginBottom: 0,
    fontSize: '12px',
    color: 'rgba(148,163,184,0.95)',
    textAlign: 'center',
  },
  label: {
    color: '#e5e7eb',
    fontSize: '13px',
    fontWeight: 600,
  },
  input: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderColor: 'rgba(148,163,184,0.6)',
    color: '#e5e7eb',
    fontSize: '14px',
  },
  submitButton: {
    fontWeight: 600,
    borderRadius: 999,
    paddingBlock: 10,
    marginTop: 4,
  },
  codeExample: {
    fontSize: '11px',
    backgroundColor: 'rgba(15,23,42,0.9)',
    padding: '2px 6px',
    borderRadius: 6,
    display: 'inline-block',
    marginTop: 4,
    color: '#e5e7eb',
  },
  footer: {
    marginTop: 18,
    paddingTop: 12,
    borderTop: '1px solid rgba(30,64,175,0.5)',
  },
  footerText: {
    fontSize: '11px',
    color: 'rgba(148,163,184,0.9)',
    textAlign: 'center',
    margin: 0,
  },
};

export default VendorScanPage;
