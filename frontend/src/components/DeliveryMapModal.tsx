// src/components/DeliveryMapModal.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { X, RefreshCw, Navigation, AlertCircle } from 'lucide-react';
import { Order } from '@/types/order.type';
import { useAppSelector } from '@/store/hooks';
import 'leaflet/dist/leaflet.css';

// ── Fix Leaflet default icon paths broken by bundlers ─────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Custom icons ──────────────────────────────────────────────────────────────
const dmIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:32px;height:32px;border-radius:50%;
    background:#6d28d9;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='white' viewBox='0 0 24 24'>
      <path d='M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3m-4 12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm8 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM23 11H11v8h12v-8z'/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const customerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:32px;height:32px;border-radius:50%;
    background:#dc2626;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='white' viewBox='0 0 24 24'>
      <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface DmLocation {
  delivery_man_id: string;
  latitude: string;
  longitude: string;
  location: string;
  updated_at: string;
}

interface RouteInfo {
  durationSeconds: number;
  distanceMeters: number;
  geometry: [number, number][]; // [lat, lng] pairs for Leaflet
}

// ── Map bounds fitter — runs once when positions first become available ───────
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || positions.length === 0) return;
    fitted.current = true;
    if (positions.length >= 2) {
      map.fitBounds(L.latLngBounds(positions), { padding: [48, 48] });
    } else {
      map.setView(positions[0], 15);
    }
  }, [map, positions]);
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
}

const REFRESH_INTERVAL_MS = 30_000;

export default function DeliveryMapModal({ isOpen, onClose, order }: Props) {
  const osrmUrl = useAppSelector((state) => state.ui.settings.osrmUrl ?? 'http://localhost:5000');
  const token   = useAppSelector((state) => state.auth.token);
  const [dmLocation, setDmLocation]     = useState<DmLocation | null>(null);
  const [routeInfo, setRouteInfo]       = useState<RouteInfo | null>(null);
  const [loadingDm, setLoadingDm]       = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [dmError, setDmError]           = useState<string | null>(null);
  const [routeError, setRouteError]     = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Customer coordinates from order
  const customerLat = order.delivery_address?.latitude
    ? parseFloat(order.delivery_address.latitude)
    : null;
  const customerLng = order.delivery_address?.longitude
    ? parseFloat(order.delivery_address.longitude)
    : null;
  const hasCustomerCoords =
    customerLat !== null && customerLng !== null &&
    !isNaN(customerLat) && !isNaN(customerLng) &&
    (customerLat !== 0 || customerLng !== 0);

  // ── Fetch DM location ──────────────────────────────────────────────────────
  const fetchDmLocation = useCallback(async () => {
    setLoadingDm(true);
    setDmError(null);
    try {
      const { data } = await axios.get<DmLocation>(
        `${import.meta.env.VITE_API_URL}/api/kds/delivery/dm-location/${order.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setDmLocation(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not fetch delivery man location';
      setDmError(msg);
      setDmLocation(null);
    } finally {
      setLoadingDm(false);
    }
  }, [order.id, token]);

  // ── Fetch OSRM route ───────────────────────────────────────────────────────
  const fetchRoute = useCallback(async (dm: DmLocation) => {
    if (!hasCustomerCoords) return;
    const dmLat = parseFloat(dm.latitude);
    const dmLng = parseFloat(dm.longitude);
    if (isNaN(dmLat) || isNaN(dmLng)) return;

    setLoadingRoute(true);
    setRouteError(null);
    try {
      const url =
        `${osrmUrl}/route/v1/driving/` +
        `${dmLng},${dmLat};${customerLng},${customerLat}` +
        `?overview=full&geometries=geojson`;
      const { data } = await axios.get(url);

      if (data.code !== 'Ok' || !data.routes?.length) {
        setRouteError('No route found');
        return;
      }

      const route = data.routes[0];
      // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
      const geometry: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng],
      );

      setRouteInfo({
        durationSeconds: route.duration,
        distanceMeters: route.distance,
        geometry,
      });
    } catch {
      setRouteError('OSRM unavailable — route not shown');
    } finally {
      setLoadingRoute(false);
    }
  }, [hasCustomerCoords, customerLat, customerLng, osrmUrl]);

  // ── Initial load + auto-refresh ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    fetchDmLocation();

    intervalRef.current = setInterval(fetchDmLocation, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, fetchDmLocation]);

  // Fetch route whenever DM location updates
  useEffect(() => {
    if (dmLocation) fetchRoute(dmLocation);
  }, [dmLocation, fetchRoute]);

  // ── Build map positions ────────────────────────────────────────────────────
  const dmLat  = dmLocation ? parseFloat(dmLocation.latitude)  : null;
  const dmLng  = dmLocation ? parseFloat(dmLocation.longitude) : null;
  const hasDmCoords = dmLat !== null && dmLng !== null && !isNaN(dmLat) && !isNaN(dmLng);

  const mapPositions: [number, number][] = [
    ...(hasDmCoords ? [[dmLat!, dmLng!] as [number, number]] : []),
    ...(hasCustomerCoords ? [[customerLat!, customerLng!] as [number, number]] : []),
  ];

  const defaultCenter: [number, number] = mapPositions[0] ?? [53.75, -2.5];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-kds-border bg-purple-600 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <Navigation className="w-5 h-5" />
            <div>
              <h2 className="text-lg font-bold">Live Tracking — Order #{order.id}</h2>
              <p className="text-purple-200 text-xs truncate max-w-xs">
                {order.delivery_address?.address ?? 'No address'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDmLocation}
              disabled={loadingDm}
              title="Refresh location"
              className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDm ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ETA bar */}
        {(routeInfo || loadingRoute) && (
          <div className="flex items-center gap-6 px-5 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800">
            {routeInfo && !loadingRoute ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-700 dark:text-purple-300 font-medium uppercase tracking-wide">ETA</span>
                  <span className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    {formatDuration(routeInfo.durationSeconds)}
                  </span>
                </div>
                <div className="w-px h-8 bg-purple-300 dark:bg-purple-700" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-700 dark:text-purple-300 font-medium uppercase tracking-wide">Distance</span>
                  <span className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    {formatDistance(routeInfo.distanceMeters)}
                  </span>
                </div>
                {dmLocation && (
                  <>
                    <div className="w-px h-8 bg-purple-300 dark:bg-purple-700 ml-auto" />
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      Updated {formatUpdatedAt(dmLocation.updated_at)}
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="text-xs text-purple-600 dark:text-purple-400 animate-pulse">
                Calculating route…
              </span>
            )}
          </div>
        )}

        {/* Map area */}
        <div className="relative" style={{ height: 420, flexShrink: 0 }}>
          {/* DM error overlay */}
          {dmError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 dark:bg-kds-bg-secondary/90">
              <div className="text-center p-6">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-slate-700 dark:text-kds-text-primary font-medium mb-1">
                  Location unavailable
                </p>
                <p className="text-sm text-slate-500 dark:text-kds-text-muted">{dmError}</p>
                <button
                  onClick={fetchDmLocation}
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Route error banner */}
          {routeError && !dmError && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-full text-xs text-yellow-800 shadow">
              {routeError}
            </div>
          )}

          <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Auto-fit bounds */}
            {mapPositions.length > 0 && <FitBounds positions={mapPositions} />}

            {/* DM marker */}
            {hasDmCoords && (
              <Marker position={[dmLat!, dmLng!]} icon={dmIcon} />
            )}

            {/* Customer marker */}
            {hasCustomerCoords && (
              <Marker position={[customerLat!, customerLng!]} icon={customerIcon} />
            )}

            {/* Route polyline */}
            {routeInfo && (
              <Polyline
                positions={routeInfo.geometry}
                color="#6d28d9"
                weight={4}
                opacity={0.8}
              />
            )}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 px-5 py-3 border-t border-slate-200 dark:border-kds-border text-xs text-slate-600 dark:text-kds-text-secondary bg-slate-50 dark:bg-kds-surface">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-purple-700 border-2 border-white shadow" />
            <span>Delivery Man</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow" />
            <span>Customer</span>
          </div>
          {!hasCustomerCoords && (
            <span className="text-yellow-600 dark:text-yellow-400 ml-auto">
              Customer coordinates not available
            </span>
          )}
          {isOpen && (
            <span className="ml-auto text-slate-400 dark:text-kds-text-muted">
              Auto-refreshes every 30s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
