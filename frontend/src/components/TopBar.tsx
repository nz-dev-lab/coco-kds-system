// components/TopBar.tsx
import { Menu, ChevronDown, ChevronUp, Bell, User, LogOut } from 'lucide-react';
import iconUrl from '../assets/icon.png';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleSidebar, toggleNavbar, setSelectedSource } from '../store/slices/uiSlice';
import { logout } from '../store/slices/authSlice';
import WindowControls from './WindowControls';
import ThemeToggle from './ThemeToggle';

export default function TopBar() {
  const dispatch = useAppDispatch();
  const { navbarOpen, selectedSource } = useAppSelector((state) => state.ui);

  const handleLogout = () => {
    dispatch(logout());
  };

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleToggleNavbar = () => {
    dispatch(toggleNavbar());
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setSelectedSource(e.target.value as 'all' | 'cocoeats' | 'tmbill'));
  };

  return (
    <div
      className={`relative bg-white dark:bg-kds-bg-secondary border-b border-slate-200 dark:border-kds-border transition-all duration-300 ease-in-out z-30 ${
        navbarOpen ? 'h-16' : 'h-0'
      }`}
    >
      {navbarOpen && (
        <div className="h-16 flex items-center justify-between">
          {/* Left section with drag region */}
          <div className="flex items-center gap-4 px-6 flex-1" style={{ WebkitAppRegion: 'drag' } as any}>
            <button
              onClick={handleToggleSidebar}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-kds-surface transition-colors"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5 text-slate-700 dark:text-kds-text-primary" />
            </button>
            <div className="flex items-center gap-2.5">
              <img src={iconUrl} alt="CocoFlow" className="w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent leading-none">
                  CocoFlow
                </h1>
                <span className="hidden sm:block text-xs text-slate-400 dark:text-kds-text-muted font-medium tracking-wide">
                  Smart orders. Faster kitchens.
                </span>
              </div>
            </div>
          </div>

          {/* Center section */}
          <div className="flex items-center gap-2 px-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <span className="text-sm text-slate-600 dark:text-kds-text-muted">Source:</span>
            <select
              value={selectedSource}
              onChange={handleSourceChange}
              className="py-1 px-3 text-sm rounded-lg bg-slate-100 dark:bg-kds-surface border border-slate-300 dark:border-kds-border text-slate-900 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">All Orders</option>
              <option value="cocoeats">CocoEats</option>
              {!!window.tmbill && <option value="tmbill">TMBILL POS</option>}
            </select>
          </div>

          {/* Right section - User Actions */}
          <div className="flex items-center gap-3 px-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <ThemeToggle />
            <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-kds-surface transition-colors relative">
              <Bell className="w-5 h-5 text-slate-700 dark:text-kds-text-primary" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-kds-surface transition-colors">
              <User className="w-5 h-5 text-slate-700 dark:text-kds-text-primary" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Window Controls - Far Right */}
          <div className="border-l border-slate-200 dark:border-kds-border" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <WindowControls />
          </div>
        </div>
      )}

      {/* Navbar Drawer Handle */}
      <button
        onClick={handleToggleNavbar}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full bg-white dark:bg-kds-bg-secondary border border-t-0 border-slate-200 dark:border-kds-border rounded-b-lg px-4 py-1 hover:bg-slate-100 dark:hover:bg-kds-surface transition-all group shadow-md dark:shadow-none"
        aria-label={navbarOpen ? 'Hide navigation' : 'Show navigation'}
      >
        {navbarOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400 dark:text-kds-text-muted group-hover:text-slate-700 dark:group-hover:text-kds-text-primary transition-colors" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-kds-text-muted group-hover:text-slate-700 dark:group-hover:text-kds-text-primary transition-colors" />
        )}
      </button>
    </div>
  );
}
