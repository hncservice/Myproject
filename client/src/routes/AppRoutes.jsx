// client/src/routes/AppRoutes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import RegisterPage from '../pages/user/RegisterPage';
import VerifyOtpPage from '../pages/user/VerifyOtpPage';
import SpinPage from '../pages/user/SpinPage';
import MonkeyGamePage from '../pages/user/MonkeyGamePage';

import VendorLoginPage from '../pages/vendor/VendorLoginPage';
import VendorScanPage from '../pages/vendor/VendorScanPage';

import AdminLoginPage from '../pages/admin/AdminLoginPage';
import AdminVendorsPage from '../pages/admin/AdminVendorsPage';
import AdminWheelItemsPage from '../pages/admin/AdminWheelItemsPage';
import AdminReportPage from '../pages/admin/AdminReportPage';

import UserLoginPage from '../pages/user/UserLoginPage';


const ProtectedRoute = ({ children, allowedRole, redirectTo }) => {
  const { role, token } = useAuth();

  if (!token || role !== allowedRole) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* User */}
      <Route path="/" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/monkey-game" element={<MonkeyGamePage />} />
      <Route
        path="/spin"
        element={
          <ProtectedRoute allowedRole="user" redirectTo="/">
            <SpinPage />
          </ProtectedRoute>
        }
      />

      {/* Vendor */}
      <Route path="/vendor/login" element={<VendorLoginPage />} />
      <Route
        path="/vendor/scan"
        element={
          <ProtectedRoute
            allowedRole="vendor"
            redirectTo="/vendor/login"
          >
            <VendorScanPage />
          </ProtectedRoute>
        }
      />
<Route path="/user/login" element={<UserLoginPage />} />


      {/* Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin/vendors"
        element={
          <ProtectedRoute
            allowedRole="admin"
            redirectTo="/admin/login"
          >
            <AdminVendorsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/wheel-items"
        element={
          <ProtectedRoute
            allowedRole="admin"
            redirectTo="/admin/login"
          >
            <AdminWheelItemsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/report"
        element={
          <ProtectedRoute
            allowedRole="admin"
            redirectTo="/admin/login"
          >
            <AdminReportPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
