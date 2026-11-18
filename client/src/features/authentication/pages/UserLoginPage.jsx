import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import logo from '../../../assets/logos.png';
import '../styles/userLogin.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);

  useLayoutEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));

    if (error) setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    setError('');

    const payload = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
    };

    if (!EMAIL_PATTERN.test(payload.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (payload.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    inFlight.current = true;
    setLoading(true);

    try {
      const { data } = await loginUser(payload);
      if (!alive.current) return;

      const { token, user } = data || {};

      if (typeof token !== 'string' || !token.trim() || !user?.id) {
        throw new Error('Invalid response from server.');
      }

      login('user', token, user);
      navigate('/user/home', { replace: true });
    } catch (err) {
      if (alive.current) {
        setError(
          err?.response?.data?.message ||
          err?.message ||
          'Login failed. Please try again.'
        );
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }

  return (
    <main className="user-login-page">
      <div className="user-login-artwork" aria-hidden="true" />

      <div className="user-login-layout">
        <section className="user-login-card" aria-labelledby="user-login-title">
          <header className="user-login-brand">
            <img src={logo} alt="Hot N Cool" className="user-login-logo" />
            <span>HNC Rewards</span>
          </header>

          <div className="user-login-intro">
            <h1 id="user-login-title">User Login</h1>
            <p>Log in to play and view your prize QR code.</p>
          </div>

          {error && (
            <p className="user-login-alert" role="alert">
              {error}
            </p>
          )}

          <form className="user-login-form" onSubmit={handleSubmit} noValidate>
            <div className="user-login-field">
              <label htmlFor="user-login-email">Email Address</label>
              <input
                id="user-login-email"
                className="user-login-input"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                autoCapitalize="none"
                required
              />
            </div>

            <div className="user-login-field">
              <label htmlFor="user-login-password">Password</label>
              <div className="user-login-password">
                <input
                  id="user-login-password"
                  className="user-login-input user-login-input--password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="user-login-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="user-login-password"
                  onClick={() => setShowPassword((previous) => !previous)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="user-login-submit">
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <footer className="user-login-footer">
            <p>New user? <Link to="/">Register</Link></p>
          </footer>
        </section>
      </div>
    </main>
  );
}