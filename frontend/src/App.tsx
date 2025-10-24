// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'; // ⭐ Changed BrowserRouter to HashRouter
import { useAppSelector } from './store/hooks';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Dispatch from './pages/Dispatch';

// Temporary placeholder components
const OrdersPage = () => (
  <div className="p-6">
    <h1 className="text-3xl font-bold text-slate-800">Orders</h1>
    <p className="text-slate-600 mt-4">Coming soon...</p>
  </div>
);

const HistoryPage = () => (
  <div className="p-6">
    <h1 className="text-3xl font-bold text-slate-800">Order History</h1>
    <p className="text-slate-600 mt-4">Coming soon...</p>
  </div>
);

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

  return (
    <HashRouter> {/* ⭐ Changed BrowserRouter to HashRouter */}
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
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/dispatch" element={<Dispatch />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App;