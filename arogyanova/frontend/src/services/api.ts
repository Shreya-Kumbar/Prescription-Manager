// ArogyaNova — Axios API Client
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,  // Send HttpOnly cookies
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — handle global errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.detail ?? 'An error occurred.';

      if (status === 401) {
        // Session expired — redirect to login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else if (status === 403) {
        toast.error('Access denied: ' + message);
      } else if (status === 429) {
        toast.error('Too many requests. Please wait a moment.');
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      }
    } else if (error.request) {
      toast.error('Cannot reach the server. Check your connection.');
    }
    return Promise.reject(error);
  }
);

export default api;
