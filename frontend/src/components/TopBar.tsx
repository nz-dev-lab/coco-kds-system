// components/TopBar.tsx
import { Menu, ChevronDown, ChevronUp, Bell, User, LogOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleSidebar, toggleNavbar, setSelectedStation } from '../store/slices/uiSlice';
import { logout } from '../store/slices/authSlice';
import WindowControls from './WindowControls';
import ThemeToggle from './ThemeToggle';

const stations = [
  'Main Kitchen',
  'Grill Station',
  'Dessert Station',
  'Bar',
];

export default function TopBar() {
  const dispatch = useAppDispatch();
  const { navbarOpen, selectedStation } = useAppSelector((state) => state.ui);

  const handleLogout = () => {
    dispatch(logout());
  };

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleToggleNavbar = () => {
    dispatch(toggleNavbar());
  };

  const handleStationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setSelectedStation(e.target.value));
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
            <h1 className="text-xl text-orange-700 dark:text-orange-400 font-bold">
              Coco - KDS
            </h1>
          </div>

          {/* Center section */}
          <div className="flex items-center gap-2 px-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <span className="text-sm text-slate-600 dark:text-kds-text-muted">Station:</span>
            <select
              value={selectedStation}
              onChange={handleStationChange}
              className="py-1 px-3 text-sm rounded-lg bg-slate-100 dark:bg-kds-surface border border-slate-300 dark:border-kds-border text-slate-900 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {stations.map((station) => (
                <option key={station} value={station}>
                  {station}
                </option>
              ))}
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