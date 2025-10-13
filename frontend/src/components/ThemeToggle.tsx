// src/components/ThemeToggle.tsx
import { Sun, Moon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleTheme, setTheme } from '../store/slices/uiSlice';
import { useEffect } from 'react';

export default function ThemeToggle() {
  const dispatch = useAppDispatch();
  const { theme } = useAppSelector((state) => state.ui);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('kds-theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      dispatch(setTheme(savedTheme));
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, [dispatch]);

  // Save theme to localStorage and update DOM whenever theme changes
  useEffect(() => {
    localStorage.setItem('kds-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // Optional: Also update body class for your CSS
    document.body.classList.toggle('light', theme === 'light');
  }, [theme]);

  const handleToggle = () => {
    dispatch(toggleTheme());
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-2 rounded-lg ${
        theme === 'dark' ? 'hover:bg-kds-surface' : 'hover:bg-slate-100'
      } transition-colors`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600" />
      )}
    </button>
  );
}