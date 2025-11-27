// client/src/api/vendorApi.js
import axiosInstance from './axiosInstance';

export const scanQrToken = (qrToken) =>
  axiosInstance.post('/vendor/scan', { qrToken });
