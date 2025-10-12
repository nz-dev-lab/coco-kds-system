// components/PlaceholderContent.tsx
export default function PlaceholderContent() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-kds-surface flex items-center justify-center">
          <svg
            className="w-12 h-12 text-slate-500 dark:text-kds-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-kds-text-primary mb-2">
          Content Area
        </h2>
        <p className="text-slate-700 dark:text-kds-text-secondary mb-6">
          This is a placeholder for the main content. Dashboard, orders, and other features will be displayed here.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-kds-surface rounded-lg">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-sm text-slate-500 dark:text-kds-text-muted">Ready for development</span>
        </div>
      </div>
    </div>
  );
}