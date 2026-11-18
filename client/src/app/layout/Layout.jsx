import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import { useAuth } from '../../features/authentication/context/AuthContext';
import logo from '../../assets/logos.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import './layout.css';

const navigationByRole = {
  user: [
    { to: '/user/home', label: 'User Session' },
  ],
  vendor: [
    { to: '/vendor/scan', label: 'Vendor Scan' },
  ],
  admin: [
    { to: '/admin/vendors', label: 'VENDORS' },
    { to: '/admin/wheel-items', label: 'PRICES' },
    { to: '/admin/report', label: 'REPORTS' },
    { to: '/admin/users', label: 'USERS' },
    { to: '/admin/operations', label: 'OPERATIONS' },
    { to: '/admin/campaigns', label: 'CAMPAIGN' },
    { to: '/admin/prize-reviews', label: 'PRIZE REVIEWS' },
    { to: '/admin/fraud-monitoring', label: 'FRAUDE MONITORING' },
  ],
};

export default function Layout({ children }) {
  const { role, logout, logoutWarning } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const links = Object.hasOwn(navigationByRole, role) ? navigationByRole[role] : [];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.key, role]);

  function handleLogout() {
    setMenuOpen(false);
    logout();

    if (role === 'admin') {
      navigate('/admin/login', { replace: true });
    } else if (role === 'vendor') {
      navigate('/vendor/login', { replace: true });
    } else {
      navigate('/user/login', { replace: true });
    }
  }

  function handleHeaderKeyDown(event) {
    const menuButton = menuButtonRef.current;

    if (event.key === 'Escape' && menuOpen && menuButton?.getClientRects().length) {
      event.preventDefault();
      setMenuOpen(false);
      menuButton.focus();
    }
  }

  return (
    <div className="app-shell">
      <header className="app-shell-header" onKeyDown={handleHeaderKeyDown}>
        <div className="app-shell-header-inner">
          <Link to="/" className="app-shell-brand" onClick={() => setMenuOpen(false)}>
            <span className="app-shell-logo-wrap">
              <img src={logo} alt="" className="app-shell-logo" />
            </span>
            <span className="app-shell-brand-title">HNC Games</span>
          </Link>

          {role && (
            <>
              <button
                ref={menuButtonRef}
                type="button"
                className="app-shell-menu-toggle"
                aria-expanded={menuOpen}
                aria-controls="app-shell-navigation"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? 'Close menu' : 'Menu'}
              </button>

              <nav
                id="app-shell-navigation"
                className={`app-shell-nav${menuOpen ? ' app-shell-nav--open' : ''}`}
                aria-label="Main navigation"
              >
                {links.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className="app-shell-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}

                <div className="app-shell-account">
                  <span className="app-shell-role-pill">{role}</span>
                  <button
                    type="button"
                    className="app-shell-logout"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </nav>
            </>
          )}
        </div>
      </header>

      <main className="app-shell-main">
        {logoutWarning && <p role="status">{logoutWarning}</p>}
        <Container>{children}</Container>
      </main>
    </div>
  );
}