// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppSelector } from './store/hooks';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Dispatch from './pages/Dispatch';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import UpdateManager from './components/UpdateManager';
import IncomingCallBar from './components/IncomingCallBar';
import Foods from './pages/Foods';
import Notifications from './pages/Notifications';
import Help from './pages/Help';
import { useTmbillOrders } from './hooks/useTmbillOrders';
import { setKdsDebugEnabled } from './utils/kdsLogger';

import History from './pages/History';
import Orders from './pages/Orders';
import Utilities from './pages/Utilities';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const debugMode = useAppSelector((s) => s.ui.settings.debugMode ?? false);
  useTmbillOrders(); // Hook to manage TMBILL orders and keep Redux store in sync

  // Sync debug mode into the kdsLogger module — enables/disables log capture globally
  useEffect(() => {
    setKdsDebugEnabled(debugMode);
  }, [debugMode]);

  return (
    <>
    <UpdateManager />
    {window.electron?.talecomEnabled && <IncomingCallBar />}
      <HashRouter>
        <Routes>
          {/* Public Route: Login */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            }
          />
          
          {/* Protected Routes: All others wrapped in MainLayout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/dispatch" element={<Dispatch />} />
                    <Route path="/foods" element={<Foods />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/utilities" element={<Utilities />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
      
      {/* ✅ ADD THIS - Toast Notification Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;