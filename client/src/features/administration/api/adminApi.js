// client/src/api/adminApi.js
import axiosInstance from '../../../shared/api/axiosInstance';

// All these expect token to be in localStorage (added by interceptor)

export const createVendor = (data) =>
  axiosInstance.post('/admin/vendors', data);

export const getVendors = (params) => params
  ? axiosInstance.get('/admin/vendors', { params })
  : axiosInstance.get('/admin/vendors');

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

export const getAdminOperations = (resource, params) => {
  if (!['configuration', 'sessions', 'redemptions', 'audit-logs'].includes(resource)) throw new Error('Unsupported report');
  return axiosInstance.get(`/admin/${resource}`, { params });
};
export const listPrizeReviews = params => axiosInstance.get('/admin/prize-reviews', { params });
export const getPrizeReview = id => axiosInstance.get(`/admin/prize-reviews/${encodeURIComponent(id)}`);
export const reviewPrize = (id, action) => {
  if (!['approve', 'reject'].includes(action)) throw new Error('Unsupported review action');
  return axiosInstance.post(`/admin/prize-reviews/${encodeURIComponent(id)}/${action}`);
};
export const listCampaigns = params => axiosInstance.get('/admin/campaigns', { params });
export const createCampaign = payload => axiosInstance.post('/admin/campaigns', payload);
export const updateCampaign = (id, payload) => axiosInstance.put(`/admin/campaigns/${encodeURIComponent(id)}`, payload);
export const getCampaignActivity = id => axiosInstance.get(`/admin/campaigns/${encodeURIComponent(id)}/activity`);
export const getLiveFraudSessions = (params) =>
  axiosInstance.get('/admin/fraud-monitoring/sessions', { params });