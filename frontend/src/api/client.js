import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 20000,
});

client.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('aust_pic_auth');
    const token = raw ? JSON.parse(raw).token : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // ignore malformed storage
  }
  return config;
});

// Surface a consistent error shape ({ code, message }) to callers, matching
// the backend's errorHandler middleware contract (roadmap §5.5).
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiError = err.response?.data?.error || {
      code: 'network_error',
      message: err.message || 'Something went wrong talking to the server.',
    };
    return Promise.reject(apiError);
  }
);

export default client;