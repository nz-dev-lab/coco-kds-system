import { useState, useEffect } from 'react';
import type { FoodStats, FoodFilters } from '../../types/food.type';

interface FoodsHeaderProps {
  stats: FoodStats;
  filters: FoodFilters;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: 'all' | 'available' | 'unavailable') => void;
  onVegChange: (veg: 'all' | 'veg' | 'non-veg') => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  loading?: boolean;
}

export const FoodsHeader: React.FC<FoodsHeaderProps> = ({
  stats,
  filters,
  onSearchChange,
  onStatusChange,
  onVegChange,
  onClearFilters,
  onRefresh,
  loading = false,
}) => {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, onSearchChange]);

  const hasActiveFilters =
    filters.search ||
    filters.status !== 'all' ||
    filters.veg !== 'all' ||
    filters.category !== null;

  return (
    <div className="space-y-4">
      {/* Top row: Title and Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Food Management</h1>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">Total Items</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
        </div>

        {/* Available */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">Available</div>
          <div className="text-2xl font-bold text-green-600">{stats.available}</div>
        </div>

        {/* Unavailable */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">Unavailable</div>
          <div className="text-2xl font-bold text-slate-500">{stats.unavailable}</div>
        </div>

        {/* Veg */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">Vegetarian</div>
          <div className="text-2xl font-bold text-green-600">{stats.veg}</div>
        </div>

        {/* Non-veg */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">Non-Veg</div>
          <div className="text-2xl font-bold text-red-400">{stats.nonVeg}</div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search food items..."
            className="w-full px-4 py-2.5 pl-10 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) =>
            onStatusChange(e.target.value as 'all' | 'available' | 'unavailable')
          }
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="available">✓ Available</option>
          <option value="unavailable">✗ Unavailable</option>
        </select>

        {/* Veg filter */}
        <select
          value={filters.veg}
          onChange={(e) =>
            onVegChange(e.target.value as 'all' | 'veg' | 'non-veg')
          }
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="veg">🟢 Vegetarian</option>
          <option value="non-veg">🔴 Non-Veg</option>
        </select>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-900 dark:text-white rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Active filters:</span>
          {filters.search && (
            <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded">
              Search: "{filters.search}"
            </span>
          )}
          {filters.status !== 'all' && (
            <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded">
              {filters.status === 'available' ? 'Available' : 'Unavailable'}
            </span>
          )}
          {filters.veg !== 'all' && (
            <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded">
              {filters.veg === 'veg' ? 'Vegetarian' : 'Non-Veg'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
