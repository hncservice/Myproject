// client/src/api/adminApi.js
import axiosInstance from './axiosInstance';

// All these expect token to be in localStorage (added by interceptor)

export const createVendor = (data) =>
  axiosInstance.post('/admin/vendors', data);

export const getVendors = () =>
  axiosInstance.get('/admin/vendors');

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
