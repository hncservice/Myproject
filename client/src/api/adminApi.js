// client/src/api/adminApi.js
import axiosInstance from './axiosInstance';

// All these expect token to be in localStorage (added by interceptor)

export const createVendor = (data) =>
  axiosInstance.post('/admin/vendors', data);

export const getVendors = () =>
  axiosInstance.get('/admin/vendors');

// adminApi.js (example)
export const updateVendor = (id, data) =>
  axiosInstance.put(`/admin/vendors/${id}`, data);
export const getReportStats = () =>
  axiosInstance.get('/admin/report/stats');

export const getWheelItems = () =>
  axiosInstance.get('/admin/wheel-items');

export const createWheelItem = (data) =>
  axiosInstance.post('/admin/wheel-items', data);

export const updateWheelItem = (id, data) =>
  axiosInstance.put(`/admin/wheel-items/${id}`, data);

export const deleteWheelItem = (id) =>
  axiosInstance.delete(`/admin/wheel-items/${id}`);

export const downloadReport = () =>
  axiosInstance.get('/admin/reports/export', {
    responseType: 'blob',
  });

export const adminListUsers = (params) => axiosInstance.get('/admin/users', { params });
export const adminGetUser = (id) => axiosInstance.get(`/admin/users/${id}`);
export const adminCreateUser = (payload) => axiosInstance.post('/admin/users', payload);
export const adminUpdateUser = (id, payload) => axiosInstance.put(`/admin/users/${id}`, payload);
export const adminDeleteUser = (id) => axiosInstance.delete(`/admin/users/${id}`);