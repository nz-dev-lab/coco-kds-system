// src/hooks/useStationFilter.ts
// Filters a list of unified DisplayOrders down to only orders/items relevant
// to this screen's station setting. Used by Dashboard for local filtering when
// the app runs standalone (not as a WebSocket thin client).
//
// Mirrors the server-side filterOrdersForStation() logic in kds-server.ts.

import { useMemo, useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import type { CanonicalItem } from '../types/electron';

function parseStations(station: string | null | undefined): string[] {
  if (!station) return [];
  try {
    const parsed = JSON.parse(station);
    return Array.isArray(parsed) ? parsed : [station];
  } catch {
    return [station];
  }
}

export function useStationFilter(orders: any[]): any[] {
  const stationView = useAppSelector((s) => s.ui.settings.stationView ?? 'all');
  const [canonicals, setCanonicals] = useState<CanonicalItem[]>([]);

  // Load canonical items whenever the station view changes (also covers mount).
  // Only runs in Electron where mapping API is available.
  useEffect(() => {
    if (stationView === 'all') return;
    if (!window.electron?.mapping) return;
    window.electron.mapping
      .getAll()
      .then((res) => { if (res.success && res.data) setCanonicals(res.data); })
      .catch(() => {});
  }, [stationView]);

  return useMemo(() => {
    if (stationView === 'all') return orders;

    // Canonicals not loaded yet — show everything to avoid blank screen flash
    if (canonicals.length === 0) return orders;

    // Build lookup maps: food_id / item_id → station list
    const foodStations    = new Map<string, string[]>(); // cocoeats food_id   → stations
    const tmbillStations  = new Map<number, string[]>(); // tmbill item_id     → stations
    const tmbillNameSt    = new Map<string, string[]>(); // tmbill item_name   → stations (fallback for QB orders)

    for (const canonical of canonicals) {
      const stations = parseStations(canonical.station);
      if (stations.length === 0) continue;
      for (const m of canonical.cocoeats_maps) foodStations.set(m.food_id, stations);
      for (const m of canonical.tmbill_maps) {
        tmbillStations.set(m.item_id, stations);
        tmbillNameSt.set(m.item_name.toLowerCase(), stations);
      }
    }

    const result: any[] = [];

    for (const order of orders) {
      const isTmbill = order._source === 'tmbill';

      const filteredItems = (order.items ?? []).filter((item: any) => {
        // Running KOT orders: food_id = menu item_id as string → ID lookup works.
        // Settled/QB orders:  food_id = order child row id    → ID lookup fails,
        //                     fall back to name match against tmbill_maps.item_name.
        const stations = isTmbill
          ? (tmbillStations.get(parseInt(item.food_id, 10))
              ?? tmbillNameSt.get((item.name as string).toLowerCase())
              ?? [])
          : (foodStations.get(item.food_id) ?? []);

        // Unassigned items are only visible on 'all' screens (packing/manager)
        if (stations.length === 0) return false;
        return stations.includes(stationView);
      });

      // Keep all station-matched items (including ready ones) so the card can show
      // strikethrough. Only hide the order entirely when every item is done.
      const allDone = filteredItems.every((item: any) => item.isReady);
      if (!allDone) {
        result.push({ ...order, items: filteredItems });
      }
    }

    return result;
  }, [orders, stationView, canonicals]);
}
