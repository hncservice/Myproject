// client/src/api/vendorApi.js
import axiosInstance from './axiosInstance';

export const scanQrToken = (qrToken) =>
  axiosInstance.post('/vendor/scan', { qrToken });

export const getVendorDashboard = (params) =>
  axiosInstance.get('/vendor/dashboard', { params });

export const exportVendorRedemptionsExcel = (params) =>
  axiosInstance.get('/vendor/reports/export', {
    params,
    responseType: 'blob',
  });
