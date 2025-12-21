// client/src/api/spinApi.js
import axiosInstance from './axiosInstance';

// export const getWheelConfig = () => axiosInstance.get('/wheel');

// export const spinOnce = () =>
//   axiosInstance.post('/spin', {}); // token added by interceptor

export const getWheelConfig = () => axiosInstance.get('/spin/wheel');
export const spinOnce = () => axiosInstance.post('/spin/spin', {});
export const getMonkeyStatus = () => axiosInstance.get('/spin/monkey-status');
export const requestMonkeyAttempt = () => axiosInstance.post('/spin/monkey-attempt');
// export const getMonkeyStatus = () => axiosInstance.get('/monkey-status');

// export const requestMonkeyAttempt = () => axiosInstance.post('/monkey-attempt');
