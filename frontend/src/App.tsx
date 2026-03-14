// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from './store/hooks';
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
import { useWebSocket } from './hooks/useWebSocket';
import { useKdsServerBroadcast } from './hooks/useKdsServerBroadcast';
import { useKdsClient, type KdsClientState } from './hooks/useKdsClient';
import { setKdsDebugEnabled, kdsLog } from './utils/kdsLogger';
import React from 'react';

export const KdsClientContext = React.createContext<KdsClientState>({
  orders: [], connected: false, active: false, stabilizing: false,
});
import { store } from './store';
import { addOrder } from './store/slices/ordersSlice';
import { setTmbillOrders } from './store/slices/tmbillOrdersSlice';
import { addFlashOrder } from './store/slices/uiSlice';
import { audioNotificationService } from './utils/audioNotifications';

import History from './pages/History';
import Orders from './pages/Orders';
import Utilities from './pages/Utilities';

// Dev-only helper — call window.__testNewOrder() from DevTools console to simulate a new order
;(window as any).__testNewOrder = () => {
    const mockOrder = {
      id: '999999',
      restaurant_id: '2',
      order_status: 'pending',
      order_type: 'delivery',
      payment_method: 'cash_on_delivery',
      order_amount: '18.99',
      delivery_charge: '2.00',
      total_tax_amount: '0.00',
      order_note: 'Test order — no onions please',
      delivery_instruction: null,
      processing_time: null,
      delivery_man_id: null,
      created_at: new Date().toISOString(),
      schedule_at: null,
      is_scheduled: false,
      order_age_minutes: 0,
      item_count: 2,
      customer_name: 'Test Customer',
      delivery_address: {
        contact_person_name: 'Test Customer',
        contact_person_number: '07700900000',
        address_type: 'home',
        address: '123 Test Street, Preston, PR1 1AA',
        latitude: '53.7632',
        longitude: '-2.7050',
      },
      items: [
        {
          id: '1',
          food_id: '101',
          name: 'Chicken Burger',
          quantity: 2,
          price: '7.99',
          variant: null,
          variations: [],
          add_ons: [{ name: 'Extra Sauce', quantity: 1, price: '0.50' }],
          isReady: false,
        },
        {
          id: '2',
          food_id: '102',
          name: 'Chips (Large)',
          quantity: 1,
          price: '3.00',
          variant: 'Large',
          variations: [],
          add_ons: [],
          isReady: false,
        },
      ],
    };
    store.dispatch(addOrder(mockOrder as any));
    audioNotificationService.playNewOrderNotification();
    console.log('✅ Test CocoEats order dispatched + notification triggered');
};

// Dev-only helper — call window.__testTmbillOrder() from DevTools console to simulate a TMBILL order
;(window as any).__testTmbillOrder = () => {
    const mockRunning = {
      id: 'TMBILL-99999',
      order_number: 'T-99',
      status: 'pending',
      order_type: 'dine_in',
      table_number: 'T5',
      customer_name: 'Test Table',
      customer_phone: '',
      items: [{ id: 'ITEM-1', food_id: '1', name: 'Test Item', quantity: 1, price: '5.00', isReady: false }],
      created_at: new Date().toISOString(),
      _source: 'tmbill',
    };
    const current = (store.getState() as any).tmbillOrders;
    store.dispatch(setTmbillOrders({ running: [...(current?.running ?? []), mockRunning], settled: current?.settled ?? [] }));
    store.dispatch(addFlashOrder('TMBILL-99999'));
    const repeatCount = (store.getState() as any).ui.settings.audioNotifications.notificationRepeatCount ?? 3;
    audioNotificationService.playTmbillNotification(repeatCount);
    console.log(`✅ Test TMBILL order dispatched + TMBILL notification triggered (×${repeatCount})`);
};

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const debugMode = useAppSelector((s) => s.ui.settings.debugMode ?? false);
  const notificationRepeatCount = useAppSelector(
    (s) => s.ui.settings.audioNotifications.notificationRepeatCount ?? 3
  );
  useTmbillOrders();       // Keep TMBILL orders in sync across all pages
  useWebSocket();          // Keep CocoEats WebSocket alive across all pages
  useKdsServerBroadcast(); // Keep KDS host broadcast alive across all pages
  const kdsClient = useKdsClient(); // Keep KDS client connection alive across all pages

  // Ref so the kdsClient effect always reads the latest repeat count without re-subscribing
  const repeatCountRef = useRef(notificationRepeatCount);
  repeatCountRef.current = notificationRepeatCount;

  // Sync debug mode into the kdsLogger module — enables/disables log capture globally
  useEffect(() => {
    setKdsDebugEnabled(debugMode);
  }, [debugMode]);

  // Kitchen screen: play notification when genuinely new orders arrive from the KDS host.
  // On first connect/reconnect the stabilization window absorbs settling broadcasts —
  // we snapshot the baseline when stabilizing ends, then only notify for orders that
  // appear AFTER that snapshot.
  const knownKdsOrderIdsRef = useRef(new Set<string>());
  const prevStabilizingRef  = useRef(false);
  useEffect(() => {
    if (!kdsClient.active) {
      knownKdsOrderIdsRef.current = new Set();
      prevStabilizingRef.current  = false;
      return;
    }
    const currentIds = new Set(kdsClient.orders.map((o: any) => String(o.id)));
    if (kdsClient.stabilizing) {
      prevStabilizingRef.current = true;
      return;
    }
    if (prevStabilizingRef.current) {
      // Stabilization just ended — treat current orders as baseline, no notification
      prevStabilizingRef.current         = false;
      knownKdsOrderIdsRef.current        = currentIds;
      return;
    }
    // Normal operation: detect genuinely new order IDs and play the right sound.
    // TMBILL orders carry _source === 'tmbill' — use the custom TMBILL sound for those.
    const newOrders = kdsClient.orders.filter((o: any) => !knownKdsOrderIdsRef.current.has(String(o.id)));
    if (newOrders.length > 0) {
      const tmbillIds   = newOrders.filter((o: any) => o._source === 'tmbill').map((o: any) => String(o.id));
      const cocoEatsIds = newOrders.filter((o: any) => o._source !== 'tmbill').map((o: any) => String(o.id));
      kdsLog(`[KDS Client] new orders — tmbill: [${tmbillIds.join(', ') || 'none'}], cocoeats: [${cocoEatsIds.join(', ') || 'none'}]`, 'client');
      const repeat = repeatCountRef.current;
      if (tmbillIds.length > 0)   audioNotificationService.playTmbillNotification(repeat);
      if (cocoEatsIds.length > 0) audioNotificationService.playNewOrderNotification(repeat);
      // Flash new order cards on kitchen screen
      newOrders.forEach((o: any) => dispatch(addFlashOrder(String(o.id))));
    }
    knownKdsOrderIdsRef.current = currentIds;
  }, [kdsClient.orders, kdsClient.stabilizing, kdsClient.active, dispatch]);

  return (
    <KdsClientContext.Provider value={kdsClient}>
    <UpdateManager />
    {window.electron?.tailcomEnabled && <IncomingCallBar />}
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
    </KdsClientContext.Provider>
  );
}

export default App;