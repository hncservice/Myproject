import axiosInstance from './axiosInstance';

export const getWheelConfig = () => axiosInstance.get('/wheel');
export const spinOnce = (token) =>
  axiosInstance.post(
    '/spin',
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
