export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-5 h-8 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-3 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-6 h-64 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export function EmptyState({ title = "No data", copy = "No first-party events have arrived for this view yet." }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950">
      <div>
        <p className="text-sm font-extrabold text-ink dark:text-white">{title}</p>
        <p className="mt-2 max-w-sm text-sm font-semibold text-muted dark:text-slate-400">{copy}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {message}
    </div>
  );
}
