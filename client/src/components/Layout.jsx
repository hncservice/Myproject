// client/src/components/Layout.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { role, logout } = useAuth();

  return (
    <>
      <Navbar bg="light" className="mb-3">
        <Container>
          <Navbar.Brand as={Link} to="/">
            Spin-to-Win
          </Navbar.Brand>
          <div className="d-flex align-items-center gap-3">
            {role === 'user' && (
              <>
                <Link to="/spin" className="text-decoration-none">
                  User
                </Link>
              </>
            )}
            {role === 'vendor' && (
              <>
                <Link to="/vendor/scan" className="text-decoration-none">
                  Vendor
                </Link>
              </>
            )}
            {role === 'admin' && (
              <>
                <Link to="/admin/vendors" className="text-decoration-none">
                  Vendors
                </Link>
                <Link to="/admin/wheel-items" className="text-decoration-none">
                  Wheel Items
                </Link>
                <Link to="/admin/report" className="text-decoration-none">
                  Reports
                </Link>
              </>
            )}
            {role && (
              <>
                <span className="small text-muted">{role.toUpperCase()}</span>
                <button className="btn btn-outline-secondary btn-sm" onClick={logout}>
                  Logout
                </button>
              </>
            )}
          </div>
        </Container>
      </Navbar>
      <Container>{children}</Container>
    </>
  );
};

export default Layout;
