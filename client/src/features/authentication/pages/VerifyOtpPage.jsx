import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { verifyOtp, resendUserOtp } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import logo from '../../../assets/logos.png';
import '../styles/VerifyOtpPage.css';

const OTP_LENGTH = 6;
const RESEND_WAIT_SECONDS = 60;

function emptyOtp() {
  return Array(OTP_LENGTH).fill('');
}

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [otp, setOtp] = useState(emptyOtp);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const inputs = useRef([]);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const emailFromState =
    typeof location.state?.email === 'string' ? location.state.email.trim() : '';
  const otpValue = otp.join('');

  useLayoutEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    setOtp(emptyOtp());
    setError('');
    setNotice('');
    setLoading(false);
    setResending(false);
    setResendSeconds(0);

    return () => {
      generation.current += 1;
    };
  }, [emailFromState]);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timeout = setTimeout(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [resendSeconds]);

  function fillCode(code, startIndex = 0) {
    const digits = code.slice(0, OTP_LENGTH - startIndex);

    setOtp((previous) => {
      const next = [...previous];

      for (let offset = 0; offset < digits.length; offset += 1) {
        next[startIndex + offset] = digits[offset];
      }

      return next;
    });

    inputs.current[startIndex + digits.length - 1]?.focus();
  }

  function handleChange(index, value) {
    if (!/^\d*$/.test(value)) return;

    // Some mobile browsers can insert the full code in the first field.
    if (index === 0 && value.length === OTP_LENGTH) {
      fillCode(value);
      return;
    }

    const digit = value.slice(-1);

    setOtp((previous) => {
      const next = [...previous];
      next[index] = digit;
      return next;
    });

    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(index, event) {
    event.preventDefault();

    const pasted = event.clipboardData.getData('text').trim();
    if (!/^\d+$/.test(pasted)) return;

    fillCode(pasted, pasted.length >= OTP_LENGTH ? 0 : index);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    setError('');

    if (otpValue.length !== OTP_LENGTH) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }

    inFlight.current = true;
    setLoading(true);
    const currentGeneration = generation.current;

    try {
      const { data } = await verifyOtp({
        email: emailFromState.toLowerCase(),
        otp: otpValue,
      });

      if (currentGeneration !== generation.current) return;

      const { token, user } = data || {};

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      login('user', token, user);

      const hasPrize = Boolean(
        user.hasPrize || user.qrToken || user.lastPrizeQrToken || user.wonPrize
      );
      const goToHome = hasPrize || location.state?.next === '/user/home';

      navigate(goToHome ? '/user/home' : '/monkey-game', { replace: true });
    } catch (err) {
      if (currentGeneration === generation.current) {
        setError(
          err?.response?.data?.message ||
          err?.message ||
          'OTP verification failed'
        );
      }
    } finally {
      if (currentGeneration === generation.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }

  async function handleResend() {
    if (inFlight.current || resendSeconds > 0) return;

    inFlight.current = true;
    setResending(true);
    setError('');
    setNotice('');
    const currentGeneration = generation.current;

    try {
      await resendUserOtp({ email: emailFromState.toLowerCase() });

      if (currentGeneration !== generation.current) return;

      setResendSeconds(RESEND_WAIT_SECONDS);
      setOtp(emptyOtp());
      setNotice(
        'A new code was requested. Check your email. Please wait one minute before retrying.'
      );
    } catch (err) {
      if (currentGeneration === generation.current) {
        setError(
          err?.response?.data?.message ||
          'Unable to request another code. Please try again later.'
        );
      }
    } finally {
      if (currentGeneration === generation.current) {
        inFlight.current = false;
        setResending(false);
      }
    }
  }

  if (!emailFromState) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="verify-otp-page">
      <div className="verify-otp-artwork" aria-hidden="true" />

      <div className="verify-otp-layout">
        <section className="verify-otp-card" aria-labelledby="verify-otp-title">
          <header className="verify-otp-brand">
            <img src={logo} alt="Hot N Cool" className="verify-otp-logo" />
            <span>HNC Rewards</span>
          </header>

          <div className="verify-otp-intro">
            <h1 id="verify-otp-title">Verify Your Email</h1>
            <p id="verify-otp-instructions">
              Enter the 6-digit code we sent to <strong>{emailFromState}</strong>.
            </p>
          </div>

          {error && (
            <p className="verify-otp-message verify-otp-message--error" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p className="verify-otp-message verify-otp-message--notice" role="status">
              {notice}
            </p>
          )}

          <form className="verify-otp-form" onSubmit={handleSubmit}>
            <div
              className="verify-otp-digits"
              role="group"
              aria-label="Verification code"
              aria-describedby="verify-otp-instructions"
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { inputs.current[index] = element; }}
                  id={`otp-${index}`}
                  className="verify-otp-digit"
                  aria-label={`OTP digit ${index + 1}`}
                  data-otp="true"
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  value={digit}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={(event) => handlePaste(index, event)}
                />
              ))}
            </div>

            <p className="verify-otp-helper">
              The code expires in 10 minutes. Check your spam folder if it’s missing.
            </p>

            <button
              type="submit"
              className="verify-otp-submit"
              disabled={loading || resending || otpValue.length !== OTP_LENGTH}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>

          <footer className="verify-otp-footer">
            <p>
              Didn’t receive the code?{' '}
              <button
                type="button"
                className="verify-otp-resend"
                disabled={loading || resending || resendSeconds > 0}
                onClick={handleResend}
              >
                {resending ? 'Requesting code...' : 'Resend OTP'}
              </button>
            </p>

            {resendSeconds > 0 && (
              <p role="timer" aria-live="off">
                Resend available in {resendSeconds}s
              </p>
            )}

            <Link to="/">← Back to Registration</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}