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
    <Card className="p-4">
      <h3 className="mb-3">Scan Prize (Vendor: {profile?.name || 'Unknown'})</h3>

      <ToggleButtonGroup
        type="radio"
        name="scanMode"
        value={mode}
        className="mb-3"
        onChange={(val) => {
          setMode(val);
          setError(null);
          setInfo(null);
          lastProcessedRef.current = null;
        }}
      >
        <ToggleButton id="mode-camera" value="camera" variant="outline-primary">
          Camera Scan
        </ToggleButton>
        <ToggleButton id="mode-manual" value="manual" variant="outline-primary">
          Manual Code
        </ToggleButton>
      </ToggleButtonGroup>

      {error && <Alert variant="danger">{error}</Alert>}

      {info && (
        <Alert variant="success">
          {info.message} <br />
          User: {info.user?.name} ({info.user?.email}) <br />
          Prize: {info.prize}
        </Alert>
      )}

      {mode === 'camera' && (
        <div>
          <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
            <Scanner
              onScan={handleScanResults}
              onError={(err) => {
                console.log('QR scanner error:', err);
              }}
              components={{}} // default UI
            />
          </div>
          <p className="mt-2 small text-muted">
            Point the camera at the QR code. Once detected, redemption is processed
            automatically.
          </p>
          {processing && (
            <p className="small text-primary mb-0">
              Processing scan… please wait.
            </p>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <Form onSubmit={handleManualSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>QR Token / Code</Form.Label>
            <Form.Control
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              required
            />
          </Form.Group>
          <Button type="submit" className="w-100" disabled={processing}>
            {processing ? 'Processing…' : 'Redeem'}
          </Button>
          <p className="mt-2 small text-muted mb-0">
            You can paste either the plain code or the full link
            (https://.../redeem/XXXX) here.
          </p>
        </Form>
      )}
    </Card>
  );
};

export default VendorScanPage;
