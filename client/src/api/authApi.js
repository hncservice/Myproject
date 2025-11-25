import axiosInstance from './axiosInstance';

export const registerUser = (payload) =>
  axiosInstance.post('/auth/register', payload);

export const verifyOtp = (payload) =>
  axiosInstance.post('/auth/verify-otp', payload);

export const loginVendor = (payload) =>
  axiosInstance.post('/auth/vendor/login', payload);

export const loginAdmin = (payload) =>
  axiosInstance.post('/auth/admin/login', payload);
