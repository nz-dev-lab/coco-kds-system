// store/slices/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface AuthState {
  token: string | null;
  vendor: any | null;
  restaurant: any | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('kds_token'),
  vendor: JSON.parse(localStorage.getItem('kds_vendor') || 'null'),
  restaurant: JSON.parse(localStorage.getItem('kds_restaurant') || 'null'),
  isAuthenticated: !!localStorage.getItem('kds_token'),
  loading: false,
  error: null,
};

// Async thunk for login
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        credentials
      );
      
      const { token, vendor, restaurant } = response.data;
      
      // Save to localStorage
      localStorage.setItem('kds_token', token);
      localStorage.setItem('kds_vendor', JSON.stringify(vendor));
      localStorage.setItem('kds_restaurant', JSON.stringify(restaurant));
      
      return { token, vendor, restaurant };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.token = null;
      state.vendor = null;
      state.restaurant = null;
      state.isAuthenticated = false;
      state.error = null;
      
      // Clear localStorage
      localStorage.removeItem('kds_token');
      localStorage.removeItem('kds_vendor');
      localStorage.removeItem('kds_restaurant');
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.vendor = action.payload.vendor;
        state.restaurant = action.payload.restaurant;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;

