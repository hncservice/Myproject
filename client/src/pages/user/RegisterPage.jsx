import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../../api/authApi';

const RegisterPage = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setMsg(null);
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      };

      if (!payload.name || payload.name.length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        setLoading(false);
        return;
      }

      if (!payload.email) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      // ✅ Call real API
      await registerUser(payload);
      setMsg('OTP sent to your email successfully!');

      // ✅ After short delay, go to verify-otp with email in state
      setTimeout(() => {
        navigate('/verify-otp', { state: { email: payload.email } });
      }, 1000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.iconBox}>
              <svg style={styles.icon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <h2 style={styles.title}>Create Account</h2>
            <p style={styles.subtitle}>Register to get started with your journey</p>
          </div>

          {/* Alerts */}
          {msg && (
            <div style={styles.alertSuccess}>
              <svg style={styles.alertIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {msg}
            </div>
          )}

          {error && (
            <div style={styles.alertError}>
              <svg style={styles.alertIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              {error}
            </div>
          )}

          {/* ✅ Proper form */}
          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                  placeholder="Enter your full name"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                  placeholder="your.email@example.com"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Phone Number <span style={styles.optional}>(optional)</span>
              </label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  placeholder="+974 0000 0000"
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? (
                <>
                  <span style={styles.spinner}></span>
                  Sending OTP...
                </>
              ) : (
                <>
                  Register &amp; Get OTP
                  <svg style={styles.buttonIcon} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={styles.footer}>
            <p style={styles.footerText}>
              DOWNLOAD HNC APP?{' '}
              <a href="https://onelink.to/c8p8b8" style={styles.link}>
                Click Here..
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #113761ff 0%, #263b5eff 50%, #401764ff 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  wrapper: {
    width: '100%',
    maxWidth: '480px',
  },
  card: {
    background: 'rgba(20, 39, 80, 0.95)',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
    border: '1px solid rgba(220, 38, 38, 0.15)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  iconBox: {
    width: '70px',
    height: '70px',
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 24px rgba(220, 38, 38, 0.4)',
  },
  icon: {
    width: '36px',
    height: '36px',
    color: 'white',
  },
  title: {
    color: 'white',
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 6px 0',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    margin: 0,
  },
  alertSuccess: {
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '10px',
    color: '#4ade80',
    marginBottom: '20px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
  },
  alertError: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px',
    color: '#f87171',
    marginBottom: '20px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
  },
  alertIcon: {
    width: '18px',
    height: '18px',
    flexShrink: 0,
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '6px',
  },
  optional: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '400',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '20px',
    height: '20px',
    color: '#dc2626',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 44px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(233, 10, 10, 0.2)',
    borderRadius: '20px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 8px 24px rgba(220, 38, 38, 0.3)',
    marginTop: '24px',
  },
  buttonDisabled: {
    background: 'rgba(153, 27, 27, 0.6)',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  buttonIcon: {
    width: '18px',
    height: '18px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  footer: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '13px',
    margin: 0,
  },
  link: {
    color: '#dc2626',
    textDecoration: 'none',
    fontWeight: '600',
  },
};

// inject styles once
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  input:focus {
    border-color: #dc2626 !important;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15) !important;
  }
  button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(220, 38, 38, 0.4) !important;
  }
  a:hover {
    color: #ef4444 !important;
  }
  @media (max-width: 576px) {
    .card { padding: 24px !important; }
    h2 { font-size: 24px !important; }
  }
`;
document.head.appendChild(styleSheet);

export default RegisterPage;
