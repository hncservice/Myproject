// client/src/components/Layout.jsx
import React, { useEffect } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logos.png'; // ✅ update this path if your assets folder is different

const Layout = ({ children }) => {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();                     // clear token, role, user
    navigate('/user/login', {     // redirect to login
      replace: true,              // prevents back navigation
    });
  };


  // Inject global theme styles for layout once
  useEffect(() => {
    if (document.getElementById('app-layout-theme')) return;

    const style = document.createElement('style');
    style.id = 'app-layout-theme';
    style.textContent = `
      :root {
        --hnc-red: #dc2626;
        --hnc-red-dark: #991b1b;
        --hnc-header-bg: rgba(15, 23, 42, 0.96);
        --hnc-border-soft: rgba(148, 163, 184, 0.4);
      }

      .app-shell {
        min-height: 100vh;
        background: radial-gradient(circle at top, #1f2937 0, #020617 55%, #020617 100%);
        color: #e5e7eb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        display: flex;
        flex-direction: column;
      }

      .app-shell-header {
        position: sticky;
        top: 0;
        z-index: 20;
        backdrop-filter: blur(18px);
        background: linear-gradient(
          to bottom,
          rgba(15, 23, 42, 0.92),
          rgba(15, 23, 42, 0.9),
          rgba(15, 23, 42, 0.85)
        );
        border-bottom: 1px solid rgba(148, 163, 184, 0.35);
        box-shadow: 0 14px 35px rgba(15, 23, 42, 0.8);
      }

      .app-shell-header-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-top: 10px;
        padding-bottom: 10px;
      }

      .app-shell-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
      }

      .app-shell-logo-wrap {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        overflow: hidden;
        background: radial-gradient(circle at 30% 0%, #f97373 0, #b91c1c 40%, #111827 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          0 0 0 1px rgba(248, 113, 113, 0.4),
          0 12px 30px rgba(0, 0, 0, 0.8);
      }

      .app-shell-logo {
        max-width: 80%;
        max-height: 80%;
        object-fit: contain;
        display: block;
      }

      .app-shell-brand-text {
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .app-shell-brand-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #f9fafb;
      }

      .app-shell-brand-subtitle {
        font-size: 11px;
        color: rgba(148, 163, 184, 0.95);
      }

      .app-shell-nav {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .app-shell-link {
        font-size: 12px;
        padding: 6px 11px;
        border-radius: 999px;
        text-decoration: none;
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, 0.55);
        background: radial-gradient(circle at 0 0, rgba(248, 250, 252, 0.09), rgba(15, 23, 42, 0.9));
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
        white-space: nowrap;
      }

      .app-shell-link:hover {
        border-color: rgba(248, 113, 113, 0.9);
        background: radial-gradient(circle at 0 0, rgba(248, 113, 113, 0.3), rgba(15, 23, 42, 0.95));
        box-shadow: 0 10px 24px rgba(248, 113, 113, 0.35);
        transform: translateY(-1px);
        color: #fef2f2;
      }

      .app-shell-account {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .app-shell-role-pill {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        padding: 4px 9px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.7);
        background: rgba(15, 23, 42, 0.9);
        color: rgba(209, 213, 219, 0.95);
      }

      .app-shell-logout {
        font-size: 11px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(248, 113, 113, 0.8);
        background: transparent;
        color: #fecaca;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease, color 0.15s ease;
      }

      .app-shell-logout:hover {
        background: rgba(248, 113, 113, 0.16);
        color: #fee2e2;
        box-shadow: 0 10px 26px rgba(248, 113, 113, 0.35);
        transform: translateY(-1px);
      }

      .app-shell-logout:active {
        transform: translateY(0);
        box-shadow: 0 6px 18px rgba(248, 113, 113, 0.25);
      }

      .app-shell-main {
        flex: 1;
        padding-top: 12px;
        padding-bottom: 24px;
      }

      .app-shell-main > .container {
        /* Keep bootstrap container but tweak text color for inner content if needed */
        color: #e5e7eb;
      }

      /* Mobile layout tweaks */
      @media (max-width: 768px) {
        .app-shell-header-inner {
          flex-direction: column;
          align-items: flex-start;
          padding-top: 8px;
          padding-bottom: 8px;
        }

        .app-shell-nav {
          width: 100%;
          justify-content: flex-start;
          margin-top: 4px;
        }

        .app-shell-brand-title {
          font-size: 15px;
        }

        .app-shell-brand-subtitle {
          font-size: 10px;
        }
      }

      @media (max-width: 480px) {
        .app-shell-header-inner {
          padding-left: 8px;
          padding-right: 8px;
        }

        .app-shell-nav {
          gap: 6px;
        }

        .app-shell-link {
          font-size: 11px;
          padding: 5px 9px;
        }

        .app-shell-main {
          padding-top: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <Container className="app-shell-header-inner">
          {/* Brand / Logo */}
          <Link to="/" className="app-shell-brand">
            <div className="app-shell-logo-wrap">
              <img src={logo} alt="HNC Logo" className="app-shell-logo" />
            </div>
            <div className="app-shell-brand-text">
              <span className="app-shell-brand-title">HNC Game Whack the Monkey</span>
              <span className="app-shell-brand-subtitle">
                Rewards • Vendors • Lucky 
              </span>
            </div>
          </Link>

          {/* Role-based nav */}
          <nav className="app-shell-nav">
            {role === 'user' && (
              <Link to="/spin" className="app-shell-link">
                User Session
              </Link>
            )}

            {role === 'vendor' && (
              <Link to="/vendor/scan" className="app-shell-link">
                Vendor Scan
              </Link>
            )}

            {role === 'admin' && (
              <>
                <Link to="/admin/vendors" className="app-shell-link">
                  Vendors
                </Link>
                <Link to="/admin/wheel-items" className="app-shell-link">
                  Wheel Items
                </Link>
                <Link to="/admin/report" className="app-shell-link">
                  Reports
                </Link>
              </>
            )}

            {role && (
              <div className="app-shell-account">
                <span className="app-shell-role-pill">{role.toUpperCase()}</span>
                <button
                  type="button"
                  className="app-shell-logout"
                  onClick={handleLogout} 
                >
                  Logout
                </button>
              </div>
            )}
          </nav>
        </Container>
      </header>

      <main className="app-shell-main">
        <Container>{children}</Container>
      </main>
    </div>
  );
};

export default Layout;
