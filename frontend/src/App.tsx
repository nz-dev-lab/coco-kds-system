import React from 'react';

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-kds-ready">
          🍳 Kitchen Display System
        </h1>
        <p className="text-xl text-gray-400">
          Electron + React + Tailwind - Ready! ✅
        </p>
        <p className="text-sm text-gray-500 mt-2 px-3 py-1 bg-green-600 rounded inline-block animate-pulse">
          ✨ v1.0.2 - AUTO-UPDATE TEST SUCCESS! ✨
        </p>
        <div className="mt-8 p-6 order-card max-w-md mx-auto">
          <p className="text-lg">
            Backend API: <span className="text-kds-confirmed">{import.meta.env.VITE_API_URL}</span>
          </p>
          <p className="text-lg mt-2">
            WebSocket: <span className="text-kds-cooking">{import.meta.env.VITE_WS_URL}</span>
          </p>
          <p className="text-xs text-gray-500 mt-4">
            If you see this green badge, auto-update worked! 🎉
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;