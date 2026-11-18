// client/src/api/axiosInstance.js
import axios from 'axios';

const rawBase =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:5000/api';

const BASE_URL = rawBase; // e.g. http://localhost:5000/api

console.log('[API] Base URL:', BASE_URL);

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // you're using JWT, not cookies:
  withCredentials: false,
});

// Attach token from localStorage on every request
axiosInstance.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = config.headers || {};
        if (!config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (e) {
      // localStorage might fail in some environments
      console.warn('[API] Failed to read token from storage:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      // Token invalid/expired -> clear & force re-login
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('profile');
      } catch (e) {
        console.warn('[API] Failed to clear auth storage:', e);
      }

      // Avoid redirect loop
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
