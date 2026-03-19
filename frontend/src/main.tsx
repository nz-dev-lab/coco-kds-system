// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import axios from 'axios';
import { store } from './store/index';
import { logout } from './store/slices/authSlice';
import App from './App';
import './index.css';

// Auto-logout on 401 — JWT expired or revoked, redirect to login automatically
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && store.getState().auth.isAuthenticated) {
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);