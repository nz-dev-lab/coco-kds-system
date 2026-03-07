// src/pages/Login.tsx
import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login } from '../store/slices/authSlice';
import TopBarLogin from '../components/TopBarLogin';

const STORAGE_KEY = 'coco_kds_saved_credentials';

export default function Login() {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);

  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { email, password } = JSON.parse(saved);
        setCredentials({ email, password });
        setRememberMe(true);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    await dispatch(login(credentials));
  };

  return (
    <div className="h-screen w-screen flex flex-col 
                    bg-slate-50 dark:bg-kds-bg">
      {/*               ^^^^^^^^^ light  ^^^^^^^^^^^ dark */}
      
      {/* TopBar for window controls */}
      <TopBarLogin />
      
      {/* Login form - centered */}
      <div className="flex-1 flex items-center justify-center pt-12">
        <div className="w-full max-w-md p-8 rounded-card shadow-lg
                        bg-white dark:bg-kds-bg-secondary
                        border border-slate-200 dark:border-kds-border">
          {/*           ^^^^^^^^ light card    ^^^^^^^^^^^^^^^^^ dark card */}
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2
                           text-green-600 dark:text-kds-ready">
              Coco - KDS
            </h1>
            <p className="text-slate-600 dark:text-kds-text-secondary">
              Sign in to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="alert-danger">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2
                                text-slate-700 dark:text-kds-text-primary">
                Email
              </label>
              <input
                type="email"
                value={credentials.email}
                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg
                           bg-slate-100 dark:bg-kds-surface
                           border border-slate-300 dark:border-kds-border
                           text-slate-900 dark:text-kds-text-primary
                           placeholder-slate-400 dark:placeholder-kds-text-muted
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2
                                text-slate-700 dark:text-kds-text-primary">
                Password
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full px-4 py-2 rounded-lg
                           bg-slate-100 dark:bg-kds-surface
                           border border-slate-300 dark:border-kds-border
                           text-slate-900 dark:text-kds-text-primary
                           placeholder-slate-400 dark:placeholder-kds-text-muted
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-kds-border accent-blue-500 cursor-pointer"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-slate-600 dark:text-kds-text-secondary cursor-pointer select-none"
              >
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-block"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner"></span>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}