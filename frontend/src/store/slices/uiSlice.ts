// store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarOpen: boolean;
  navbarOpen: boolean;
  selectedStation: string;
  theme: 'dark' | 'light';
}

const initialState: UIState = {
  sidebarOpen: true,
  navbarOpen: true,
  selectedStation: 'Main Kitchen',
  theme: 'dark',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleNavbar: (state) => {
      state.navbarOpen = !state.navbarOpen;
    },
    setNavbarOpen: (state, action: PayloadAction<boolean>) => {
      state.navbarOpen = action.payload;
    },
    setSelectedStation: (state, action: PayloadAction<string>) => {
      state.selectedStation = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.theme = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleNavbar,
  setNavbarOpen,
  setSelectedStation,
  toggleTheme,
  setTheme,
} = uiSlice.actions;

export default uiSlice.reducer;