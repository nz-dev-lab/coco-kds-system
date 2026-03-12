// components/TopBar.tsx
import { Menu, ChevronDown, ChevronUp, Bell, User, LogOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleSidebar, toggleNavbar, setSelectedSource } from '../store/slices/uiSlice';
import { logout } from '../store/slices/authSlice';
import WindowControls from './WindowControls';
import ThemeToggle from './ThemeToggle';

function CocoFlowIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" className={className} fill="currentColor">
      <g transform="translate(0,1024) scale(0.1,-0.1)">
        <path d="M3985 8440 l-1480 -5 -52 -23 c-72 -33 -154 -121 -182 -197 -31 -83
-27 -196 11 -277 41 -88 128 -162 223 -189 16 -5 287 -9 600 -9 316 0 604 -4
647 -10 131 -16 226 -81 285 -192 25 -48 28 -62 28 -158 0 -96 -3 -110 -28
-158 -35 -67 -92 -124 -159 -159 l-53 -28 -395 -6 c-217 -4 -686 -7 -1042 -8
-629 -1 -649 -2 -703 -22 -73 -27 -156 -104 -192 -177 -25 -50 -28 -68 -28
-152 0 -84 3 -102 28 -152 36 -73 119 -150 192 -177 54 -20 74 -21 633 -21
349 0 602 -4 641 -10 119 -20 216 -91 269 -200 24 -48 27 -67 27 -150 0 -84
-3 -102 -28 -152 -36 -73 -119 -150 -192 -177 -55 -21 -70 -21 -928 -21 -552
0 -895 -4 -936 -10 -35 -6 -82 -20 -104 -31 -62 -32 -134 -106 -164 -168 -23
-48 -27 -69 -28 -146 0 -77 4 -98 26 -146 36 -76 86 -129 161 -170 l63 -34
1120 -5 1120 -5 67 -32 c79 -37 142 -98 177 -173 22 -47 26 -69 26 -150 0 -85
-3 -101 -29 -153 -35 -68 -108 -140 -174 -170 -45 -21 -62 -22 -477 -27 -479
-7 -475 -6 -570 -78 -52 -39 -108 -121 -125 -182 -17 -60 -12 -164 11 -225 27
-73 104 -156 177 -192 l57 -28 600 -5 600 -5 119 -175 c293 -432 654 -914
1030 -1375 274 -336 701 -830 717 -830 24 0 536 601 880 1032 1090 1367 1754
2518 1879 3258 28 168 33 275 20 450 -36 497 -186 948 -448 1345 -116 177
-190 268 -336 419 -526 539 -1191 825 -1961 843 -77 2 -806 1 -1620 -2z m1820
-1071 c554 -69 1053 -427 1311 -941 342 -681 191 -1513 -369 -2034 l-82 -76
-6 54 c-4 29 -10 244 -13 478 -4 234 -11 650 -16 925 -10 479 -11 500 -30 519
-40 40 -148 11 -203 -53 -34 -41 -81 -166 -122 -325 -61 -242 -68 -308 -73
-763 l-4 -413 80 0 c65 0 84 -4 106 -21 23 -18 26 -28 26 -78 0 -69 -29 -491
-34 -507 -4 -12 -178 -88 -271 -119 -68 -23 -254 -65 -287 -65 -23 0 -28 5
-32 33 -5 31 -20 260 -52 803 l-16 271 22 49 c15 33 39 62 73 89 63 50 107
112 133 191 17 52 19 87 18 279 -1 151 -6 258 -18 340 -36 253 -66 339 -104
301 -13 -12 -13 -56 -2 -313 6 -164 12 -318 13 -342 2 -50 -20 -74 -50 -55
-16 10 -20 48 -33 351 -17 371 -21 394 -70 363 -13 -8 -16 -65 -20 -377 l-5
-368 -30 0 -30 0 -3 367 c-2 346 -3 368 -21 377 -13 7 -23 7 -35 -2 -14 -10
-18 -59 -31 -342 -9 -181 -18 -340 -21 -353 -4 -18 -10 -23 -32 -20 -26 3 -27
5 -30 73 -1 39 4 194 11 345 8 151 12 280 10 287 -7 18 -29 23 -47 10 -53 -40
-118 -664 -87 -842 21 -122 88 -237 165 -285 21 -12 44 -40 57 -68 l23 -46
-18 -321 c-34 -580 -51 -810 -61 -810 -167 3 -435 62 -588 129 l-54 24 -7 104
c-3 57 -15 247 -26 423 -31 498 -30 503 50 530 234 78 334 365 246 705 -56
219 -173 392 -302 446 -58 25 -140 21 -200 -9 -283 -145 -419 -747 -226 -1002
47 -63 109 -110 174 -132 76 -27 84 -45 80 -183 -3 -127 -40 -732 -45 -737 -5
-4 -172 130 -226 181 -24 22 -77 82 -119 131 -440 523 -531 1257 -232 1868 96
197 205 344 378 507 373 355 875 515 1407 449z"/>
      </g>
    </svg>
  );
}

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
            <h1 className="text-xl text-orange-700 dark:text-orange-400 font-bold">
              Coco - KDS
            </h1>
          </div>

          {/* Center section */}
          <div className="flex items-center gap-2 px-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <span className="text-sm text-slate-600 dark:text-kds-text-muted">Source:</span>
            <select
              value={selectedSource}
              onChange={handleSourceChange}
              className="py-1 px-3 text-sm rounded-lg bg-slate-100 dark:bg-kds-surface border border-slate-300 dark:border-kds-border text-slate-900 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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