// client/src/api/spinApi.js
import axiosInstance from './axiosInstance';

export const getWheelConfig = () => axiosInstance.get('/wheel');

export const spinOnce = () =>
  axiosInstance.post('/spin', {}); // token added by interceptor
