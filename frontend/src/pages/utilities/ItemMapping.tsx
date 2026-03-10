// src/pages/utilities/ItemMapping.tsx
// For each CocoEats food, map which TMBILL menu items correspond to it.
// Canonical items are auto-created/managed internally — not exposed in UI.

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { Plus, X, ChevronRight, Tag, RefreshCw, Search, Utensils } from 'lucide-react';
import type { CanonicalItem, TmbillMenuItem } from '../../types/electron.d';
import type { Food } from '../../types/food.type';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchFoods } from '../../store/slices/foodsSlice';
import { selectTmbillMenu } from '../../store/slices/tmbillOrdersSlice';

// ── Station definitions ───────────────────────────────────────────────────────

const STATIONS = [
  {
    id: 'main_kitchen',
    label: 'Main Kitchen',
    activeClass:   'bg-orange-500 text-white',
    inactiveClass: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40',
    badgeClass:    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    dotClass:      'bg-orange-500',
  },
  {
    id: 'grill',
    label: 'Grill & Shawarma',
    activeClass:   'bg-red-500 text-white',
    inactiveClass: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40',
    badgeClass:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    dotClass:      'bg-red-500',
  },
] as const;

type StationId = typeof STATIONS[number]['id'];

function getStation(id: string | null | undefined) {
  return STATIONS.find(s => s.id === id) ?? null;
}

/** Parse station field — supports old plain string ("main_kitchen") and new JSON array (["main_kitchen","grill"]) */
function parseStations(station: string | null | undefined): string[] {
  if (!station) return [];
  try {
    const parsed = JSON.parse(station);
    return Array.isArray(parsed) ? parsed : [station];
  } catch {
    return [station];
  }
}

/** Serialize station array back to storage format */
function serializeStations(stations: string[]): string | null {
  if (stations.length === 0) return null;
  return JSON.stringify(stations);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcDiscountedPrice(price: number, discount: number, discountType: 'percent' | 'amount'): number {
  if (!discount) return price;
  return discountType === 'percent'
    ? price - (price * discount / 100)
    : price - discount;
}

function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-300`}>
      {label}
    </span>
  );
}

// ── Station badge pill (shared between both list panels) ──────────────────────

function StationPill({ stations, onClick }: { stations: string[]; onClick: (e: React.MouseEvent) => void }) {
  const defs = stations.map(k => getStation(k)).filter(Boolean);
  return (
    <span
      role="button"
      tabIndex={0}
      onMouseDown={e => e.stopPropagation()}
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
    >
      {defs.length === 0 ? (
        <><span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />Unassigned</>
      ) : (
        <>{defs.map(s => <span key={s!.id} className={`w-2 h-2 rounded-full shrink-0 ${s!.dotClass}`} />)}
        <span>{defs.length === 1 ? defs[0]!.label : `${defs.length} stations`}</span></>
      )}
    </span>
  );
}

// ── Station toggle buttons (shared between both right panels) ─────────────────

function StationSelector({
  stations,
  onToggle,
  onClear,
}: {
  stations: string[];
  onToggle: (id: StationId) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-kds-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400 dark:text-kds-text-muted">
          Station <span className="text-slate-300 dark:text-slate-600">(select all that apply)</span>
        </p>
        {stations.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-red-400 hover:text-red-500 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {STATIONS.map(s => {
          const active = stations.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                active ? s.activeClass : s.inactiveClass
              }`}
            >
              {active && <span className="text-[10px]">✓</span>}
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ActiveTab = 'cocoeats' | 'tmbill_only';

export default function ItemMapping() {
  const dispatch = useAppDispatch();

  // canonical items from DB
  const [canonicals, setCanonicals] = useState<CanonicalItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('cocoeats');

  // CocoEats tab state
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [foodSearch, setFoodSearch] = useState('');

  // TMBILL Only tab state
  const [selectedTmbillItem, setSelectedTmbillItem] = useState<TmbillMenuItem | null>(null);
  const [tmbillOnlySearch, setTmbillOnlySearch] = useState('');

  // TMBILL mapping panel (CocoEats tab)
  const [tmbillSearch, setTmbillSearch] = useState('');
  const [showTmbillSearch, setShowTmbillSearch] = useState(false);
  const [tmbillRefreshing, setTmbillRefreshing] = useState(false);

  // Station popover
  const [stationPopoverId, setStationPopoverId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const foods = useAppSelector(state => state.foods.foods);
  const foodsLoading = useAppSelector(state => state.foods.loading);
  const tmbillMenu = useAppSelector(selectTmbillMenu);
  const isElectron = !!window.electron?.mapping;
  const hasTmbill = !!window.tmbill;

  // Canonical item linked to the selected CocoEats food
  const selectedCanonical = selectedFood
    ? canonicals.find(ci => ci.cocoeats_maps.some(m => m.food_id === String(selectedFood.id))) ?? null
    : null;

  // Canonical item linked to the selected TMBILL-only item (pure TMBILL, no cocoeats map)
  const selectedTmbillCanonical = selectedTmbillItem
    ? canonicals.find(ci =>
        ci.tmbill_maps.some(tm => tm.item_id === selectedTmbillItem.item_id) &&
        ci.cocoeats_maps.length === 0
      ) ?? null
    : null;

  // ── On mount: load canonical DB + CocoEats foods + TMBILL menu ─────────────

  useEffect(() => {
    if (foods.length === 0) dispatch(fetchFoods());
    if (hasTmbill && tmbillMenu.length === 0) window.tmbill.fetchMenu();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCanonicals = useCallback(async () => {
    if (!isElectron) return;
    setLoading(true);
    const res = await window.electron.mapping.getAll();
    if (res.success && res.data) {
      setCanonicals(res.data);
    } else {
      toast.error('Failed to load item mappings');
    }
    setLoading(false);
  }, [isElectron]);

  useEffect(() => { loadCanonicals(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close station popover on outside click
  useEffect(() => {
    if (stationPopoverId === null) return;
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setStationPopoverId(null);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [stationPopoverId]);

  // ── Derived: TMBILL-only items ─────────────────────────────────────────────
  // Items NOT already linked to a CocoEats-mapped canonical
  const tmbillIdsLinkedToCocoeats = new Set(
    canonicals
      .filter(ci => ci.cocoeats_maps.length > 0)
      .flatMap(ci => ci.tmbill_maps.map(m => m.item_id))
  );
  const tmbillOnlyItems = tmbillMenu.filter(m => !tmbillIdsLinkedToCocoeats.has(m.item_id));

  // ── CocoEats food helpers ──────────────────────────────────────────────────

  function getFoodStations(foodId: number): string[] {
    const ci = canonicals.find(c => c.cocoeats_maps.some(m => m.food_id === String(foodId)));
    return parseStations(ci?.station);
  }

  async function saveFoodStations(foodId: number, foodName: string, stations: string[]) {
    let canonicalId = canonicals.find(c => c.cocoeats_maps.some(m => m.food_id === String(foodId)))?.id;
    if (!canonicalId) {
      const addRes = await window.electron.mapping.addCanonical(foodName, null);
      if (!addRes.success || !addRes.id) { toast.error('Failed to initialise item'); return; }
      canonicalId = addRes.id as number;
      await window.electron.mapping.addCocoeatsMap(String(foodId), foodName, canonicalId);
    }
    const res = await window.electron.mapping.setStation(canonicalId, serializeStations(stations));
    if (res.success) await loadCanonicals();
    else toast.error('Failed to update station');
  }

  async function handleToggleFoodStation(foodId: number, foodName: string, stationId: StationId) {
    const current = getFoodStations(foodId);
    const next = current.includes(stationId)
      ? current.filter(s => s !== stationId)
      : [...current, stationId];
    await saveFoodStations(foodId, foodName, next);
  }

  async function handleClearFoodStations(foodId: number, foodName: string) {
    await saveFoodStations(foodId, foodName, []);
  }

  function getTmbillCount(foodId: number) {
    const ci = canonicals.find(c => c.cocoeats_maps.some(m => m.food_id === String(foodId)));
    return ci?.tmbill_maps.length ?? 0;
  }

  function selectFood(food: Food) {
    setSelectedFood(food);
    setShowTmbillSearch(false);
    setTmbillSearch('');
  }

  // ── TMBILL-only item helpers ───────────────────────────────────────────────

  function getTmbillItemStations(itemId: number): string[] {
    const ci = canonicals.find(c =>
      c.tmbill_maps.some(m => m.item_id === itemId) && c.cocoeats_maps.length === 0
    );
    return parseStations(ci?.station);
  }

  async function saveTmbillItemStations(item: TmbillMenuItem, stations: string[]) {
    let canonicalId = canonicals.find(c =>
      c.tmbill_maps.some(m => m.item_id === item.item_id) && c.cocoeats_maps.length === 0
    )?.id;

    if (!canonicalId) {
      // Auto-create canonical from TMBILL item
      const addRes = await window.electron.mapping.addCanonical(item.title, null);
      if (!addRes.success || !addRes.id) {
        toast.error(addRes.error?.includes('UNIQUE') ? 'A canonical item with this name already exists' : (addRes.error ?? 'Failed to initialise'));
        return;
      }
      canonicalId = addRes.id as number;
      await window.electron.mapping.addTmbillMap(item.item_id, item.title, canonicalId);
    }

    const res = await window.electron.mapping.setStation(canonicalId, serializeStations(stations));
    if (res.success) await loadCanonicals();
    else toast.error('Failed to update station');
  }

  async function handleToggleTmbillItemStation(item: TmbillMenuItem, stationId: StationId) {
    const current = getTmbillItemStations(item.item_id);
    const next = current.includes(stationId)
      ? current.filter(s => s !== stationId)
      : [...current, stationId];
    await saveTmbillItemStations(item, next);
  }

  async function handleClearTmbillItemStations(item: TmbillMenuItem) {
    await saveTmbillItemStations(item, []);
  }

  // ── TMBILL mapping (CocoEats tab) ──────────────────────────────────────────

  const filteredTmbillMenu = tmbillMenu.filter(m =>
    m.title.toLowerCase().includes(tmbillSearch.toLowerCase()) &&
    !selectedCanonical?.tmbill_maps.some(tm => tm.item_id === m.item_id)
  );

  async function handleRefreshTmbillMenu() {
    if (!hasTmbill) return;
    setTmbillRefreshing(true);
    try {
      const res = await window.tmbill.fetchMenu();
      if (res.success) toast.success(`TMBILL menu refreshed (${res.count ?? 0} items)`);
      else toast.error('Failed to refresh TMBILL menu');
    } finally {
      setTmbillRefreshing(false);
    }
  }

  async function handleAddTmbillMap(itemId: number, itemName: string) {
    if (!selectedFood) return;

    let canonicalId = selectedCanonical?.id;

    if (!canonicalId) {
      const addRes = await window.electron.mapping.addCanonical(selectedFood.name, null);
      if (!addRes.success || !addRes.id) {
        toast.error(addRes.error?.includes('UNIQUE') ? 'A canonical item with this name already exists' : (addRes.error ?? 'Failed to initialise'));
        return;
      }
      canonicalId = addRes.id as number;
      await window.electron.mapping.addCocoeatsMap(String(selectedFood.id), selectedFood.name, canonicalId);
    }

    const res = await window.electron.mapping.addTmbillMap(itemId, itemName, canonicalId);
    if (res.success) {
      toast.success(`Mapped "${itemName}" → "${selectedFood.name}"`);
      setTmbillSearch('');
      setShowTmbillSearch(false);
      await loadCanonicals();
    } else {
      toast.error(res.error?.includes('UNIQUE') ? 'That TMBILL item is already mapped to another food' : (res.error ?? 'Failed'));
    }
  }

  async function handleRemoveTmbillMap(itemId: number, itemName: string) {
    const res = await window.electron.mapping.removeTmbillMap(itemId);
    if (res.success) {
      toast.success(`Removed "${itemName}"`);
      await loadCanonicals();
    } else {
      toast.error(res.error ?? 'Failed to remove');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isElectron) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 dark:text-kds-text-muted">
        Item mapping requires the desktop app.
      </div>
    );
  }

  const filteredFoods = foods.filter(f =>
    f.name.toLowerCase().includes(foodSearch.toLowerCase())
  );

  const filteredTmbillOnly = tmbillOnlyItems.filter(m =>
    m.title.toLowerCase().includes(tmbillOnlySearch.toLowerCase())
  );

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-slate-200 dark:border-kds-border bg-white dark:bg-kds-bg-secondary overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-slate-200 dark:border-kds-border shrink-0">
          <button
            onClick={() => setActiveTab('cocoeats')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'cocoeats'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 -mb-px bg-blue-50/50 dark:bg-blue-900/10'
                : 'text-slate-500 dark:text-kds-text-muted hover:text-slate-700 dark:hover:text-kds-text-primary'
            }`}
          >
            CocoEats Foods
          </button>
          <button
            onClick={() => setActiveTab('tmbill_only')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === 'tmbill_only'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 -mb-px bg-purple-50/50 dark:bg-purple-900/10'
                : 'text-slate-500 dark:text-kds-text-muted hover:text-slate-700 dark:hover:text-kds-text-primary'
            }`}
          >
            TMBILL Only
            {tmbillOnlyItems.length > 0 && (
              <span className={`ml-1 px-1 rounded text-[10px] font-semibold ${
                activeTab === 'tmbill_only'
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {tmbillOnlyItems.length}
              </span>
            )}
          </button>
        </div>

        {/* ── CocoEats Foods tab ─────────────────────────────────────── */}
        {activeTab === 'cocoeats' && (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-kds-border shrink-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary mb-2">
                Foods {foods.length > 0 && <span className="font-normal text-slate-400">({foods.length})</span>}
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={foodSearch}
                  onChange={e => setFoodSearch(e.target.value)}
                  placeholder="Search foods..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-slate-50 dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {foodsLoading ? (
                <div className="flex items-center justify-center h-24 text-sm text-slate-400 dark:text-kds-text-muted">
                  Loading foods...
                </div>
              ) : filteredFoods.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-sm text-slate-400 dark:text-kds-text-muted gap-2">
                  <Tag className="w-8 h-8 opacity-30" />
                  <span>{foods.length === 0 ? 'No foods loaded' : 'No matches'}</span>
                </div>
              ) : (
                filteredFoods.map(food => {
                  const tbCount     = getTmbillCount(food.id);
                  const stationKeys = getFoodStations(food.id);
                  const popId = `food-${food.id}`;
                  return (
                    <div key={food.id} className="relative border-b border-slate-100 dark:border-kds-border">
                      <button
                        onClick={() => selectFood(food)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between group ${
                          selectedFood?.id === food.id
                            ? 'bg-blue-50 dark:bg-kds-surface border-l-2 border-l-blue-500'
                            : 'hover:bg-slate-50 dark:hover:bg-kds-surface'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-kds-text-primary truncate">{food.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {/* Price */}
                            {(() => {
                              const base = parseFloat(String(food.price));
                              const discounted = calcDiscountedPrice(base, food.discount, food.discount_type);
                              return discounted < base ? (
                                <>
                                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500 line-through">£{base.toFixed(2)}</span>
                                  <span className="font-mono text-xs text-green-600 dark:text-green-400">£{discounted.toFixed(2)}</span>
                                </>
                              ) : (
                                <span className="font-mono text-xs text-green-600 dark:text-green-400">£{base.toFixed(2)}</span>
                              );
                            })()}
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <StationPill
                              stations={stationKeys}
                              onClick={e => { e.stopPropagation(); setStationPopoverId(stationPopoverId === popId ? null : popId); }}
                            />
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-xs text-slate-400 dark:text-kds-text-muted">
                              {tbCount > 0
                                ? <span className="text-purple-600 dark:text-purple-400">{tbCount} TMBILL</span>
                                : 'No TMBILL'}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${
                          selectedFood?.id === food.id ? 'text-blue-500' : 'text-slate-300 dark:text-kds-border group-hover:text-slate-400'
                        }`} />
                      </button>

                      {/* Station popover */}
                      {stationPopoverId === popId && (
                        <div
                          ref={popoverRef}
                          className="absolute left-4 top-full z-50 mt-1 bg-white dark:bg-kds-bg-secondary shadow-lg rounded-xl border border-slate-200 dark:border-kds-border p-1.5 min-w-[170px]"
                        >
                          {stationKeys.length > 0 && (
                            <button
                              onClick={() => { handleClearFoodStations(food.id, food.name); setStationPopoverId(null); }}
                              className="w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 mb-1"
                            >
                              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                              Clear all
                            </button>
                          )}
                          {STATIONS.map(s => {
                            const active = stationKeys.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                onClick={() => handleToggleFoodStation(food.id, food.name, s.id)}
                                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors ${
                                  active ? `${s.badgeClass} font-medium` : 'text-slate-600 dark:text-kds-text-muted hover:bg-slate-50 dark:hover:bg-kds-surface'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
                                {s.label}
                                {active && <span className="ml-auto text-[10px]">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── TMBILL Only tab ────────────────────────────────────────── */}
        {activeTab === 'tmbill_only' && (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-kds-border shrink-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary mb-2">
                TMBILL Items {tmbillOnlyItems.length > 0 && <span className="font-normal text-slate-400">({tmbillOnlyItems.length})</span>}
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={tmbillOnlySearch}
                  onChange={e => setTmbillOnlySearch(e.target.value)}
                  placeholder="Search TMBILL items..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-slate-50 dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {tmbillMenu.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-sm text-slate-400 dark:text-kds-text-muted gap-2 px-4 text-center">
                  <Utensils className="w-8 h-8 opacity-30" />
                  <span>No TMBILL menu loaded — connect to TMBILL POS first</span>
                </div>
              ) : filteredTmbillOnly.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-sm text-slate-400 dark:text-kds-text-muted gap-2">
                  <Utensils className="w-8 h-8 opacity-30" />
                  <span>{tmbillOnlyItems.length === 0 ? 'All TMBILL items are mapped' : 'No matches'}</span>
                </div>
              ) : (
                filteredTmbillOnly.map(item => {
                  const stationKeys = getTmbillItemStations(item.item_id);
                  const popId = `tmbill-${item.item_id}`;
                  return (
                    <div key={item.item_id} className="relative border-b border-slate-100 dark:border-kds-border">
                      <button
                        onClick={() => setSelectedTmbillItem(item)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between group ${
                          selectedTmbillItem?.item_id === item.item_id
                            ? 'bg-purple-50 dark:bg-kds-surface border-l-2 border-l-purple-500'
                            : 'hover:bg-slate-50 dark:hover:bg-kds-surface'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-kds-text-primary truncate">{item.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {item.price != null && (
                              <>
                                <span className="font-mono text-xs text-green-600 dark:text-green-400">£{item.price.toFixed(2)}</span>
                                <span className="text-slate-300 dark:text-slate-600">·</span>
                              </>
                            )}
                            <StationPill
                              stations={stationKeys}
                              onClick={e => { e.stopPropagation(); setStationPopoverId(stationPopoverId === popId ? null : popId); }}
                            />
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${
                          selectedTmbillItem?.item_id === item.item_id ? 'text-purple-500' : 'text-slate-300 dark:text-kds-border group-hover:text-slate-400'
                        }`} />
                      </button>

                      {/* Station popover */}
                      {stationPopoverId === popId && (
                        <div
                          ref={popoverRef}
                          className="absolute left-4 top-full z-50 mt-1 bg-white dark:bg-kds-bg-secondary shadow-lg rounded-xl border border-slate-200 dark:border-kds-border p-1.5 min-w-[170px]"
                        >
                          {stationKeys.length > 0 && (
                            <button
                              onClick={() => { handleClearTmbillItemStations(item); setStationPopoverId(null); }}
                              className="w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 mb-1"
                            >
                              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                              Clear all
                            </button>
                          )}
                          {STATIONS.map(s => {
                            const active = stationKeys.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                onClick={() => handleToggleTmbillItemStation(item, s.id)}
                                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors ${
                                  active ? `${s.badgeClass} font-medium` : 'text-slate-600 dark:text-kds-text-muted hover:bg-slate-50 dark:hover:bg-kds-surface'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${s.dotClass}`} />
                                {s.label}
                                {active && <span className="ml-auto text-[10px]">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── CocoEats tab right panel ────────────────────────────────── */}
        {activeTab === 'cocoeats' && (
          !selectedFood ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-kds-text-muted gap-3">
              <Tag className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a CocoEats food to manage its TMBILL mappings</p>
            </div>
          ) : (
            <div className="max-w-xl space-y-6">

              {/* Food header */}
              <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border px-4 py-3">
                <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-0.5">CocoEats Food</p>
                <div className="flex items-baseline gap-3">
                  <p className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">{selectedFood.name}</p>
                  {(() => {
                    const base = parseFloat(String(selectedFood.price));
                    const discounted = calcDiscountedPrice(base, selectedFood.discount, selectedFood.discount_type);
                    return discounted < base ? (
                      <>
                        <span className="font-mono text-sm text-slate-400 dark:text-slate-500 line-through">£{base.toFixed(2)}</span>
                        <span className="font-mono text-sm font-medium text-green-600 dark:text-green-400">£{discounted.toFixed(2)}</span>
                      </>
                    ) : (
                      <span className="font-mono text-sm font-medium text-green-600 dark:text-green-400">£{base.toFixed(2)}</span>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">food_id: {selectedFood.id}</p>
                <StationSelector
                  stations={parseStations(selectedCanonical?.station)}
                  onToggle={id => handleToggleFoodStation(selectedFood.id, selectedFood.name, id)}
                  onClear={() => handleClearFoodStations(selectedFood.id, selectedFood.name)}
                />
              </div>

              {/* TMBILL items section */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">TMBILL Items</h2>
                    <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">
                      TMBILL menu items that are the same dish as "{selectedFood.name}"
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasTmbill && (
                      <button
                        onClick={handleRefreshTmbillMenu}
                        disabled={tmbillRefreshing}
                        title="Refresh TMBILL menu from POS"
                        className="p-1.5 rounded-lg text-slate-500 dark:text-kds-text-muted hover:bg-slate-100 dark:hover:bg-kds-surface border border-slate-200 dark:border-kds-border transition-colors disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${tmbillRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => setShowTmbillSearch(v => !v)}
                      disabled={!hasTmbill}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>

                {showTmbillSearch && (
                  <div className="mb-3 p-3 bg-purple-50 dark:bg-kds-bg-secondary rounded-xl border border-purple-100 dark:border-kds-border">
                    {tmbillMenu.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-kds-text-muted">
                        No TMBILL menu loaded — connect to TMBILL POS or click the ↻ button above.
                      </p>
                    ) : (
                      <>
                        <input
                          autoFocus
                          value={tmbillSearch}
                          onChange={e => setTmbillSearch(e.target.value)}
                          placeholder="Search TMBILL items..."
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-white dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                        />
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {filteredTmbillMenu.slice(0, 30).map(m => (
                            <button
                              key={m.item_id}
                              onClick={() => handleAddTmbillMap(m.item_id, m.title)}
                              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-purple-100 dark:hover:bg-kds-surface transition-colors flex items-center justify-between"
                            >
                              <span className="font-medium text-slate-900 dark:text-white">{m.title}</span>
                              <span className="flex items-center gap-2 shrink-0">
                                {m.price != null && (
                                  <span className="font-mono text-xs text-green-600 dark:text-green-400">£{m.price.toFixed(2)}</span>
                                )}
                                <span className="text-xs text-slate-400 dark:text-kds-text-muted">#{m.item_id}</span>
                              </span>
                            </button>
                          ))}
                          {filteredTmbillMenu.length === 0 && (
                            <p className="text-xs text-slate-400 dark:text-kds-text-muted px-3">No matches</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border divide-y divide-slate-100 dark:divide-kds-border">
                  {!selectedCanonical || selectedCanonical.tmbill_maps.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400 dark:text-kds-text-muted">
                      No TMBILL items linked yet — click Add to link one
                    </p>
                  ) : (
                    selectedCanonical.tmbill_maps.map(m => (
                      <div key={m.item_id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge label={m.item_name} color="purple" />
                          {(() => {
                            const menuItem = tmbillMenu.find(tm => tm.item_id === m.item_id);
                            return menuItem?.price != null ? (
                              <span className="font-mono text-xs text-green-600 dark:text-green-400">£{menuItem.price.toFixed(2)}</span>
                            ) : null;
                          })()}
                          <span className="text-xs text-slate-400 dark:text-kds-text-muted">#{m.item_id}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveTmbillMap(m.item_id, m.item_name)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

            </div>
          )
        )}

        {/* ── TMBILL Only tab right panel ──────────────────────────────── */}
        {activeTab === 'tmbill_only' && (
          !selectedTmbillItem ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-kds-text-muted gap-3">
              <Utensils className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a TMBILL item to assign its station</p>
              <p className="text-xs text-center max-w-64">
                These items exist only in TMBILL (dine-in menu) and have no CocoEats counterpart.
                Assigning a station lets chef screens display them correctly.
              </p>
            </div>
          ) : (
            <div className="max-w-xl space-y-6">

              {/* TMBILL item header */}
              <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border px-4 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs text-slate-400 dark:text-kds-text-muted">TMBILL Item</p>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-medium">
                    TMBILL Only
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <p className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">{selectedTmbillItem.title}</p>
                  {selectedTmbillItem.price != null && (
                    <span className="font-mono text-sm font-medium text-green-600 dark:text-green-400">
                      £{selectedTmbillItem.price.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">item_id: {selectedTmbillItem.item_id}</p>

                {selectedTmbillCanonical && (
                  <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-1">
                    canonical_id: {selectedTmbillCanonical.id}
                  </p>
                )}

                <StationSelector
                  stations={parseStations(selectedTmbillCanonical?.station)}
                  onToggle={id => handleToggleTmbillItemStation(selectedTmbillItem, id)}
                  onClear={() => handleClearTmbillItemStations(selectedTmbillItem)}
                />
              </div>

              {/* Info note */}
              {!selectedTmbillCanonical && (
                <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    A canonical item will be auto-created when you assign a station. It will be named after this TMBILL item and have no CocoEats link.
                  </p>
                </div>
              )}

            </div>
          )
        )}

      </div>
    </div>
  );
}
