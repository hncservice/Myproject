// client/src/pages/user/VerifyOtpPage.jsx
import React, { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { verifyOtp } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

const VerifyOtpPage = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Email passed from RegisterPage via: navigate('/verify-otp', { state: { email } })
  const emailFromState = location.state?.email;

  // If user came here without email (direct URL), send back to register
  if (!emailFromState) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (index, value) => {
    if (value.length > 1) value = value.slice(0, 1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next box
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    const lastIndex = Math.min(pastedData.length, 5);
    const lastInput = document.getElementById(`otp-${lastIndex}`);
    if (lastInput) lastInput.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const otpValue = otp.join('');

      if (otpValue.length !== 6) {
        setError('Please enter the complete 6-digit OTP.');
        setLoading(false);
        return;
      }

      const payload = {
        email: emailFromState.toLowerCase(),
        otp: otpValue,
      };

      // ✅ Call real verify API
      const res = await verifyOtp(payload);
      const { token, user } = res.data || {};

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      // ✅ Save auth (role: user) and go to spin page
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
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <div style={styles.card}>
          {/* Logo Area */}
          <div style={styles.logoContainer}>
            <div style={styles.logoBox}>
              <svg style={styles.logoIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
            </div>
            <h1 style={styles.logoText}>SecureAuth</h1>
          </div>

          {/* Header */}
          <div style={styles.header}>
            <div style={styles.iconBox}>
              <svg style={styles.icon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
            <h2 style={styles.title}>Verify Your Email</h2>
            <p style={styles.subtitle}>Enter the 6-digit code we sent to</p>
          </div>

          {/* Email Display */}
          <div style={styles.emailBox}>
            <svg style={styles.emailIcon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <strong style={styles.emailText}>{emailFromState}</strong>
          </div>

          {/* Error Alert */}
          {error && (
            <div style={styles.alertError}>
              <svg style={styles.alertIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              {error}
            </div>
          )}

          {/* OTP form */}
          <form onSubmit={handleSubmit}>
            {/* OTP Input Fields */}
            <div style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  style={styles.otpInput}
                  autoComplete="off"
                />
              ))}
            </div>

            {/* Helper Text */}
            <p style={styles.helperText}>
              <svg style={styles.helperIcon} fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              Code expires in 10 minutes. Check your inbox and spam folder.
            </p>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6}
              style={{
                ...styles.button,
                ...(loading || otp.join('').length !== 6 ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? (
                <>
                  <span style={styles.spinner}></span>
                  Verifying...
                </>
              ) : (
                <>
                  Verify OTP
                  <svg style={styles.buttonIcon} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Resend Link */}
          <div style={styles.footer}>
            <p style={styles.footerText}>
              Didn't receive the code?{' '}
              <a
                href="#"
                style={styles.link}
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: hook this to resend OTP API if you have one
                  console.log('Resending OTP...');
                }}
              >
                Resend OTP
              </a>
            </p>
          </div>

          {/* Back to Register */}
          <div style={styles.backLink}>
            <a
              href="#"
              style={styles.link}
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
            >
              ← Back to Registration
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a1929 0%, #1a2332 50%, #2d1b3d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  wrapper: {
    width: '100%',
    maxWidth: '500px',
  },
  card: {
    background: 'rgba(20, 39, 80, 0.95)',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 20px 60px rgba(220, 38, 38, 0.2)',
    border: '1px solid rgba(220, 38, 38, 0.15)',
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logoBox: {
    width: '60px',
    height: '60px',
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    boxShadow: '0 8px 24px rgba(220, 38, 38, 0.4)',
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    color: 'white',
  },
  logoText: {
    color: 'white',
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  iconBox: {
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 24px rgba(30, 64, 175, 0.3)',
  },
  icon: {
    width: '32px',
    height: '32px',
    color: 'white',
  },
  title: {
    color: 'white',
    fontSize: '26px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    margin: 0,
  },
  emailBox: {
    background: 'rgba(30, 64, 175, 0.15)',
    border: '1px solid rgba(30, 64, 175, 0.3)',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'center',
  },
  emailIcon: {
    width: '18px',
    height: '18px',
    color: '#60a5fa',
    flexShrink: 0,
  },
  emailText: {
    color: '#60a5fa',
    fontSize: '14px',
    wordBreak: 'break-all',
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
  otpContainer: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  otpInput: {
    width: '50px',
    height: '56px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '2px solid rgba(220, 38, 38, 0.3)',
    borderRadius: '12px',
    color: 'white',
    fontSize: '24px',
    fontWeight: '600',
    textAlign: 'center',
    outline: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box',
  },
  helperText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '13px',
    textAlign: 'center',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    lineHeight: '1.5',
  },
  helperIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
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
  },
  buttonDisabled: {
    background: 'rgba(153, 27, 27, 0.4)',
    cursor: 'not-allowed',
    boxShadow: 'none',
    opacity: 0.6,
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
  backLink: {
    textAlign: 'center',
    marginTop: '16px',
  },
  link: {
    color: '#dc2626',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '13px',
  },
};

// Add keyframe animation and focus styles once
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  input[type="text"]:focus {
    border-color: #dc2626 !important;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2) !important;
    transform: scale(1.05);
  }
  button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(220, 38, 38, 0.4) !important;
  }
  a:hover {
    color: #ef4444 !important;
    text-decoration: underline;
  }
  @media (max-width: 576px) {
    h2 { font-size: 22px !important; }
    h1 { font-size: 20px !important; }
    input[type="text"] { 
      width: 44px !important; 
      height: 50px !important; 
      font-size: 20px !important;
    }
  }
`;
document.head.appendChild(styleSheet);

export default VerifyOtpPage;
