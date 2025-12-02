// client/src/pages/admin/AdminLoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';


const AdminLoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Inject page-specific styles once
  useEffect(() => {
    if (document.getElementById('admin-login-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'admin-login-styles';
    styleEl.textContent = `
      .admin-login-page {
        min-height: calc(100vh - 64px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px 0 32px;
        position: relative;
        overflow: hidden;
      }

      .admin-login-wrapper {
        width: 100%;
        max-width: 420px;
        position: relative;
        z-index: 1;
        animation: adminFadeInUp 0.6s ease-out;
      }

      /* Background orbits / glow */
      .admin-login-orbit {
        position: absolute;
        border-radius: 999px;
        filter: blur(70px);
        opacity: 0.55;
        pointer-events: none;
        animation: adminFloat 9s ease-in-out infinite alternate;
      }

      .admin-login-orbit--red {
        width: 280px;
        height: 280px;
        background: rgba(248, 113, 113, 0.8);
        top: -80px;
        right: -40px;
      }

      .admin-login-orbit--blue {
        width: 240px;
        height: 240px;
        background: rgba(59, 130, 246, 0.7);
        bottom: -80px;
        left: -60px;
        animation-delay: 1.4s;
      }

      .admin-login-card {
        background: radial-gradient(circle at top left, rgba(31, 41, 55, 0.98), rgba(15, 23, 42, 0.98));
        border-radius: 24px;
        padding: 26px 22px 22px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        box-shadow:
          0 26px 60px rgba(0, 0, 0, 0.85),
          0 0 0 1px rgba(248, 113, 113, 0.18);
        backdrop-filter: blur(22px);
        color: #e5e7eb;
      }

      .admin-login-header {
        margin-bottom: 20px;
      }

      .admin-login-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(248, 113, 113, 0.8);
        background: rgba(24, 24, 27, 0.85);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #fecaca;
        margin-bottom: 10px;
      }

      .admin-login-pill-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.25);
      }

      .admin-login-title {
        font-size: 22px;
        font-weight: 700;
        margin: 0 0 4px;
        color: #f9fafb;
      }

      .admin-login-subtitle {
        margin: 0;
        font-size: 13px;
        color: rgba(148, 163, 184, 0.95);
      }

      .admin-login-alert {
        border-radius: 14px;
        padding: 10px 11px;
        font-size: 13px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 14px;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fb7185;
      }

      .admin-login-alert-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .admin-login-form-group {
        margin-bottom: 16px;
      }

      .admin-login-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: rgba(226, 232, 240, 0.92);
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .admin-login-label-hint {
        font-size: 11px;
        color: rgba(148, 163, 184, 0.85);
        font-weight: 400;
      }

      .admin-login-input-wrap {
        position: relative;
      }

      .admin-login-input-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        height: 18px;
        color: rgba(248, 113, 113, 0.95);
        pointer-events: none;
      }

      .admin-login-input {
        width: 100%;
        padding: 10px 14px 10px 42px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.7);
        background: rgba(15, 23, 42, 0.96);
        color: #f9fafb;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.12s ease;
      }

      .admin-login-input::placeholder {
        color: rgba(148, 163, 184, 0.9);
      }

      .admin-login-input:focus {
        border-color: rgba(248, 113, 113, 0.95);
        box-shadow:
          0 0 0 1px rgba(248, 113, 113, 0.9),
          0 0 0 6px rgba(248, 113, 113, 0.22);
        background: rgba(15, 23, 42, 1);
        transform: translateY(-1px);
      }

      .admin-login-button {
        width: 100%;
        margin-top: 6px;
        padding: 11px 14px;
        border-radius: 999px;
        border: none;
        outline: none;
        background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
        color: #fef2f2;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        box-shadow:
          0 16px 36px rgba(248, 113, 113, 0.55),
          0 0 0 1px rgba(248, 113, 113, 0.45);
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        position: relative;
        overflow: hidden;
      }

      .admin-login-button span,
      .admin-login-button svg {
        position: relative;
        z-index: 1;
      }

      .admin-login-button::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 0 0, rgba(255, 255, 255, 0.3), transparent 55%);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .admin-login-button:hover:not(:disabled) {
        transform: translateY(-2px) scale(1.01);
        box-shadow:
          0 20px 42px rgba(248, 113, 113, 0.65),
          0 0 0 1px rgba(248, 113, 113, 0.6);
        filter: brightness(1.02);
      }

      .admin-login-button:hover::before {
        opacity: 1;
      }

      .admin-login-button:active:not(:disabled) {
        transform: translateY(0) scale(0.99);
        box-shadow: 0 12px 28px rgba(248, 113, 113, 0.5);
      }

      .admin-login-button:disabled {
        cursor: not-allowed;
        opacity: 0.9;
        box-shadow: 0 10px 24px rgba(148, 163, 184, 0.45);
        filter: grayscale(0.1);
      }

      .admin-login-button-icon {
        width: 18px;
        height: 18px;
      }

      .admin-login-spinner {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        animation: adminSpin 0.65s linear infinite;
      }

      .admin-login-footer {
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px dashed rgba(75, 85, 99, 0.7);
        font-size: 11px;
        color: rgba(148, 163, 184, 0.9);
        text-align: center;
      }

      .admin-login-footer-strong {
        color: #fecaca;
        font-weight: 600;
      }

      /* Animations */
      @keyframes adminSpin {
        to { transform: rotate(360deg); }
      }

      @keyframes adminFadeInUp {
        from {
          opacity: 0;
          transform: translate3d(0, 20px, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }

      @keyframes adminFloat {
        from { transform: translate3d(0, 0, 0); }
        to { transform: translate3d(0, -16px, 0); }
      }

      @media (max-width: 576px) {
        .admin-login-page {
          padding-top: 4px;
        }
        .admin-login-card {
          padding: 22px 18px 18px;
          border-radius: 20px;
        }
        .admin-login-title {
          font-size: 20px;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

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

      const res = await loginAdmin(payload);
      const { token, admin } = res.data || {};

      if (!token || !admin) {
        throw new Error('Invalid response from server');
      }

      login('admin', token, admin);
      navigate('/admin/vendors');
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
    <div className="admin-login-page">
      {/* background motion glows */}
      <div className="admin-login-orbit admin-login-orbit--red" />
      <div className="admin-login-orbit admin-login-orbit--blue" />

      <div className="admin-login-wrapper">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <div className="admin-login-pill">
              <span className="admin-login-pill-dot" />
              <span>Admin Panel</span>
            </div>
            <h3 className="admin-login-title">Admin Login</h3>
            <p className="admin-login-subtitle">
              Sign in with your admin credentials to manage vendors, wheel items & reports.
            </p>
          </div>

          {error && (
            <div className="admin-login-alert">
              <svg
                className="admin-login-alert-icon"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="admin-login-form-group">
              <label htmlFor="admin-email" className="admin-login-label">
                <span>Email</span>
                <span className="admin-login-label-hint">Admin account only</span>
              </label>
              <div className="admin-login-input-wrap">
                <svg
                  className="admin-login-input-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="admin@example.com"
                  className="admin-login-input"
                />
              </div>
            </div>

            <div className="admin-login-form-group">
              <label htmlFor="admin-password" className="admin-login-label">
                <span>Password</span>
                <span className="admin-login-label-hint">Keep it confidential</span>
              </label>
              <div className="admin-login-input-wrap">
                <svg
                  className="admin-login-input-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1C9.24 1 7 3.24 7 6v3H5c-1.1 0-2 .9-2 2v8c0 1.11.9 2 2 2h14c1.1 0 2-.89 2-2v-8c0-1.1-.9-2-2-2h-2V6c0-2.76-2.24-5-5-5zm-3 8V6c0-1.65 1.35-3 3-3s3 1.35 3 3v3H9z" />
                </svg>
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter your password"
                  className="admin-login-input"
                />
              </div>
            </div>

            <button
              type="submit"
              className="admin-login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="admin-login-spinner" />
                  <span>Logging in…</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <svg
                    className="admin-login-button-icon"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="admin-login-footer">
            <span className="admin-login-footer-strong">Security tip:</span>{' '}
            Do not share your admin login with anyone.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
