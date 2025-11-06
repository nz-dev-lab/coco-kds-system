import type { NotificationStats } from '../../utils/notificationsApi';

interface NotificationsStatsProps {
  stats: NotificationStats | null;
  loading?: boolean;
}

export const NotificationsStats: React.FC<NotificationsStatsProps> = ({
  stats,
  loading = false,
}) => {
  // Loading skeleton
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-lg animate-pulse bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700"
          />
        ))}
      </div>
    );
  }

  const {
    sentToday,
    sentThisWeek,
    sentThisMonth,
    dailyLimit,
    remainingToday,
    canSendMore,
  } = stats;

  // Calculate percentage for today
  const todayPercentage = (sentToday / dailyLimit) * 100;

  return (
    <div className="space-y-3">
      {/* Main stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Today's Usage */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">
            Today
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                canSendMore
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {sentToday}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              / {dailyLimit}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                todayPercentage >= 100
                  ? 'bg-red-500'
                  : todayPercentage >= 80
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(todayPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Remaining Today */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">
            Remaining
          </div>
          <div
            className={`text-2xl font-bold ${
              remainingToday > 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {remainingToday}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canSendMore ? 'Available now' : 'Try tomorrow'}
          </div>
        </div>

        {/* This Week */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">
            This Week
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {sentThisWeek}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Last 7 days
          </div>
        </div>

        {/* This Month */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">
            This Month
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {sentThisMonth}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Last 30 days
          </div>
        </div>

        {/* Status Indicator */}
        <div className="rounded-lg p-4 border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
          <div className="text-slate-500 dark:text-slate-300 text-sm mb-1">
            Status
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div
              className={`w-3 h-3 rounded-full ${
                canSendMore ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span
              className={`text-sm font-medium ${
                canSendMore
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {canSendMore ? 'Ready' : 'Limit Reached'}
            </span>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Rate Limit Information
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              You can send up to <strong>{dailyLimit} notifications per day</strong>.
              Notifications are sent to all customers in your restaurant's delivery zone.
              The limit resets at midnight.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};