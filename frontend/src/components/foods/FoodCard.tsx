import { FoodToggle } from './FoodToggle';
import type { Food } from '../../types/food.type';

interface FoodCardProps {
  food: Food;
  onToggle: (foodId: number, currentStatus: 0 | 1) => Promise<void>;
}

export const FoodCard: React.FC<FoodCardProps> = ({ food, onToggle }) => {
  const isAvailable = food.status === 1;
  const isVeg = food.veg === 1;
  const isRecommended = food.recommended === 1;

  // Format price
  const formattedPrice = `£${parseFloat(food.price.toString()).toFixed(2)}`;

  // Calculate discounted price if applicable
  const hasDiscount = food.discount > 0;
  let discountedPrice = food.price;
  if (hasDiscount) {
    if (food.discount_type === 'percent') {
      discountedPrice = food.price - (food.price * food.discount) / 100;
    } else {
      discountedPrice = food.price - food.discount;
    }
  }

  return (
    <div
      className={`
        relative rounded-lg border p-4 transition-all duration-200 hover:shadow-lg
        bg-white dark:bg-gray-800
        ${isAvailable ? 'border-slate-200 dark:border-gray-700' : 'border-slate-200 dark:border-gray-700 opacity-80'}
      `}
    >
      {/* Status indicator bar */}
      <div
        className={`
          absolute left-0 top-0 h-full w-1 rounded-l-lg
          ${isAvailable ? 'bg-green-500' : 'bg-gray-400'}
        `}
      />

      <div className="flex items-start justify-between gap-4">
        {/* Left side: Food info */}
        <div className="flex-1 min-w-0">
          {/* Name and badges */}
          <div className="flex items-center gap-2 mb-2">
            <h3
              className={`
                text-lg font-semibold truncate
                ${isAvailable ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-300'}
              `}
            >
              {food.name}
            </h3>

            {/* Veg/Non-veg indicator */}
            <span
              className={`
                inline-flex items-center justify-center
                w-5 h-5 rounded-sm border-2 flex-shrink-0
                ${isVeg 
                  ? 'border-green-500 bg-green-500/20' 
                  : 'border-red-500 bg-red-500/20'
                }
              `}
              title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
            >
              <span
                className={`
                  w-2 h-2 rounded-full
                  ${isVeg ? 'bg-green-500' : 'bg-red-500'}
                `}
              />
            </span>

            {/* Recommended badge */}
            {isRecommended && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                ⭐
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            {hasDiscount ? (
              <>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  £{discountedPrice.toFixed(2)}
                </span>
                <span className="text-sm text-slate-400 dark:text-slate-500 line-through">
                  {formattedPrice}
                </span>
                <span className="text-xs font-medium text-green-600 bg-green-100/10 px-2 py-0.5 rounded">
                  {food.discount_type === 'percent'
                    ? `${food.discount}% OFF`
                    : `£${food.discount} OFF`}
                </span>
              </>
            ) : (
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {formattedPrice}
              </span>
            )}
          </div>

          {/* Available times */}
          {food.available_time_starts && food.available_time_ends && (
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
              🕐 Available: {food.available_time_starts} - {food.available_time_ends}
            </p>
          )}
        </div>

        {/* Right side: Toggle + Status */}
        <div className="flex flex-col items-end gap-2">
          <FoodToggle
            foodId={food.id}
            foodName={food.name}
            status={food.status}
            onToggle={onToggle}
          />

          {/* Status text */}
          <span
            className={`
              text-xs font-medium px-2 py-1 rounded
              ${isAvailable 
                ? 'text-green-600 bg-green-100/10' 
                : 'text-slate-500 bg-slate-100/5 dark:bg-gray-700/30'
              }
            `}
          >
            {isAvailable ? '✓ Available' : '✗ Unavailable'}
          </span>
        </div>
      </div>

      {/* Image (optional) */}
    </div>
  );
};