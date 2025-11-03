import { useState } from 'react';

interface FoodToggleProps {
  foodId: number;
  foodName: string;
  status: 0 | 1;
  onToggle: (foodId: number, currentStatus: 0 | 1) => Promise<void>;
  disabled?: boolean;
}

export const FoodToggle: React.FC<FoodToggleProps> = ({
  foodId,
  foodName,
  status,
  onToggle,
  disabled = false,
}) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (disabled || isToggling) return;

    setIsToggling(true);
    try {
      await onToggle(foodId, status);
    } finally {
      setIsToggling(false);
    }
  };

  const isAvailable = status === 1;

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || isToggling}
      className={`
        relative inline-flex h-8 w-14 items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${isAvailable 
          ? 'bg-green-500 focus:ring-green-500' 
          : 'bg-gray-600 focus:ring-gray-500'
        }
        ${disabled || isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        hover:opacity-90
      `}
      aria-label={`Toggle ${foodName} availability`}
      aria-checked={isAvailable}
      role="switch"
    >
      {/* Toggle circle */}
      <span
        className={`
          inline-block h-6 w-6 transform rounded-full
          bg-white shadow-lg transition-transform duration-200 ease-in-out
          ${isAvailable ? 'translate-x-7' : 'translate-x-1'}
        `}
      >
        {/* Loading spinner */}
        {isToggling && (
          <svg
            className="h-6 w-6 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </span>

      {/* Status text */}
      <span className="sr-only">
        {isAvailable ? 'Available' : 'Unavailable'}
      </span>
    </button>
  );
};