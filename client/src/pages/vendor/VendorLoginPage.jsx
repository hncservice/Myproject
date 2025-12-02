// client/src/pages/vendor/VendorLoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginVendor } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import logo from '../../assets/logos.png';

const VendorLoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // prevent double submit

    setError(null);
    setLoading(true);

    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      if (!payload.email || !payload.password) {
        setError('Please enter both email and password.');
        setLoading(false);
        return;
      }

      const res = await loginVendor(payload);
      const { token, vendor } = res.data || {};

      if (!token || !vendor) {
        throw new Error('Invalid response from server');
      }

      login('vendor', token, vendor);
      navigate('/vendor/scan');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <Card style={styles.card}>
          {/* Logo + title */}
          <div style={styles.header}>
            <img
              src={logo} // 👈 change path if needed
              alt="Logo"
              style={styles.logoImg}
            />
            <h2 style={styles.title}>Vendor Login</h2>
            <p style={styles.subtitle}>
              Access your vendor dashboard to scan and redeem prizes.
            </p>
          </div>

          {error && (
            <Alert
              variant="danger"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#fecaca',
                fontSize: '13px',
              }}
            >
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group className="mb-3" controlId="vendorLoginEmail">
              <Form.Label style={styles.label}>Email</Form.Label>
              <Form.Control
                name="email"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="vendor@example.com"
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="vendorLoginPassword">
              <Form.Label style={styles.label}>Password</Form.Label>
              <Form.Control
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                required
                style={styles.input}
                placeholder="Enter your password"
              />
            </Form.Group>

            <Button
              type="submit"
              className="w-100"
              disabled={loading}
              variant="danger"
              style={styles.button}
            >
              {loading ? 'Logging in…' : 'Login'}
            </Button>

            <p style={styles.footerText}>
              Having trouble logging in? Please contact the admin team.
            </p>
          </Form>
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
    maxWidth: '460px',
  },
  card: {
    background:
      'radial-gradient(circle at top, rgba(30,64,175,0.35), #020617 60%)',
    borderRadius: '24px',
    padding: '30px 26px 22px',
    border: '1px solid rgba(148,163,184,0.35)',
    boxShadow: '0 28px 80px rgba(15,23,42,0.9)',
    color: '#e5e7eb',
  },
  header: {
    textAlign: 'center',
    marginBottom: 24,
  },
  logoImg: {
    width: 80,
    height: 80,
    objectFit: 'contain',
    marginBottom: 10,
    borderRadius: '999px',
    backgroundColor: 'rgba(15,23,42,0.9)',
    padding: 8,
    boxShadow: '0 10px 26px rgba(248,113,113,0.7)',
  },
  title: {
    color: '#f9fafb',
    fontSize: '24px',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '0.04em',
  },
  subtitle: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: '13px',
    marginTop: 6,
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
  button: {
    fontWeight: 600,
    borderRadius: 999,
    paddingBlock: 10,
    marginTop: 6,
  },
  footerText: {
    marginTop: 14,
    fontSize: '12px',
    color: 'rgba(148,163,184,0.9)',
    textAlign: 'center',
  },
};

// Focus / hover global tweaks
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .form-control:focus {
    border-color: #dc2626 !important;
    box-shadow: 0 0 0 0.15rem rgba(220, 38, 38, 0.35) !important;
    background-color: rgba(15,23,42,1) !important;
    color: #e5e7eb !important;
  }
  .btn-danger {
    background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%) !important;
    border: none !important;
    box-shadow: 0 10px 28px rgba(248,113,113,0.8);
  }
  .btn-danger:hover:not(:disabled) {
    background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%) !important;
    box-shadow: 0 14px 36px rgba(248,113,113,0.9);
    transform: translateY(-1px);
  }
`;
document.head.appendChild(styleSheet);

export default VendorLoginPage;
