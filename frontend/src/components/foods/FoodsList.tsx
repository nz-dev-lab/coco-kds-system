import { FoodCard } from './FoodCard';
import type { Food } from '../../types/food.type';

interface FoodsListProps {
  foods: Food[];
  onToggle: (foodId: number, currentStatus: 0 | 1) => Promise<void>;
  loading?: boolean;
}

export const FoodsList: React.FC<FoodsListProps> = ({
  foods,
  onToggle,
  loading = false,
}) => {
  // Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-40 rounded-lg animate-pulse bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700"
          />
        ))}
      </div>
    );
  }

  // Empty state
  if (foods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-6xl mb-4">🍽️</div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          No foods found
        </h3>
        <p className="text-slate-500 dark:text-slate-300 text-center max-w-md">
          No food items match your current filters. Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  // Foods grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {foods.map((food) => (
        <FoodCard key={food.id} food={food} onToggle={onToggle} />
      ))}
    </div>
  );
};