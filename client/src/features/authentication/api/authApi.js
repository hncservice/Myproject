// client/src/api/authApi.js
import axiosInstance from '../../../shared/api/axiosInstance';

export const registerUser = (payload) =>
  axiosInstance.post('/auth/register', payload);

export const verifyOtp = (payload) =>
  axiosInstance.post('/auth/verify-otp', payload);

export const loginVendor = (payload) =>
  axiosInstance.post('/auth/vendor/login', payload);

export const loginAdmin = (payload) =>
  axiosInstance.post('/auth/admin/login', payload);

export const loginUser = (payload) =>
  axiosInstance.post('/auth/user/login', payload);

export const resendUserOtp = (payload) => axiosInstance.post('/auth/resend-otp', payload);
export const logoutSession = (token) => axiosInstance.post('/auth/logout', {}, {
  headers: { Authorization: `Bearer ${token}` },
  // Handle an expired logout token locally; preserve role-specific navigation.
  validateStatus: status => (status >= 200 && status < 300) || status === 401,
}).then(response => {
  if (response.status === 401) throw new Error('Server revocation could not be confirmed');
  return response;
});
