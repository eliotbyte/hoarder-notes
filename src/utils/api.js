import axios from 'axios';
import router from '@/router';
import store from '../store/store';

const api = axios.create({
  baseURL: 'http://localhost:5032',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    store.dispatch('logout');
    localStorage.removeItem('authToken');
    router.push('/auth');
  }
  return Promise.reject(error);
});

export default api;
