// client/src/components/Layout.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logos.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/layout.css'; // ✅ IMPORTANT

const Layout = ({ children }) => {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    const r = role;
    logout();

    if (r === 'admin') navigate('/admin/login', { replace: true });
    else if (r === 'vendor') navigate('/vendor/login', { replace: true });
    else navigate('/user/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <Container className="app-shell-header-inner">
          <Link to="/" className="app-shell-brand">
            <div className="app-shell-logo-wrap">
              <img src={logo} alt="HNC Logo" className="app-shell-logo" />
            </div>
            <div className="app-shell-brand-text">
              <span className="app-shell-brand-title">HNC Game Whack the Monkey</span>
              <span className="app-shell-brand-subtitle">Rewards • Vendors • Lucky</span>
            </div>
          </Link>

          <nav className="app-shell-nav">
            {role === 'user' && (
              <Link to="/user/home" className="app-shell-link">
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
                <Link to="/admin/vendors" className="app-shell-link">Vendors</Link>
                <Link to="/admin/wheel-items" className="app-shell-link">Wheel Items</Link>
                <Link to="/admin/report" className="app-shell-link">Reports</Link>
                <Link to="/admin/users" className="app-shell-link">Users</Link>
              </>
            )}

            {role && (
              <div className="app-shell-account">
                <span className="app-shell-role-pill">{role.toUpperCase()}</span>
                <button type="button" className="app-shell-logout" onClick={handleLogout}>
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
