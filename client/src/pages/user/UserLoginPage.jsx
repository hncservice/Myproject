// client/src/pages/user/UserLoginPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../api/authApi';
import logo from '../../assets/logos.png';

const UserLoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (document.getElementById('user-login-page-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'user-login-page-styles';
    styleEl.textContent = `
      :root {
        --hnc-red: #dc2626;
        --hnc-red-dark: #991b1b;
        --hnc-bg: #020617;
      }

      .login-page {
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

      .login-bg-blob {
        position: absolute;
        border-radius: 999px;
        filter: blur(60px);
        opacity: 0.45;
        pointer-events: none;
        animation: float 10s ease-in-out infinite alternate;
      }

      .login-bg-blob--red {
        width: 320px;
        height: 320px;
        background: rgba(220, 38, 38, 0.6);
        top: -80px;
        right: -40px;
      }

      .login-bg-blob--blue {
        width: 260px;
        height: 260px;
        background: rgba(37, 99, 235, 0.5);
        bottom: -60px;
        left: -80px;
        animation-delay: 1.5s;
      }

      .login-wrapper {
        width: 100%;
        max-width: 480px;
        position: relative;
        z-index: 1;
      }

      .login-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        text-align: center;
        animation: fadeInDown 0.7s ease-out;
      }

      .login-logo-container {
        background: rgba(15, 23, 42, 0.7);
        border-radius: 999px;
        padding: 8px 16px;
        box-shadow: 0 10px 35px rgba(15, 23, 42, 0.8);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(12px);
      }

      .login-logo {
        height: 42px;
        width: auto;
        display: block;
      }

      .login-header-title {
        color: #f9fafb;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .login-header-subtitle {
        color: rgba(226, 232, 240, 0.7);
        font-size: 13px;
      }

      .login-card {
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

      .login-card-pill {
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

      .login-card-pill-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
      }

      .login-title {
        font-size: 24px;
        font-weight: 700;
        color: #f9fafb;
        margin: 0 0 4px;
        letter-spacing: 0.02em;
      }

      .login-subtitle {
        margin: 0;
        font-size: 13px;
        color: rgba(148, 163, 184, 0.9);
      }

      .login-alert {
        border-radius: 14px;
        padding: 10px 11px;
        font-size: 13px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 14px;
      }

      .login-alert--success {
        background: rgba(22, 163, 74, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.45);
        color: #4ade80;
      }

      .login-alert--error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fb7185;
      }

      .login-alert-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .login-form-group { margin-bottom: 16px; }

      .login-label {
        display: flex;
        align-items: center;
        gap: 6px;
        color: rgba(226, 232, 240, 0.92);
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .login-input-wrapper { position: relative; }

      .login-input-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 19px;
        height: 19px;
        color: rgba(248, 113, 113, 0.9);
        pointer-events: none;
      }

      .login-input {
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

      /* password field has right button */
      .login-input--pwd { padding-right: 46px; }

      .login-input::placeholder { color: rgba(148, 163, 184, 0.85); }

      .login-input:focus {
        border-color: rgba(248, 113, 113, 0.95);
        box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.8), 0 0 0 6px rgba(248, 113, 113, 0.22);
        background: rgba(15, 23, 42, 1);
        transform: translateY(-1px);
      }

      .login-input-action {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 34px;
        height: 34px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(248, 250, 252, 0.06);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
      }

      .login-input-action:hover {
        transform: translateY(-50%) scale(1.03);
        background: rgba(248, 250, 252, 0.10);
        border-color: rgba(248, 113, 113, 0.45);
      }

      .login-input-action:active { transform: translateY(-50%) scale(0.98); }

      .login-input-action svg {
        width: 18px;
        height: 18px;
        color: rgba(226, 232, 240, 0.85);
      }

      .login-button {
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

      .login-button:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.01);
        box-shadow:
          0 20px 40px rgba(248, 113, 113, 0.6),
          0 0 0 1px rgba(248, 113, 113, 0.55);
        filter: brightness(1.02);
      }

      .login-button:active:not(:disabled) {
        transform: translateY(0) scale(0.99);
        box-shadow: 0 12px 26px rgba(248, 113, 113, 0.5);
      }

      .login-button:disabled {
        cursor: not-allowed;
        opacity: 0.8;
        box-shadow: 0 10px 22px rgba(148, 163, 184, 0.4);
      }

      .login-spinner {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        animation: spin 0.65s linear infinite;
      }

      .login-footer {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px dashed rgba(148, 163, 184, 0.35);
        text-align: center;
        font-size: 12px;
        color: rgba(148, 163, 184, 0.95);
      }

      .login-footer-link {
        color: #fca5a5;
        font-weight: 700;
        text-decoration: none;
        margin-left: 6px;
      }

      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeInUp { from { opacity: 0; transform: translate3d(0, 18px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
      @keyframes fadeInDown { from { opacity: 0; transform: translate3d(0, -16px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
      @keyframes float { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(0, -18px, 0); } }

      @media (max-width: 480px) {
        .login-card { padding: 22px 18px 18px; border-radius: 20px; }
        .login-title { font-size: 21px; }
        .login-header-title { font-size: 18px; }
        .login-logo { height: 38px; }
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

    const payload = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!payload.email || !emailRegex.test(payload.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!payload.password || payload.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      // ✅ backend should: validate email exists + password correct, then send OTP to email
      await loginUser(payload);

      setMsg('OTP sent to your email successfully!');
      setTimeout(() => {
        // ✅ VerifyOtpPage will do final login and redirect to /monkey-game
        navigate('/verify-otp', { state: { email: payload.email } });
      }, 700);
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || 'Login failed';
      setError(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-blob login-bg-blob--red" />
      <div className="login-bg-blob login-bg-blob--blue" />

      <div className="login-wrapper">
        <header className="login-header">
          <div className="login-logo-container">
            <img src={logo} alt="HNC Logo" className="login-logo" />
          </div>
          <div>
            <div className="login-header-title">HNC Rewards</div>
            <div className="login-header-subtitle">
              Login to continue remaining chances & view your prize QR
            </div>
          </div>
        </header>

        <div className="login-card">
          <div className="login-card-pill">
            <span className="login-card-pill-dot" />
            <span>Password + OTP Login</span>
          </div>

          <h2 className="login-title">User Login</h2>
          <p className="login-subtitle">
            Enter your email &amp; password. We will send an OTP to confirm login.
          </p>

          {msg && (
            <div className="login-alert login-alert--success">
              <svg className="login-alert-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span>{msg}</span>
            </div>
          )}

          {error && (
            <div className="login-alert login-alert--error">
              <svg className="login-alert-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="login-form-group">
              <label className="login-label">Email Address</label>
              <div className="login-input-wrapper">
                <svg className="login-input-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder="your.email@example.com"
                  className="login-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-form-group">
              <label className="login-label">Password</label>
              <div className="login-input-wrapper">
                <svg className="login-input-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4V6zm3 9.73V17a1 1 0 1 1-2 0v-1.27a2 2 0 1 1 2 0z" />
                </svg>

                <input
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="login-input login-input--pwd"
                />

                <button
                  type="button"
                  className="login-input-action"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPwd((s) => !s)}
                >
                  {showPwd ? (
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 6c-4.41 0-8.2 2.72-10 6.5C3.8 16.28 7.59 19 12 19s8.2-2.72 10-6.5C20.2 8.72 16.41 6 12 6zm0 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
                      <path d="M12 9.5A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5z" />
                    </svg>
                  ) : (
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 3l18 18-1.4 1.4-2.06-2.06C16 21.25 14.07 22 12 22 6.72 22 2.18 18.79.5 14c.62-1.78 1.66-3.36 3.04-4.73L1.6 4.4 3 3zm9 6c-.34 0-.66.06-.97.17l3.3 3.3c.11-.31.17-.63.17-.97A2.5 2.5 0 0 0 12 9.5zM12 6c4.41 0 8.2 2.72 10 6.5-.62 1.78-1.66 3.36-3.04 4.73l-1.46-1.46A8.67 8.67 0 0 0 21.5 12.5C19.93 9.32 16.32 7 12 7c-1.1 0-2.16.15-3.16.43L7.4 5.97A11.55 11.55 0 0 1 12 6z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="login-button">
              {loading ? (
                <>
                  <span className="login-spinner" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <span>Login &amp; Send OTP</span>
              )}
            </button>
          </form>

          <div className="login-footer">
            <span>New user?</span>
            <a
              className="login-footer-link"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
            >
              Register
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLoginPage;
