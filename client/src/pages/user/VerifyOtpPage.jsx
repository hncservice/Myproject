// client/src/pages/user/VerifyOtpPage.jsx
import React, { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { verifyOtp } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { Form, Button, Alert, Card } from 'react-bootstrap';

const VerifyOtpPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const emailFromState = location.state?.email;

  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // If user came here without an email in state, send them back to register
  if (!emailFromState) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const trimmedOtp = otp.trim();

      if (!trimmedOtp || trimmedOtp.length !== 6) {
        setError('Please enter the 6-digit OTP.');
        setLoading(false);
        return;
      }

      const payload = {
        email: emailFromState.toLowerCase(),
        otp: trimmedOtp,
      };

      const res = await verifyOtp(payload);
      const { token, user } = res.data || {};

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      login('user', token, user);
      navigate('/spin');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'OTP verification failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="mb-3">Verify OTP</h3>

      <Alert variant="info">
        OTP sent to: <strong>{emailFromState}</strong>
      </Alert>

      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3" controlId="verifyOtpInput">
          <Form.Label>Enter OTP</Form.Label>
          <Form.Control
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
          <Form.Text className="text-muted">
            Check your email for a 6-digit code. The code expires in 10 minutes.
          </Form.Text>
        </Form.Group>

        <Button type="submit" className="w-100" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </Form>
    </Card>
  );
};

export default VerifyOtpPage;
