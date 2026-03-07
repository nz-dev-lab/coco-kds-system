// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import authReducer from './slices/authSlice';
import orddersReducer from './slices/ordersSlice';
import foodsReducer from './slices/foodsSlice';
import notificationsreducer from './slices/notificationsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer, // ← Add this
    orders: orddersReducer,
    foods: foodsReducer,
    notifications: notificationsreducer,
  },
});

(window as any).__STORE__ = store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;