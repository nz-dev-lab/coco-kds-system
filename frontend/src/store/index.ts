// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import authReducer from './slices/authSlice';
import ordersReducer from './slices/ordersSlice';
import tmbillReducer from './slices/tmbillOrdersSlice';
import foodsReducer from './slices/foodsSlice';
import notificationsReducer from './slices/notificationsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    orders: ordersReducer,
    tmbill: tmbillReducer,
    foods: foodsReducer,
    notifications: notificationsReducer,
  },
});

(window as any).__STORE__ = store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
