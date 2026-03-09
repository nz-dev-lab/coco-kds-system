// src/pages/utilities/ItemMapping.tsx
// For each CocoEats food, map which TMBILL menu items correspond to it.
// Canonical items are auto-created/managed internally — not exposed in UI.

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Plus, X, ChevronRight, Tag, RefreshCw, Search } from 'lucide-react';
import type { CanonicalItem } from '../../types/electron.d';
import type { Food } from '../../types/food.type';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchFoods } from '../../store/slices/foodsSlice';
import { selectTmbillMenu } from '../../store/slices/tmbillOrdersSlice';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-300`}>
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemMapping() {
  const dispatch = useAppDispatch();

  // canonical items from DB — used only to look up existing TMBILL maps
  const [canonicals, setCanonicals] = useState<CanonicalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [foodSearch, setFoodSearch] = useState('');

  // TMBILL mapping panel
  const [tmbillSearch, setTmbillSearch] = useState('');
  const [showTmbillSearch, setShowTmbillSearch] = useState(false);
  const [tmbillRefreshing, setTmbillRefreshing] = useState(false);

  const foods = useAppSelector(state => state.foods.foods);
  const foodsLoading = useAppSelector(state => state.foods.loading);
  const tmbillMenu = useAppSelector(selectTmbillMenu);
  const isElectron = !!window.electron?.mapping;
  const hasTmbill = !!window.tmbill;

  // Canonical item linked to the selected CocoEats food (may be null if never mapped yet)
  const selectedCanonical = selectedFood
    ? canonicals.find(ci => ci.cocoeats_maps.some(m => m.food_id === String(selectedFood.id))) ?? null
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
      // Re-sync selected food's canonical from fresh data
      if (selectedFood) {
        // no extra state needed — selectedCanonical is derived
      }
    } else {
      toast.error('Failed to load item mappings');
    }
    setLoading(false);
  }, [isElectron, selectedFood]);

  useEffect(() => { loadCanonicals(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getTmbillCount(foodId: number) {
    const ci = canonicals.find(c => c.cocoeats_maps.some(m => m.food_id === String(foodId)));
    return ci?.tmbill_maps.length ?? 0;
  }

  function selectFood(food: Food) {
    setSelectedFood(food);
    setShowTmbillSearch(false);
    setTmbillSearch('');
  }

  // ── TMBILL mapping ─────────────────────────────────────────────────────────

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

    // Auto-create canonical + CE link on first TMBILL mapping for this food
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

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel: CocoEats food list ──────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-slate-200 dark:border-kds-border bg-white dark:bg-kds-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-kds-border">
          <p className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary mb-2">
            CocoEats Foods {foods.length > 0 && <span className="font-normal text-slate-400">({foods.length})</span>}
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
              const tbCount = getTmbillCount(food.id);
              return (
                <button
                  key={food.id}
                  onClick={() => selectFood(food)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-kds-border transition-colors flex items-center justify-between group ${
                    selectedFood?.id === food.id
                      ? 'bg-blue-50 dark:bg-kds-surface border-l-2 border-l-blue-500'
                      : 'hover:bg-slate-50 dark:hover:bg-kds-surface'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-kds-text-primary truncate">{food.name}</p>
                    <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">
                      {tbCount > 0
                        ? <span className="text-purple-600 dark:text-purple-400">{tbCount} TMBILL linked</span>
                        : 'No TMBILL links yet'}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${
                    selectedFood?.id === food.id ? 'text-blue-500' : 'text-slate-300 dark:text-kds-border group-hover:text-slate-400'
                  }`} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: TMBILL mappings for selected food ───────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedFood ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-kds-text-muted gap-3">
            <Tag className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a CocoEats food to manage its TMBILL mappings</p>
          </div>
        ) : (
          <div className="max-w-xl space-y-6">

            {/* ── Food header ── */}
            <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border px-4 py-3">
              <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-0.5">CocoEats Food</p>
              <p className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">{selectedFood.name}</p>
              <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">food_id: {selectedFood.id}</p>
            </div>

            {/* ── TMBILL items ── */}
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
                            <span className="text-xs text-slate-500 dark:text-kds-text-muted">#{m.item_id}</span>
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
                      <div className="flex items-center gap-2">
                        <Badge label={m.item_name} color="purple" />
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
        )}
      </div>
    </div>
  );
}
