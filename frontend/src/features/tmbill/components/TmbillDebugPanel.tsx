// src/features/tmbill/components/TMBillDebugPanel.tsx
import { useEffect, useState } from 'react';

interface TMBillService {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  type: string;
  txt?: Record<string, any>;
}

interface CapturedData {
  timestamp: string;
  type: 'service' | 'event' | 'error';
  data: any;
}

export default function TMBillDebugPanel() {
  const [services, setServices] = useState<TMBillService[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [capturedData, setCapturedData] = useState<CapturedData[]>([]);

  useEffect(() => {
    if (!window.tmbill) {
      addLog('❌ TMBILL API not available. Plugin may be disabled.');
      return;
    }

    addLog('🚀 Debug panel loaded');
    loadData();

    // Listen for service discovery
    window.tmbill.onServiceFound((service) => {
      const timestamp = new Date().toISOString();
      addLog(`✅ Service found: ${service.name} (${service.host}:${service.port})`);
      
      // Capture full service details
      captureData({
        timestamp,
        type: 'service',
        data: {
          event: 'service-found',
          service: service
        }
      });
      
      setServices((prev) => {
        const exists = prev.find((s) => s.name === service.name);
        if (exists) return prev;
        return [...prev, service];
      });
    });

    window.tmbill.onServiceLost((name) => {
      addLog(`❌ Service lost: ${name}`);
      setServices((prev) => prev.filter((s) => s.name !== name));
    });

    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [servicesData, configData, stateData] = await Promise.all([
        window.tmbill.getServices(),
        window.tmbill.getConfig(),
        window.tmbill.getState(),
      ]);
      
      setServices(servicesData);
      setConfig(configData);
      setState(stateData);
    } catch (error) {
      console.error('Failed to load data:', error);
      addLog(`❌ Error loading data: ${error}`);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  };

  const captureData = (data: CapturedData) => {
    setCapturedData((prev) => [data, ...prev].slice(0, 50));
  };

  const handleRefresh = async () => {
    addLog('🔄 Refreshing services...');
    await loadData();
  };

  const handleStartDiscovery = async () => {
    addLog('🔍 Starting discovery...');
    await window.tmbill.startDiscovery();
    await loadData();
  };

  const handleStopDiscovery = async () => {
    addLog('🛑 Stopping discovery...');
    await window.tmbill.stopDiscovery();
    await loadData();
  };

  const exportCapturedData = () => {
    const dataStr = JSON.stringify(capturedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `tmbill-captured-data-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addLog('💾 Exported captured data');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('📋 Copied to clipboard');
  };

  if (!window.tmbill) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-red-500">❌ TMBILL Plugin Not Available</h1>
          <p className="text-gray-400 mb-4">The TMBILL plugin is not enabled or loaded.</p>
          <p className="text-sm text-gray-500">Check .env.development:</p>
          <code className="block bg-black p-3 rounded mt-2 text-left">
            VITE_ENABLE_TMBILL_PLUGIN=true
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-6 border-2 border-blue-500">
          <h1 className="text-3xl font-bold mb-2">🔌 TMBILL Plugin Debug Panel</h1>
          <p className="text-gray-400">
            On-Site Testing Mode - Captures all TMBILL service data for development
          </p>
          <div className="mt-4 p-3 bg-yellow-900/30 border-l-4 border-yellow-500 rounded">
            <p className="text-yellow-200 text-sm">
              <strong>📝 Instructions:</strong> Connect to restaurant WiFi, ensure TMBILL POS is running, 
              and this panel will automatically discover and log all service details.
            </p>
          </div>
        </div>

        {/* Config & State */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-400">⚙️ Configuration</h2>
            {config ? (
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Enabled:</span>
                  <span className={config.enabled ? 'text-green-500 font-bold' : 'text-red-500'}>
                    {config.enabled ? '✅ YES' : '❌ NO'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Service Type:</span>
                  <span className="text-blue-400 font-bold">{config.serviceType}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Auto Connect:</span>
                  <span className={config.autoConnect ? 'text-green-500' : 'text-gray-500'}>
                    {config.autoConnect ? '✅ YES' : '❌ NO'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-green-400">📊 State</h2>
            {state ? (
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Initialized:</span>
                  <span className={state.initialized ? 'text-green-500 font-bold' : 'text-red-500'}>
                    {state.initialized ? '✅ YES' : '❌ NO'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Discovering:</span>
                  <span className={state.discovering ? 'text-yellow-500 font-bold' : 'text-gray-500'}>
                    {state.discovering ? '🔍 ACTIVE' : '⏸️  PAUSED'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Connected:</span>
                  <span className={state.connected ? 'text-green-500 font-bold' : 'text-gray-500'}>
                    {state.connected ? '✅ YES' : '❌ NO'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Loading...</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🎮 Actions</h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleStartDiscovery}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={state?.discovering}
            >
              🔍 Start Discovery
            </button>
            <button
              onClick={handleStopDiscovery}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!state?.discovering}
            >
              🛑 Stop Discovery
            </button>
            <button
              onClick={exportCapturedData}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
              disabled={capturedData.length === 0}
            >
              💾 Export Data ({capturedData.length})
            </button>
          </div>
        </div>

        {/* Discovered Services */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            📡 Discovered Services ({services.length})
          </h2>
          
          {services.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
              <p className="text-gray-400 text-lg mb-2">🔍 No services found yet...</p>
              <p className="text-gray-500 text-sm mb-4">
                Searching for TMBILL POS on the network...
              </p>
              <div className="text-xs text-gray-600">
                <p>Looking for: {config?.serviceType}</p>
                <p>Also trying: _http._tcp, _tcp, _printer._tcp</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="bg-gradient-to-r from-green-900/20 to-green-800/20 rounded-lg p-4 border-2 border-green-500"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-green-400">{service.name}</h3>
                      <p className="text-sm text-gray-400">{service.type}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-green-600 rounded-full text-sm font-bold">
                        ✅ ACTIVE
                      </span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(service, null, 2))}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 font-mono text-sm bg-black/30 rounded p-3">
                    <div>
                      <span className="text-gray-400">Host:</span>
                      <span className="ml-2 text-blue-400 font-bold">{service.host}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Port:</span>
                      <span className="ml-2 text-blue-400 font-bold">{service.port}</span>
                    </div>
                  </div>
                  
                  {service.addresses.length > 0 && (
                    <div className="mt-3 font-mono text-sm">
                      <span className="text-gray-400">IP Addresses:</span>
                      <div className="ml-2 text-blue-400 flex gap-2 flex-wrap mt-1">
                        {service.addresses.map((addr, idx) => (
                          <span key={idx} className="bg-blue-900/30 px-2 py-1 rounded">
                            {addr}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {service.txt && Object.keys(service.txt).length > 0 && (
                    <div className="mt-3 font-mono text-sm">
                      <span className="text-gray-400">TXT Records:</span>
                      <pre className="ml-2 text-xs text-blue-400 mt-1 bg-black/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(service.txt, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-yellow-900/30 border-l-4 border-yellow-500 rounded">
                    <p className="text-yellow-200 text-sm">
                      <strong>✅ TMBILL Service Found!</strong> Next step: Connect to this service 
                      and capture order events. Connection URL: <code>http://{service.host}:{service.port}</code>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Captured Data */}
        {capturedData.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">📦 Captured Data ({capturedData.length})</h2>
              <button
                onClick={() => setCapturedData([])}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                🗑️ Clear
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {capturedData.map((item, idx) => (
                <div key={idx} className="bg-gray-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{item.timestamp}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      item.type === 'service' ? 'bg-green-600' :
                      item.type === 'event' ? 'bg-blue-600' :
                      'bg-red-600'
                    }`}>
                      {item.type.toUpperCase()}
                    </span>
                  </div>
                  <pre className="text-xs text-gray-300 bg-black/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Log */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📝 Event Log</h2>
          <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-gray-500">No events yet...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="text-gray-300 mb-1 hover:bg-gray-900 px-2 py-1 rounded">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}