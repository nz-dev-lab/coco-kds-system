import { useNotifications } from '../hooks/useNotifications';
import { NotificationForm } from '../components/notifications/NotificationForm';
import { NotificationsStats } from '../components/notifications/NotificationsStats';
import { NotificationsHistory } from '../components/notifications/NotificationsHistory';

export default function Notifications() {
  const {
    notifications,
    stats,
    loading,
    sending,
    canSendMore,
    remainingToday,
    handleSendNotification,
    refreshNotifications,
  } = useNotifications();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-kds-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Customer Notifications
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Send push notifications to customers in your delivery zone
            </p>
          </div>
          <button
            onClick={refreshNotifications}
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

        {/* Statistics dashboard */}
        <NotificationsStats stats={stats} loading={loading} />

        {/* Two-column layout for form and history */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Send notification form */}
          <div>
            <NotificationForm
              onSend={handleSendNotification}
              sending={sending}
              disabled={!canSendMore}
              remainingToday={remainingToday}
            />
          </div>

          {/* Right column: Notification history */}
          <div>
            <NotificationsHistory
              notifications={notifications}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}