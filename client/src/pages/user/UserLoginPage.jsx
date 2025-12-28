// client/src/pages/user/UserLoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../api/authApi';
import logo from '../../assets/logos.png';
import '../../styles/userLogin.css'; // ✅ IMPORTANT

const UserLoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
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
      await loginUser(payload);

      setMsg('OTP sent to your email successfully!');
      setTimeout(() => {
        navigate('/verify-otp', { state: { email: payload.email } });
      }, 700);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Login failed');
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
                  {showPwd ? '🙈' : '👁️'}
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
