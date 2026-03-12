// src/pages/Login.tsx
import { useState, useEffect } from 'react';
import iconUrl from '../assets/icon.png';
import { Eye, EyeOff } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login } from '../store/slices/authSlice';
import TopBarLogin from '../components/TopBarLogin';

const STORAGE_KEY = 'coco_kds_saved_credentials';

export default function Login() {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="h-screen w-screen flex flex-col bg-slate-100 dark:bg-[#0d1b2a]">
      <TopBarLogin />

      <div className="flex-1 flex items-center justify-center pt-12 px-4">
        <div className="w-full max-w-md">
          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-5">
              <img
                src={iconUrl}
                alt="CocoFlow"
                className="w-24 h-24 rounded-3xl shadow-2xl shadow-teal-500/20 dark:shadow-teal-500/30"
              />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent mb-2">
              CocoFlow
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 tracking-widest uppercase">
              Smart orders. Faster kitchens.
            </p>
          </div>

          {/* Login card */}
          <div className="bg-white dark:bg-[#112233] rounded-2xl shadow-xl shadow-slate-200/80 dark:shadow-black/40 border border-slate-100 dark:border-[#1e3a4a] p-8">
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-6">
              Sign in to your kitchen display
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="alert-danger">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-200">
                  Email
                </label>
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0d1b2a] border border-slate-200 dark:border-[#1e3a4a] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-200">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="w-full px-4 py-2.5 pr-12 rounded-xl bg-slate-50 dark:bg-[#0d1b2a] border border-slate-200 dark:border-[#1e3a4a] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 accent-teal-500 cursor-pointer"
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none"
                >
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20 dark:shadow-teal-500/30 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-[#112233]"
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
    </div>
  );
}
