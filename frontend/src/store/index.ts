// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import authReducer from './slices/authSlice';
import orddersReducer from './slices/ordersSlice';
import foodsReducer from './slices/foodsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer, // ← Add this
    orders: orddersReducer,
    foods: foodsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;