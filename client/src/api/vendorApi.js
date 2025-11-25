import axiosInstance from './axiosInstance';

export const scanQrToken = (token, qrToken) =>
  axiosInstance.post(
    '/vendor/scan',
    { qrToken },
    { headers: { Authorization: `Bearer ${token}` } }
  );
