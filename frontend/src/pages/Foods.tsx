import { useFoods } from '../hooks/useFoods';
import { FoodsHeader } from '../components/foods/FoodsHeader';
import { FoodsList } from '../components/foods/FoodsList';

export default function Foods() {
  const {
    filteredFoods,
    loading,
    filters,
    stats,
    toggleFoodStatus,
    refreshFoods,
    handleSearchChange,
    handleStatusChange,
    handleVegChange,
    handleClearFilters,
  } = useFoods();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-kds-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with stats and filters */}
        <FoodsHeader
          stats={stats}
          filters={filters}
          onSearchChange={handleSearchChange}
          onStatusChange={handleStatusChange}
          onVegChange={handleVegChange}
          onClearFilters={handleClearFilters}
          onRefresh={refreshFoods}
          loading={loading}
        />

        {/* Foods list */}
        <FoodsList
          foods={filteredFoods}
          onToggle={toggleFoodStatus}
          loading={loading}
        />
      </div>
    </div>
  );
}