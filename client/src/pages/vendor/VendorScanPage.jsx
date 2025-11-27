// client/src/pages/vendor/VendorScanPage.jsx
import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { scanQrToken } from '../../api/vendorApi';
import {
  Card,
  Form,
  Button,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
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
      const segments = url.pathname.split('/').filter(Boolean); // remove empty parts
      // e.g. /redeem/492c... -> ['redeem', '492c...']
      return segments[segments.length - 1] || '';
    } catch (e) {
      console.warn('Failed to parse QR URL, falling back to raw:', e);
      return trimmed;
    }
  }

  // otherwise assume it's already the token
  return trimmed;
};

const VendorScanPage = () => {
  const { profile } = useAuth();
  const [mode, setMode] = useState('camera'); // 'camera' | 'manual'

  const [qrToken, setQrToken] = useState('');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Prevent duplicate redemptions from the same scanned token
  const lastProcessedRef = useRef(null);

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
        const res = await scanQrToken(extracted); // 👈 send pure token
        setInfo(res.data);
        setQrToken(extracted); // show clean token in input
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Scan failed. Please try again.';
        setError(msg);
      } finally {
        setProcessing(false);
      }
    },
    [processing]
  );

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    await redeem(qrToken);
  };

  const handleScanResults = (results) => {
    // `results` is an array; we use the first QR found
    if (!results || results.length === 0) return;
    const text = results[0]?.rawValue || results[0]?.raw || results[0]?.value;
    if (!text) return;

    setQrToken(text);
    redeem(text);
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <Card style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.logoBox}>
              <svg
                style={styles.logoIcon}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
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
                    components={{}} // default UI
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
    maxWidth: '520px',
  },
  card: {
    background:
      'radial-gradient(circle at top, rgba(30,64,175,0.35), #020617 60%)',
    borderRadius: '24px',
    padding: '28px 24px 22px',
    border: '1px solid rgba(148,163,184,0.35)',
    boxShadow: '0 28px 80px rgba(15,23,42,0.9)',
    color: '#e5e7eb',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
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
    margin: '0 auto 12px',
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
  },
  toggleButton: {
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: 999,
    paddingInline: 16,
  },
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

// Optional: add some focus / hover global styles
const styleSheet = document.createElement('style');
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

export default VendorScanPage;
