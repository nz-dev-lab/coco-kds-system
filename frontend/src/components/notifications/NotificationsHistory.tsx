import { format } from 'date-fns';
import type { Notification } from '../../utils/notificationsApi';

interface NotificationsHistoryProps {
  notifications: Notification[];
  loading?: boolean;
}

export const NotificationsHistory: React.FC<NotificationsHistoryProps> = ({
  notifications,
  loading = false,
}) => {
  /**
   * Format date to readable format
   */
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch {
      return 'Unknown date';
    }
  };

  /**
   * Format time to readable format
   */
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'hh:mm a');
    } catch {
      return 'Unknown time';
    }
  };

  /**
   * Get full image URL from filename
   */
  const getImageUrl = (imagePath: string | null): string | null => {
    if (!imagePath) return null;
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Otherwise, construct the full URL
    return `https://rootuser.cocoeats.uk/storage/notification/${imagePath}`;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-lg border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
        <div className="p-4 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Notification History
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Loading notifications...
          </p>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-gray-700">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="p-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (notifications.length === 0) {
    return (
      <div className="rounded-lg border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
        <div className="p-4 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Notification History
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Last 30 notifications sent
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="text-6xl mb-4">📢</div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No notifications yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-center max-w-md text-sm">
            When you send notifications to your customers, they will appear here.
            You can send up to 5 notifications per day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Notification History
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Last 30 notifications sent ({notifications.length} total)
        </p>
      </div>

      {/* Notifications list */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="divide-y divide-slate-200 dark:divide-gray-700">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="p-4 hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  {notification.image ? (
                    <img
                      src={getImageUrl(notification.image) || ''}
                      alt=""
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        // Fallback to icon if image fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `
                          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                          </svg>
                        `;
                      }}
                    />
                  ) : (
                    <svg
                      className="w-5 h-5 text-blue-600 dark:text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {notification.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                    {notification.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {formatDate(notification.created_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {formatTime(notification.created_at)}
                    </div>
                    {notification.firebase_message_id && (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Delivered
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};