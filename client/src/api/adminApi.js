import axiosInstance from './axiosInstance';

export const createVendor = (token, data) =>
  axiosInstance.post('/admin/vendors', data, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const getVendors = (token) =>
  axiosInstance.get('/admin/vendors', {
    headers: { Authorization: `Bearer ${token}` }
  });

export const getWheelItems = (token) =>
  axiosInstance.get('/admin/wheel-items', {
    headers: { Authorization: `Bearer ${token}` }
  });

export const createWheelItem = (token, data) =>
  axiosInstance.post('/admin/wheel-items', data, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const updateWheelItem = (token, id, data) =>
  axiosInstance.put(`/admin/wheel-items/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const deleteWheelItem = (token, id) =>
  axiosInstance.delete(`/admin/wheel-items/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const downloadReport = (token) =>
  axiosInstance.get('/admin/reports/export', {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob'
  });
