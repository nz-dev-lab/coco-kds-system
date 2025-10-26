// components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ClipboardList, Settings, ChevronLeft, ChevronRight, History, Truck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleSidebar } from '../store/slices/uiSlice';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
  },
  {
    id: 'dispatch',
    label: 'Dispatch',
    icon: Truck,
    path: '/dispatch',
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ClipboardList,
    path: '/orders',
  },
  {
    id: 'history',
    label: 'History',
    icon: History,
    path: '/history',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
  },
];

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const version = import.meta.env.VITE_APP_VERSION || '0.0.0';

  const handleToggle = () => {
    dispatch(toggleSidebar());
  };

  return (
    <aside
      className={`relative bg-white dark:bg-kds-bg-secondary border-r border-slate-200 dark:border-kds-border transition-all duration-300 ease-in-out z-20 ${
        sidebarOpen ? 'w-64' : 'w-0'
      }`}
    >
      {sidebarOpen && (
        <div className="h-full flex flex-col p-4">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-kds-text-secondary mb-1">
              Navigation
            </h2>
            <div className="h-0.5 bg-slate-200 dark:bg-kds-border rounded"></div>
          </div>

          <nav className="flex-1 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-kds-surface text-blue-700 dark:text-kds-text-primary font-medium border border-blue-200 dark:border-kds-border'
                        : 'text-slate-600 dark:text-kds-text-secondary hover:bg-slate-100 dark:hover:bg-kds-surface hover:text-slate-900 dark:hover:text-kds-text-primary'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-200 dark:border-kds-border">
            <div className="text-xs text-slate-500 dark:text-kds-text-muted">
              <div className="flex justify-between mb-1">
                <span>Version</span>
                <span className="font-mono text-slate-700 dark:text-kds-text-secondary">{version}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-green-600 dark:text-green-400">Online</span>
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Powered By</span>
                <span className="font-mono text-md text-slate-700 dark:text-kds-text-secondary">NM</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        className="absolute top-1/2 -translate-y-1/2 -right-3 bg-white dark:bg-kds-bg-secondary border border-slate-200 dark:border-kds-border rounded-r-lg py-4 px-1 hover:bg-slate-100 dark:hover:bg-kds-surface transition-all group shadow-md dark:shadow-none"
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4 text-slate-400 dark:text-kds-text-muted group-hover:text-slate-700 dark:group-hover:text-kds-text-primary transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-kds-text-muted group-hover:text-slate-700 dark:group-hover:text-kds-text-primary transition-colors" />
        )}
      </button>
    </aside>
  );
}