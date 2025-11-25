// client/src/pages/vendor/VendorScanPage.jsx
import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { scanQrToken } from '../../api/vendorApi';
import { Card, Form, Button, Alert, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import { Scanner } from '@yudiel/react-qr-scanner';

const VendorScanPage = () => {
  const { token, profile } = useAuth();
  const [mode, setMode] = useState('camera'); // 'camera' | 'manual'

  const [qrToken, setQrToken] = useState('');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Prevent duplicate redemptions from the same scan
  const lastProcessedRef = useRef(null);

  const redeem = useCallback(
    async (tokenValue) => {
      const trimmed = (tokenValue || '').trim();
      if (!trimmed || processing) return;

      if (lastProcessedRef.current === trimmed) return;
      lastProcessedRef.current = trimmed;

      setProcessing(true);
      setError(null);
      setInfo(null);

      try {
        const res = await scanQrToken(token, trimmed);
        setInfo(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Scan failed');
      } finally {
        setProcessing(false);
      }
    },
    [processing, token]
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
      <h3 className="mb-3">Scan Prize (Vendor: {profile?.name})</h3>

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
          User: {info.user.name} ({info.user.email}) <br />
          Prize: {info.prize}
        </Alert>
      )}

      {mode === 'camera' && (
        <div>
          <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
            <Scanner
              onScan={handleScanResults}
              onError={(err) => {
                // Don’t spam; only log for debugging
                console.log(err);
              }}
              components={{}} // use default UI, you can customize later
            />
          </div>
          <p className="mt-2 small text-muted">
            Point the camera at the QR code. Once detected, redemption is processed automatically.
          </p>
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
          <p className="mt-2 small text-muted">
            Use this if the camera cannot scan or the customer only has a plain text code.
          </p>
        </Form>
      )}
    </Card>
  );
};

export default VendorScanPage;
