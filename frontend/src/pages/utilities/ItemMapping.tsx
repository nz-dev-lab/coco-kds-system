// src/pages/utilities/ItemMapping.tsx
// Manage canonical item names and map CocoEats / TMBILL items to them.

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, X, Save, ChevronRight, Tag } from 'lucide-react';
import type { CanonicalItem } from '../../types/electron.d';
import { useAppSelector } from '../../store/hooks';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditState {
  name: string;
  category: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Mains', 'Starters', 'Sides', 'Drinks', 'Desserts', 'Snacks', 'Other',
];

function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${color}-100 text-${color}-700 dark:bg-${color}-900/30 dark:text-${color}-300`}>
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemMapping() {
  const [items, setItems] = useState<CanonicalItem[]>([]);
  const [selected, setSelected] = useState<CanonicalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditState>({ name: '', category: '' });
  const [saving, setSaving] = useState(false);

  // For adding a new canonical item
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  // For CocoEats mapping
  const [ceSearch, setCeSearch] = useState('');
  const [showCeSearch, setShowCeSearch] = useState(false);

  // For TMBILL mapping
  const [tmbillAlias, setTmbillAlias] = useState('');

  const foods = useAppSelector(state => state.foods.foods);
  const isElectron = !!window.electron?.mapping;

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!isElectron) return;
    setLoading(true);
    const res = await window.electron.mapping.getAll();
    if (res.success && res.data) {
      setItems(res.data);
      // Re-sync selected item from fresh data
      if (selected) {
        const fresh = res.data.find(i => i.id === selected.id) ?? null;
        setSelected(fresh);
      }
    } else {
      toast.error('Failed to load item mappings');
    }
    setLoading(false);
  }, [isElectron, selected?.id]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canonical item CRUD ───────────────────────────────────────────────────

  async function handleAddCanonical() {
    if (!newName.trim()) return;
    const res = await window.electron.mapping.addCanonical(newName.trim(), newCategory || null);
    if (res.success) {
      toast.success(`"${newName.trim()}" added`);
      setNewName('');
      setNewCategory('');
      setShowNewForm(false);
      await load();
    } else {
      toast.error(res.error?.includes('UNIQUE') ? 'That name already exists' : (res.error ?? 'Failed to add'));
    }
  }

  async function handleSaveEdit() {
    if (!selected || !edit.name.trim()) return;
    setSaving(true);
    const res = await window.electron.mapping.updateCanonical(selected.id, edit.name.trim(), edit.category || null);
    if (res.success) {
      toast.success('Saved');
      await load();
    } else {
      toast.error(res.error ?? 'Failed to save');
    }
    setSaving(false);
  }

  async function handleDelete(item: CanonicalItem) {
    if (!window.confirm(`Delete "${item.name}"? All its CocoEats and TMBILL mappings will also be removed.`)) return;
    const res = await window.electron.mapping.deleteCanonical(item.id);
    if (res.success) {
      toast.success(`"${item.name}" deleted`);
      if (selected?.id === item.id) setSelected(null);
      await load();
    } else {
      toast.error(res.error ?? 'Failed to delete');
    }
  }

  function selectItem(item: CanonicalItem) {
    setSelected(item);
    setEdit({ name: item.name, category: item.category ?? '' });
    setShowCeSearch(false);
    setCeSearch('');
    setTmbillAlias('');
  }

  // ── CocoEats mappings ─────────────────────────────────────────────────────

  const filteredFoods = foods.filter(f =>
    f.name.toLowerCase().includes(ceSearch.toLowerCase()) &&
    !selected?.cocoeats_maps.some(m => m.food_id === String(f.id))
  );

  async function handleAddCeMap(foodId: number, foodName: string) {
    if (!selected) return;
    const res = await window.electron.mapping.addCocoeatsMap(String(foodId), foodName, selected.id);
    if (res.success) {
      toast.success(`Mapped "${foodName}"`);
      setCeSearch('');
      setShowCeSearch(false);
      await load();
    } else {
      toast.error(res.error ?? 'Failed to map');
    }
  }

  async function handleRemoveCeMap(foodId: string, foodName: string) {
    const res = await window.electron.mapping.removeCocoeatsMap(foodId);
    if (res.success) {
      toast.success(`Removed "${foodName}"`);
      await load();
    } else {
      toast.error(res.error ?? 'Failed to remove');
    }
  }

  // ── TMBILL mappings ───────────────────────────────────────────────────────

  async function handleAddTmbillMap() {
    if (!selected || !tmbillAlias.trim()) return;
    const res = await window.electron.mapping.addTmbillMap(tmbillAlias.trim(), selected.id);
    if (res.success) {
      toast.success(`Alias "${tmbillAlias.trim()}" added`);
      setTmbillAlias('');
      await load();
    } else {
      toast.error(res.error?.includes('UNIQUE') ? 'That alias is already mapped to another item' : (res.error ?? 'Failed'));
    }
  }

  async function handleRemoveTmbillMap(itemName: string) {
    const res = await window.electron.mapping.removeTmbillMap(itemName);
    if (res.success) {
      toast.success(`Alias "${itemName}" removed`);
      await load();
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: canonical item list ─────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-slate-200 dark:border-kds-border bg-white dark:bg-kds-bg-secondary overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-kds-border">
          <span className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary">
            Canonical Items ({items.length})
          </span>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        {/* New item form */}
        {showNewForm && (
          <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 space-y-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCanonical()}
              placeholder="Canonical name (e.g. Chicken Burger)"
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-white dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-white dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddCanonical}
                disabled={!newName.trim()}
                className="flex-1 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewName(''); setNewCategory(''); }}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-kds-border text-slate-600 dark:text-kds-text-muted hover:bg-slate-100 dark:hover:bg-kds-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-sm text-slate-400 dark:text-kds-text-muted">
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-sm text-slate-400 dark:text-kds-text-muted gap-2">
              <Tag className="w-8 h-8 opacity-30" />
              <span>No items yet</span>
            </div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-kds-border transition-colors flex items-center justify-between group ${
                  selected?.id === item.id
                    ? 'bg-blue-50 dark:bg-kds-surface border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-50 dark:hover:bg-kds-surface'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-kds-text-primary truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">
                    {item.category ?? 'No category'} ·{' '}
                    {item.cocoeats_maps.length} CE · {item.tmbill_maps.length} TB
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${
                  selected?.id === item.id ? 'text-blue-500' : 'text-slate-300 dark:text-kds-border group-hover:text-slate-400'
                }`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: detail / edit ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-kds-text-muted gap-3">
            <Tag className="w-12 h-12 opacity-20" />
            <p className="text-sm">Select a canonical item to view and edit its mappings</p>
          </div>
        ) : (
          <div className="max-w-xl space-y-6">

            {/* ── Edit name / category ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">Canonical Item</h2>
                <button
                  onClick={() => handleDelete(selected)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
              <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-kds-text-muted mb-1">
                    Canonical name <span className="text-slate-400">(used in analytics & routing)</span>
                  </label>
                  <input
                    value={edit.name}
                    onChange={e => setEdit(v => ({ ...v, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-slate-50 dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-kds-text-muted mb-1">Category</label>
                  <select
                    value={edit.category}
                    onChange={e => setEdit(v => ({ ...v, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-slate-50 dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !edit.name.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </section>

            {/* ── CocoEats mappings ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">CocoEats Items</h2>
                  <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">
                    These food items from CocoEats map to "{selected.name}"
                  </p>
                </div>
                <button
                  onClick={() => setShowCeSearch(v => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {showCeSearch && (
                <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                  {foods.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-kds-text-muted">
                      No CocoEats foods loaded — visit the Foods page first to populate the list.
                    </p>
                  ) : (
                    <>
                      <input
                        autoFocus
                        value={ceSearch}
                        onChange={e => setCeSearch(e.target.value)}
                        placeholder="Search foods..."
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-white dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500 mb-2"
                      />
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filteredFoods.slice(0, 20).map(f => (
                          <button
                            key={f.id}
                            onClick={() => handleAddCeMap(f.id, f.name)}
                            className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/20 text-slate-800 dark:text-kds-text-primary transition-colors flex items-center justify-between"
                          >
                            <span>{f.name}</span>
                            <span className="text-xs text-slate-400">#{f.id}</span>
                          </button>
                        ))}
                        {filteredFoods.length === 0 && (
                          <p className="text-xs text-slate-400 dark:text-kds-text-muted px-3">No matches</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border divide-y divide-slate-100 dark:divide-kds-border">
                {selected.cocoeats_maps.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400 dark:text-kds-text-muted">No CocoEats items mapped yet</p>
                ) : (
                  selected.cocoeats_maps.map(m => (
                    <div key={m.food_id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <span className="text-sm text-slate-800 dark:text-kds-text-primary">{m.food_name}</span>
                        <span className="ml-2 text-xs text-slate-400 dark:text-kds-text-muted">food_id: {m.food_id}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveCeMap(m.food_id, m.food_name)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ── TMBILL aliases ── */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">TMBILL Aliases</h2>
                <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">
                  Exact item names as they appear in TMBILL orders — case sensitive
                </p>
              </div>

              <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border overflow-hidden mb-3">
                {selected.tmbill_maps.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400 dark:text-kds-text-muted">No TMBILL aliases mapped yet</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-kds-border">
                    {selected.tmbill_maps.map(m => (
                      <div key={m.item_name} className="flex items-center justify-between px-4 py-2.5">
                        <Badge label={m.item_name} color="purple" />
                        <button
                          onClick={() => handleRemoveTmbillMap(m.item_name)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={tmbillAlias}
                  onChange={e => setTmbillAlias(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTmbillMap()}
                  placeholder='Exact TMBILL item name (e.g. "Chkn Brg")'
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-kds-border bg-white dark:bg-kds-surface text-slate-800 dark:text-kds-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleAddTmbillMap}
                  disabled={!tmbillAlias.trim()}
                  className="flex items-center gap-1 px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
