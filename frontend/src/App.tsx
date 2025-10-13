// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

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

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;