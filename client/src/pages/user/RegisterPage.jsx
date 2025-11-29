import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../../api/authApi';
import logo from '../../assets/logos.png';

const RegisterPage = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Inject page-specific styles once
  useEffect(() => {
    if (document.getElementById('register-page-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'register-page-styles';
    styleEl.textContent = `
      :root {
        --hnc-red: #dc2626;
        --hnc-red-dark: #991b1b;
        --hnc-bg: #020617;
      }

      .register-page {
        min-height: 100vh;
        width: 100%;
        padding: 16px 16px 32px;
        box-sizing: border-box;
        background: radial-gradient(circle at top, #1f2937 0, #020617 55%, #020617 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        position: relative;
        overflow: hidden;
      }

      /* Floating background blobs */
      .register-bg-blob {
        position: absolute;
        border-radius: 999px;
        filter: blur(60px);
        opacity: 0.45;
        pointer-events: none;
        animation: float 10s ease-in-out infinite alternate;
      }

      .register-bg-blob--red {
        width: 320px;
        height: 320px;
        background: rgba(220, 38, 38, 0.6);
        top: -80px;
        right: -40px;
      }

      .register-bg-blob--blue {
        width: 260px;
        height: 260px;
        background: rgba(37, 99, 235, 0.5);
        bottom: -60px;
        left: -80px;
        animation-delay: 1.5s;
      }

      .register-wrapper {
        width: 100%;
        max-width: 480px;
        position: relative;
        z-index: 1;
      }

      .register-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        text-align: center;
        animation: fadeInDown 0.7s ease-out;
      }

      .register-logo-container {
        background: rgba(15, 23, 42, 0.7);
        border-radius: 999px;
        padding: 8px 16px;
        box-shadow: 0 10px 35px rgba(15, 23, 42, 0.8);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(12px);
      }

      .register-logo {
        height: 42px;
        width: auto;
        display: block;
      }

      .register-header-title {
        color: #f9fafb;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .register-header-subtitle {
        color: rgba(226, 232, 240, 0.7);
        font-size: 13px;
      }

      .register-card {
        background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.98));
        border-radius: 24px;
        padding: 28px 24px 22px;
        box-shadow:
          0 24px 60px rgba(0, 0, 0, 0.7),
          0 0 0 1px rgba(148, 163, 184, 0.25);
        border: 1px solid rgba(248, 113, 113, 0.18);
        backdrop-filter: blur(22px);
        color: #e5e7eb;
        animation: fadeInUp 0.65s ease-out;
      }

      .register-card-header {
        text-align: left;
        margin-bottom: 20px;
      }

      .register-card-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(248, 250, 252, 0.04);
        border: 1px solid rgba(148, 163, 184, 0.35);
        font-size: 11px;
        color: rgba(148, 163, 184, 0.95);
        margin-bottom: 10px;
      }

      .register-card-pill-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
      }

      .register-title {
        font-size: 24px;
        font-weight: 700;
        color: #f9fafb;
        margin: 0 0 4px;
        letter-spacing: 0.02em;
      }

      .register-subtitle {
        margin: 0;
        font-size: 13px;
        color: rgba(148, 163, 184, 0.9);
      }

      .register-alert {
        border-radius: 14px;
        padding: 10px 11px;
        font-size: 13px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 14px;
      }

      .register-alert--success {
        background: rgba(22, 163, 74, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.45);
        color: #4ade80;
      }

      .register-alert--error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fb7185;
      }

      .register-alert-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .register-form-group {
        margin-bottom: 16px;
      }

      .register-label {
        display: flex;
        align-items: center;
        gap: 4px;
        color: rgba(226, 232, 240, 0.92);
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .register-label-optional {
        color: rgba(148, 163, 184, 0.8);
        font-weight: 400;
      }

      .register-input-wrapper {
        position: relative;
      }

      .register-input-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 19px;
        height: 19px;
        color: rgba(248, 113, 113, 0.9);
        pointer-events: none;
      }

      .register-input {
        width: 100%;
        padding: 11px 14px 11px 44px;
        background: rgba(15, 23, 42, 0.9);
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.55);
        color: #f9fafb;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.1s ease;
      }

      .register-input::placeholder {
        color: rgba(148, 163, 184, 0.85);
      }

      .register-input:focus {
        border-color: rgba(248, 113, 113, 0.95);
        box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.8), 0 0 0 6px rgba(248, 113, 113, 0.22);
        background: rgba(15, 23, 42, 1);
        transform: translateY(-1px);
      }

      .register-button {
        width: 100%;
        margin-top: 6px;
        padding: 13px 14px;
        border-radius: 999px;
        border: none;
        outline: none;
        background: linear-gradient(135deg, var(--hnc-red) 0%, var(--hnc-red-dark) 100%);
        color: #fef2f2;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        cursor: pointer;
        box-shadow:
          0 16px 35px rgba(248, 113, 113, 0.5),
          0 0 0 1px rgba(248, 113, 113, 0.4);
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        position: relative;
        overflow: hidden;
      }

      .register-button span,
      .register-button svg {
        position: relative;
        z-index: 1;
      }

      .register-button::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 0 0, rgba(255, 255, 255, 0.3), transparent 55%);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .register-button:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.01);
        box-shadow:
          0 20px 40px rgba(248, 113, 113, 0.6),
          0 0 0 1px rgba(248, 113, 113, 0.55);
        filter: brightness(1.02);
      }

      .register-button:hover::before {
        opacity: 1;
      }

      .register-button:active:not(:disabled) {
        transform: translateY(0) scale(0.99);
        box-shadow: 0 12px 26px rgba(248, 113, 113, 0.5);
      }

      .register-button:disabled {
        cursor: not-allowed;
        opacity: 0.8;
        box-shadow: 0 10px 22px rgba(148, 163, 184, 0.4);
        filter: grayscale(0.1);
      }

      .register-button-icon {
        width: 18px;
        height: 18px;
      }

      .register-spinner {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        animation: spin 0.65s linear infinite;
      }

      .register-footer {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px dashed rgba(148, 163, 184, 0.35);
        text-align: center;
        font-size: 12px;
        color: rgba(148, 163, 184, 0.95);
      }

      .register-footer span {
        opacity: 0.9;
      }

      .register-footer-link {
        color: #fca5a5;
        font-weight: 600;
        text-decoration: none;
        margin-left: 4px;
        position: relative;
      }

      .register-footer-link::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: -2px;
        width: 100%;
        height: 1px;
        background: linear-gradient(90deg, rgba(248, 113, 113, 1), transparent);
        transform-origin: left;
        transform: scaleX(0);
        transition: transform 0.2s ease;
      }

      .register-footer-link:hover::after {
        transform: scaleX(1);
      }

      .register-footer-link:hover {
        color: #fecaca;
      }

      /* Animations */
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translate3d(0, 18px, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @keyframes fadeInDown {
        from {
          opacity: 0;
          transform: translate3d(0, -16px, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @keyframes float {
        from { transform: translate3d(0, 0, 0); }
        to { transform: translate3d(0, -18px, 0); }
      }

      /* Mobile tweaks */
      @media (max-width: 480px) {
        .register-page {
          padding: 12px 12px 20px;
        }
        .register-card {
          padding: 22px 18px 18px;
          border-radius: 20px;
        }
        .register-title {
          font-size: 21px;
        }
        .register-header-title {
          font-size: 18px;
        }
        .register-logo {
          height: 38px;
        }
      }

      @media (min-height: 720px) and (max-width: 480px) {
        .register-wrapper {
          transform: translateY(-10px);
        }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

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

      await registerUser(payload);
      setMsg('OTP sent to your email successfully!');

      setTimeout(() => {
        navigate('/verify-otp', { state: { email: payload.email } });
      }, 1000);
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed';
      setError(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      {/* Floating background blobs */}
      <div className="register-bg-blob register-bg-blob--red" />
      <div className="register-bg-blob register-bg-blob--blue" />

      <div className="register-wrapper">
        {/* Top logo + brand */}
        <header className="register-header">
          <div className="register-logo-container">
            <img src={logo} alt="HNC Logo" className="register-logo" />
          </div>
          <div>
            <div className="register-header-title">HNC Rewards</div>
            <div className="register-header-subtitle">
              Create your account to unlock offers & spins
            </div>
          </div>
        </header>

        <div className="register-card">
          {/* Card header */}
          <div className="register-card-header">
            <div className="register-card-pill">
              <span className="register-card-pill-dot" />
              <span>Secure OTP registration</span>
            </div>
            <h2 className="register-title">Create Account</h2>
            <p className="register-subtitle">
              Enter your details to receive a one-time password (OTP) on your email.
            </p>
          </div>

          {/* Alerts */}
          {msg && (
            <div className="register-alert register-alert--success">
              <svg
                className="register-alert-icon"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span>{msg}</span>
            </div>
          )}

          {error && (
            <div className="register-alert register-alert--error">
              <svg
                className="register-alert-icon"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="register-form-group">
              <label className="register-label">
                <span>Full Name</span>
              </label>
              <div className="register-input-wrapper">
                <svg
                  className="register-input-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                  placeholder="Enter your full name"
                  className="register-input"
                />
              </div>
            </div>

            <div className="register-form-group">
              <label className="register-label">
                <span>Email Address</span>
              </label>
              <div className="register-input-wrapper">
                <svg
                  className="register-input-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                  placeholder="your.email@example.com"
                  className="register-input"
                />
              </div>
            </div>

            <div className="register-form-group">
              <label className="register-label">
                <span>Phone Number</span>
                <span className="register-label-optional">(optional)</span>
              </label>
              <div className="register-input-wrapper">
                <svg
                  className="register-input-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  placeholder="+974 0000 0000"
                  className="register-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="register-button"
            >
              {loading ? (
                <>
                  <span className="register-spinner" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <span>Register &amp; Get OTP</span>
                  <svg
                    className="register-button-icon"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="register-footer">
            <span>DOWNLOAD HNC APP?</span>
            <a
              href="https://onelink.to/c8p8b8"
              className="register-footer-link"
              target="_blank"
              rel="noreferrer"
            >
              Click here
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
