// client/src/routes/AppRoutes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../features/authentication/context/AuthContext';

import RegisterPage from '../../features/authentication/pages/RegisterPage';
import VerifyOtpPage from '../../features/authentication/pages/VerifyOtpPage';
import SpinPage from '../../features/games/spin/SpinPage';
import MonkeyGamePage from '../../features/games/monkey/MonkeyGamePage';
import BurgerRunPage from '../../features/games/burger-run/BurgerRunPage';
import PerfectShotGame from '../../features/games/perfect-shot/PerfectShotGame';

import VendorLoginPage from '../../features/authentication/pages/VendorLoginPage';
import VendorScanPage from '../../features/vendors/pages/VendorScanPage';

import AdminLoginPage from '../../features/authentication/pages/AdminLoginPage';
import AdminVendorsPage from '../../features/administration/pages/AdminVendorsPage';
import AdminWheelItemsPage from '../../features/prizes/pages/AdminWheelItemsPage';
import AdminReportPage from '../../features/administration/pages/AdminReportPage';
import AdminUsersPage from '../../features/administration/pages/AdminUsersPage';
import AdminOperationsPage from '../../features/administration/pages/AdminOperationsPage';
import AdminPrizeReviewsPage from '../../features/administration/pages/AdminPrizeReviewsPage';
import AdminCampaignsPage from '../../features/administration/pages/AdminCampaignsPage';

import UserLoginPage from '../../features/authentication/pages/UserLoginPage';
import UserHomePage from '../../features/games/pages/UserHomePage';
// import FraudMonitoringDashboard from '../../features/fraud-monitoring/components/FraudMonitoringDashboard';
import LiveFraudMonitoringDashboard from '../../features/fraud-monitoring/components/LiveFraudMonitoringDashboard';
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
      <Route path="/monkey-game" element={<ProtectedRoute allowedRole="user" redirectTo="/user/login"><MonkeyGamePage /></ProtectedRoute>} />
      <Route
        path="/spin"
        element={
          <ProtectedRoute allowedRole="user" redirectTo="/">
            <SpinPage />
          </ProtectedRoute>
        }
      />

      <Route path="/user/perfect-shot" element={<ProtectedRoute allowedRole="user" redirectTo="/user/login"><PerfectShotGame playerName="Guest" /></ProtectedRoute>} />

      <Route
  path="/user/home"
  element={
    <ProtectedRoute allowedRole="user" redirectTo="/user/login">
      <UserHomePage />
    </ProtectedRoute>
  }
/>

      <Route path="/user/burger-run" element={<ProtectedRoute allowedRole="user" redirectTo="/user/login"><BurgerRunPage /></ProtectedRoute>} />

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
      {/* <Route
  path="/admin/fraud-monitoring"
  element={
    <ProtectedRoute allowedRole="admin" redirectTo="/admin/login">
      <FraudMonitoringDashboard />
    </ProtectedRoute>
  }
/> */}
<Route
  path="/admin/fraud-monitoring"
  element={
    <ProtectedRoute allowedRole="admin" redirectTo="/admin/login">
      <LiveFraudMonitoringDashboard />
    </ProtectedRoute>
  }
/>
      <Route
  path="/admin/users"
  element={
    <ProtectedRoute allowedRole="admin" redirectTo="/admin/login">
      <AdminUsersPage />
    </ProtectedRoute>
  }
/>

      {/* Fallback */}
      <Route path="/admin/campaigns" element={<ProtectedRoute allowedRole="admin" redirectTo="/admin/login"><AdminCampaignsPage /></ProtectedRoute>} />
      <Route path="/admin/operations" element={<ProtectedRoute allowedRole="admin" redirectTo="/admin/login"><AdminOperationsPage /></ProtectedRoute>} />
      <Route path="/admin/prize-reviews" element={<ProtectedRoute allowedRole="admin" redirectTo="/admin/login"><AdminPrizeReviewsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
