// client/src/api/gameApi.js
// Uses the existing Axios instance (JWT authorization is handled by its interceptor).
import axiosInstance from '../../../shared/api/axiosInstance';
export const getMonkeyHistory = () =>
  axiosInstance.get('/games/monkey/history');
export const getGamesStatus = () => axiosInstance.get('/games/status');
export const getMonkeySession = () => axiosInstance.get('/games/monkey/session');
export const startMonkey = () => axiosInstance.post('/games/monkey/start', {});
export const nextMonkeyRound = (credentials) => axiosInstance.post('/games/monkey/next', credentials);
export const hitMonkey = (payload) => axiosInstance.post('/games/monkey/hit', payload);
