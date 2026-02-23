import { useEffect, useState } from 'react';
import {TMBillService} from "../../../../electron/plugins/tmbill/types";
import {CocoKDSOrder, CocoKDSOrderItem} from "../../../../electron/plugins/tmbill/transformer";

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
  
  // Authentication
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Connection
  const [isConnected, setIsConnected] = useState(false);
  
  // Orders
  const [orders, setOrders] = useState<CocoKDSOrder[]>([]);
  
  // Manual IP entry
  const [manualIP, setManualIP] = useState('');
  const [manualPort, setManualPort] = useState('3000');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    if (!window.tmbill) {
      addLog('❌ TMBILL API not available. Plugin may be disabled.');
      return;
    }

    addLog('🚀 Debug panel loaded');
    loadData();

    // Listen for service discovery
    window.tmbill.onServiceFound((service: TMBillService) => {
      addLog(`✅ Service found: ${service.name} (${service.host}:${service.port})`);
      
      captureData({
        timestamp: new Date().toISOString(),
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

    window.tmbill.onServiceLost((name: string) => {
      addLog(`❌ Service lost: ${name}`);
      setServices((prev) => prev.filter((s) => s.name !== name));
    });

    // Listen for logs from plugin
    if (window.tmbill.onLog) {
      window.tmbill.onLog((data: { message: string; type?: string }) => {
        addLog(data.message);
      });
    }

    // Listen for orders
    if (window.tmbill.onNewOrder) {
      window.tmbill.onNewOrder((order: CocoKDSOrder) => {
        addLog(`📦 New order received: ${order.order_number}`);
        setOrders((prev) => [order, ...prev]);
        
        captureData({
          timestamp: new Date().toISOString(),
          type: 'event',
          data: {
            event: 'new-order',
            order: order
          }
        });
      });
    }

    if (window.tmbill.onOrderUpdated) {
      window.tmbill.onOrderUpdated((order: CocoKDSOrder) => {
        addLog(`🔄 Order updated: ${order.order_number}`);
        setOrders((prev) => {
          const index = prev.findIndex((o) => o.id === order.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = order;
            return updated;
          }
          return prev;
        });
        
        captureData({
          timestamp: new Date().toISOString(),
          type: 'event',
          data: {
            event: 'order-updated',
            order: order
          }
        });
      });
    }

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
      setIsAuthenticated(stateData.authenticated);
      setIsConnected(stateData.connected);
      setJwtToken(stateData.token);
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

  const handleManualConnect = async () => {
    if (!manualIP) {
      addLog('❌ Please enter IP address');
      return;
    }
    
    // Validate IP format
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = manualIP.match(ipPattern);
    
    if (!match) {
      addLog('❌ Invalid IP format. Example: 192.168.1.152');
      return;
    }
    
    // Check each octet is 0-255
    const octets = match.slice(1, 5).map(Number);
    if (octets.some(octet => octet > 255 || octet < 0)) {
      addLog('❌ Invalid IP: Each number must be between 0-255');
      addLog(`❌ Your IP has: ${octets.join('.')} - check the numbers!`);
      return;
    }
    
    setIsTestingConnection(true);
    addLog(`🔍 Testing connection to ${manualIP}:${manualPort}...`);
    
    // Test the connection
    try {
      const testUrl = `http://${manualIP}:${manualPort}/`;
      
      // Try to fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(testUrl, {
        method: 'GET',
        mode: 'no-cors', // Important for CORS
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      addLog(`✅ Connection test passed: ${manualIP}:${manualPort} is reachable`);
      
      // Create manual service
      const manualService: TMBillService = {
        name: `TMBill POS (Manual) - ${manualIP}`,
        host: manualIP,
        port: parseInt(manualPort) || 3000,
        addresses: [manualIP],
        type: '_http._tcp',
        txt: {
          url: testUrl,
          manual: 'true'
        }
      };
      
      // Add to services list and force re-render
      setServices([manualService]);
      addLog(`✅ Manual service added: ${manualIP}:${manualPort}`);
      addLog(`✅ Authentication section should appear below`);
      
      captureData({
        timestamp: new Date().toISOString(),
        type: 'service',
        data: {
          event: 'manual-service-added',
          service: manualService,
          connectionTest: 'passed'
        }
      });
      
    } catch (error: any) {
      addLog(`❌ Connection test FAILED: ${manualIP}:${manualPort}`);
      
      if (error.name === 'AbortError') {
        addLog(`❌ Connection timeout - server didn't respond in 5 seconds`);
      } else {
        addLog(`❌ Error: ${error.message}`);
      }
      
      addLog(`❌ Please check:`);
      addLog(`   1. IP address is correct`);
      addLog(`   2. TMBILL POS is running on that computer`);
      addLog(`   3. Port 3000 is open (not blocked by firewall)`);
      addLog(`   4. Both computers are on same network`);
      
      captureData({
        timestamp: new Date().toISOString(),
        type: 'error',
        data: {
          event: 'manual-service-test-failed',
          ip: manualIP,
          port: manualPort,
          error: error.message
        }
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLogin = async () => {
    if (!services[0]) {
      addLog('❌ No TMBILL service found. Discover first.');
      return;
    }

    const service = services[0];
    addLog(`🔐 Authenticating with ${service.host}:${service.port}...`);

    try {
      const result = await window.tmbill.authenticate(service, username, password);

      if (result.success && result.token) {
        setJwtToken(result.token);
        setIsAuthenticated(true);
        addLog(`✅ Authentication successful!`);
        addLog(`👤 User: ${username}`);
        
        captureData({
          timestamp: new Date().toISOString(),
          type: 'event',
          data: {
            event: 'login-success',
            username: username,
            storeDetails: result.storeDetails,
          }
        });
        
        await loadData();
      } else {
        addLog(`❌ Authentication failed: ${result.error}`);
        captureData({
          timestamp: new Date().toISOString(),
          type: 'error',
          data: {
            event: 'login-failed',
            error: result.error,
          }
        });
      }
    } catch (error: any) {
      addLog(`❌ Login error: ${error.message}`);
    }
  };

  const handleConnectSocket = async () => {
    addLog('🔌 Connecting to Socket.IO...');
    
    try {
      const result = await window.tmbill.connectSocket();
      
      if (result.success) {
        setIsConnected(true);
        addLog('✅ Socket.IO connected successfully!');
        addLog('👂 Now listening for orders...');
        await loadData();
      } else {
        addLog(`❌ Connection failed: ${result.error}`);
      }
    } catch (error: any) {
      addLog(`❌ Connection error: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await window.tmbill.disconnect();
      setIsConnected(false);
      setIsAuthenticated(false);
      setJwtToken(null);
      setOrders([]);
      addLog('🔌 Disconnected from TMBILL POS');
      await loadData();
    } catch (error: any) {
      addLog(`❌ Disconnect error: ${error.message}`);
    }
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
          <p className="text-sm text-gray-500">Check electron/main.ts to enable the plugin.</p>
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
          <p className="text-sm text-gray-500 mt-2">
            📝 Instructions: Connect to restaurant WiFi, ensure TMBILL POS is running, and this panel will automatically discover and log all service details.
          </p>
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
                  <span className={state.initialized ? 'text-green-500 font-bold' : 'text-gray-500'}>
                    {state.initialized ? '✅ YES' : '❌ NO'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Discovering:</span>
                  <span className={state.discovering ? 'text-yellow-500 font-bold' : 'text-gray-500'}>
                    {state.discovering ? '🔍 ACTIVE' : '⏸️ PAUSED'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Authenticated:</span>
                  <span className={isAuthenticated ? 'text-green-500 font-bold' : 'text-gray-500'}>
                    {isAuthenticated ? '✅ YES' : '❌ NO'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Connected:</span>
                  <span className={isConnected ? 'text-green-500 font-bold' : 'text-gray-500'}>
                    {isConnected ? '✅ YES' : '❌ NO'}
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
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition disabled:opacity-50"
              disabled={state?.discovering}
            >
              🔍 Start Discovery
            </button>
            <button
              onClick={handleStopDiscovery}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition disabled:opacity-50"
              disabled={!state?.discovering}
            >
              🛑 Stop Discovery
            </button>
            <button
              onClick={exportCapturedData}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition disabled:opacity-50"
              disabled={capturedData.length === 0}
            >
              💾 Export Data ({capturedData.length})
            </button>
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
              >
                🔌 Disconnect
              </button>
            )}
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
              <p className="text-gray-500 text-sm">
                Searching for TMBILL POS on the network...
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Looking for: {config?.serviceType || '_http._tcp'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-green-900/20 to-green-800/20 rounded-lg p-4 border-2 border-green-500"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-green-400">{service.name}</h3>
                      <p className="text-sm text-gray-400">{service.type}</p>
                      <p className="text-xs text-green-600 mt-1">✅ ACTIVE</p>
                      {service.txt?.manual && (
                        <p className="text-xs text-yellow-500 mt-1">⚠️ MANUALLY ADDED</p>
                      )}
                    </div>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(service, null, 2))}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
                    >
                      📋 Copy
                    </button>
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
                    <div className="mt-3">
                      <span className="text-gray-400 text-sm">TXT Records:</span>
                      <pre className="mt-1 bg-black/50 rounded p-2 text-xs overflow-x-auto">
                        {JSON.stringify(service.txt, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual IP Entry - Show when no services found */}
        {services.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-yellow-600">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">
              ⚠️ Service Not Found - Manual Connection
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              If automatic discovery fails, you can manually enter the TMBILL POS IP address and test the connection.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  TMBILL POS IP Address:
                </label>
                <input
                  type="text"
                  value={manualIP}
                  onChange={(e) => setManualIP(e.target.value)}
                  placeholder="192.168.1.152"
                  className="w-full px-4 py-2 bg-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={isTestingConnection}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Port (usually 3000):
                </label>
                <input
                  type="number"
                  value={manualPort}
                  onChange={(e) => setManualPort(e.target.value)}
                  placeholder="3000"
                  className="w-full px-4 py-2 bg-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={isTestingConnection}
                />
              </div>
              
              <button
                onClick={handleManualConnect}
                disabled={isTestingConnection || !manualIP}
                className="w-full px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingConnection ? '🔍 Testing Connection...' : '🔗 Test & Add Manual Service'}
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-blue-900/30 border-l-4 border-blue-500 rounded text-sm text-blue-200">
              <strong>💡 How to find TMBILL POS IP:</strong>
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>Ask staff which computer runs TMBILL POS software</li>
                <li>On that computer, open Command Prompt</li>
                <li>Type: <code className="bg-black px-2 py-1 rounded">ipconfig</code></li>
                <li>Look for "IPv4 Address" under WiFi or Ethernet adapter</li>
                <li>Enter that IP here (e.g., 192.168.1.152)</li>
                <li>Click "Test & Add Manual Service" - it will verify the connection first</li>
              </ol>
            </div>
          </div>
        )}

        {/* Authentication Section - Shows when service is available */}
        {services.length > 0 && !isAuthenticated && (
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-yellow-600">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">
              🔐 TMBILL Authentication
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Enter TMBILL POS credentials to connect and receive orders
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Username:
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-4 py-2 bg-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && password && handleLogin()}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-2 bg-gray-700 rounded text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && username && handleLogin()}
                />
              </div>
              
              <button
                onClick={handleLogin}
                disabled={!username || !password}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                🔐 Login to TMBILL POS
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-blue-900/30 border-l-4 border-blue-500 rounded text-sm text-blue-200">
              <strong>💡 Where to get credentials:</strong>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Ask restaurant staff for TMBILL login credentials</li>
                <li>Same credentials they use for TMBILL KDS app</li>
                <li>Usually: username = "admin" or "manager"</li>
              </ul>
            </div>
          </div>
        )}

        {/* Authenticated - Connect Socket.IO */}
        {isAuthenticated && !isConnected && (
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-600">
            <h2 className="text-xl font-bold mb-4 text-green-400">
              ✅ Authenticated Successfully
            </h2>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Username:</span>
                <span className="text-green-400 font-bold">{username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Token:</span>
                <span className="text-green-400 font-mono text-xs">
                  {jwtToken?.substring(0, 20)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-green-400 font-bold">Ready to Connect</span>
              </div>
            </div>
            
            <button
              onClick={handleConnectSocket}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition"
            >
              🔌 Connect to Socket.IO & Start Receiving Orders
            </button>
          </div>
        )}

        {/* Connected - Receiving Orders */}
        {isConnected && (
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-600">
            <h2 className="text-xl font-bold mb-4 text-green-400">
              🎉 Connected & Listening for Orders
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Receiving orders in real-time</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-green-900/30 rounded p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{orders.length}</p>
                  <p className="text-gray-400 text-xs mt-1">Orders Received</p>
                </div>
                <div className="bg-blue-900/30 rounded p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">{services[0]?.host}</p>
                  <p className="text-gray-400 text-xs mt-1">POS Server</p>
                </div>
                <div className="bg-purple-900/30 rounded p-3 text-center">
                  <p className="text-2xl font-bold text-purple-400">{username}</p>
                  <p className="text-gray-400 text-xs mt-1">Connected As</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders Display */}
        {orders.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              📦 Received Orders ({orders.length})
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {orders.map((order, idx) => (
                <div key={idx} className="bg-gray-700 rounded-lg p-4 border-l-4 border-green-500">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-green-400">{order.order_number}</h3>
                      <p className="text-sm text-gray-400">
                        {order.customer_name} {order.customer_phone && `• ${order.customer_phone}`}
                      </p>
                      {order.table_number && (
                        <p className="text-xs text-blue-400 mt-1">
                          🍽️ Table: {order.table_number}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-green-400">${order.total_amount}</p>
                      <p className="text-xs px-2 py-1 bg-blue-600 rounded mt-1">{order.status}</p>
                      <p className="text-xs text-gray-500 mt-1">{order.order_type}</p>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 rounded p-3 mb-3">
                    <p className="text-sm text-gray-400 mb-2 font-bold">Items ({order.items.length}):</p>
                    <div className="space-y-1">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-gray-600 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 font-bold">{item.quantity}x</span>
                            <span>{item.name}</span>
                            {item.isReady && <span className="text-xs bg-green-600 px-2 py-0.5 rounded">✓ Ready</span>}
                          </div>
                          <span className="text-gray-400">${item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-500">
                      🕐 Created: {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(order, null, 2))}
                    className="mt-3 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition"
                  >
                    📋 Copy Order JSON
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Captured Data */}
        {capturedData.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">📦 Captured Data ({capturedData.length})</h2>
              <button
                onClick={() => setCapturedData([])}
                className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition"
              >
                🗑️ Clear
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {capturedData.map((item, idx) => (
                <details key={idx} className="bg-gray-700 rounded p-2 cursor-pointer">
                  <summary className="font-mono text-xs">
                    <span className="text-gray-400">{item.timestamp}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      item.type === 'service' ? 'bg-blue-600' :
                      item.type === 'event' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      {item.type.toUpperCase()}
                    </span>
                  </summary>
                  <pre className="mt-2 text-xs overflow-x-auto bg-black/50 rounded p-2">
                    {JSON.stringify(item.data, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Event Log */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📝 Event Log</h2>
          <div className="bg-black rounded-lg p-4 h-80 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <p className="text-gray-500">No events yet...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="text-gray-300 hover:bg-gray-800 px-2 py-1 rounded">
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