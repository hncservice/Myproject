import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api/authApi';
import logo from '../../../assets/logos.png';
import '../styles/RegisterPage.css';

const INITIAL_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QATAR_PHONE_PATTERN = /^(?:\+974\s?)?\d{8}$/;

function validateRegistration(form) {
  const nameLength = form.name.trim().length;

  if (nameLength < 2) {
    return 'Please enter your full name (at least 2 characters).';
  }

  if (nameLength > 100) {
    return 'Name must be at most 100 characters.';
  }

  if (!EMAIL_PATTERN.test(form.email.trim())) {
    return 'Please enter a valid email address.';
  }

  if (!QATAR_PHONE_PATTERN.test(form.phone.trim())) {
    return 'Please enter a valid Qatar phone number (e.g. +974 12345678).';
  }

  if (form.password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  if (new TextEncoder().encode(form.password).length > 72) {
    return 'Password must be at most 72 UTF-8 bytes.';
  }

  return '';
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inFlight = useRef(false);
  const alive = useRef(true);

  useLayoutEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    if (errorMessage) setErrorMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    const validationError = validateRegistration(form);
    setErrorMessage(validationError);
    if (validationError) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
    };

    inFlight.current = true;
    setLoading(true);

    try {
      await registerUser(payload);

      if (alive.current) {
        navigate('/verify-otp', {
          state: { email: payload.email, next: '/user/home' },
        });
      }
    } catch (error) {
      if (alive.current) {
        setErrorMessage(
          error?.response?.data?.message ||
          error?.message ||
          'Registration failed. Please try again.'
        );
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }

  return (
    <main className="register-page" id="registration-page">
      <div className="register-artwork" aria-hidden="true" />

      <div className="register-layout">
        <section
          className="register-card"
          id="registration-form-section"
          aria-labelledby="registration-title"
        >
          <header className="register-brand" id="registration-header">
            <img src={logo} alt="Hot N Cool" className="register-brand__logo" />
            <span>HNC Rewards</span>
          </header>

          <div className="register-intro" id="registration-intro">
            <h1 id="registration-title">Create Account</h1>
            <p>We’ll email you a one-time password (OTP) to verify your account.</p>
          </div>

          {errorMessage && (
            <p className="register-alert" role="alert">
              {errorMessage}
            </p>
          )}

          <form
            id="registration-form"
            className="register-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="register-field">
              <label htmlFor="register-name">Full Name</label>
              <input
                id="register-name"
                className="register-input"
                name="name"
                type="text"
                value={form.name}
                onChange={updateField}
                autoComplete="name"
                minLength={2}
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-email">Email Address</label>
              <input
                id="register-email"
                className="register-input"
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                autoComplete="email"
                autoCapitalize="none"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-phone">Phone Number</label>
              <input
                id="register-phone"
                className="register-input"
                name="phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={updateField}
                autoComplete="tel"
                placeholder="+974 12345678"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-password">Password</label>
              <div className="register-password">
                <input
                  id="register-password"
                  className="register-input register-input--password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={updateField}
                  autoComplete="new-password"
                  aria-describedby="register-password-hint"
                  minLength={6}
                  required
                />
                <button
                  id="register-password-toggle"
                  type="button"
                  className="register-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="register-password"
                  onClick={() => setShowPassword((previous) => !previous)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <small id="register-password-hint" className="register-field__hint">
                At least 6 characters.
              </small>
            </div>

            <button
              id="register-submit"
              className="register-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Sending OTP...' : 'Register & Get OTP'}
            </button>
          </form>

          <footer className="register-footer">
            <p id="registration-login-link">
              Already registered? <Link to="/user/login">Login</Link>
            </p>
            <a
              id="registration-app-download"
              href="https://app.hotncool.qa"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download the HNC app
            </a>
          </footer>
        </section>
      </div>
    </main>
  );
}