import { Activity, Database, Radio, ShieldCheck } from "lucide-react";
import { formatCurrency, formatNumber } from "../lib/format";
import { EmptyState, ErrorState } from "./States";

export function FirstPartyLayer({ error, summary }) {
  const hasEvents = Number(summary?.totalEvents || 0) > 0;
  const metrics = [
    ["Events", formatNumber(summary?.totalEvents), Activity],
    ["Sessions", formatNumber(summary?.totalSessions), Radio],
    ["Active 30m", formatNumber(summary?.activeSessions30m), ShieldCheck],
    ["Revenue", formatCurrency(summary?.revenue), Database]
  ];

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-brand">Owned analytics layer</p>
          <h2 className="mt-1 text-lg font-black text-ink dark:text-white">First-party event collector</h2>
          <p className="mt-1 text-sm font-semibold text-muted dark:text-slate-400">
            Data flows from `ffDataLayer` to `/api/first-party/events`, then updates this panel from our own store.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-black text-muted dark:border-slate-800 dark:text-slate-400">
          {hasEvents ? "Live first-party data" : "Waiting for first-party events"}
        </span>
      </div>

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        {metrics.map(([title, value, Icon]) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase text-muted dark:text-slate-400">{title}</p>
              <Icon size={16} className="text-brand" />
            </div>
            <p className="mt-3 text-2xl font-black text-ink dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Breakdown title="Top Events" rows={summary?.eventBreakdown} />
        <Breakdown title="Journey Stages" rows={summary?.stageBreakdown} />
      </div>

      <div className="mt-5">
        <p className="mb-3 text-xs font-black uppercase text-muted dark:text-slate-400">Recent first-party events</p>
        {!hasEvents ? (
          <EmptyState title="No first-party events yet" copy="Install the SDK snippet or post to /api/first-party/events to start the live feed." />
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {(summary?.recentEvents || []).slice(0, 8).map((event) => (
              <div key={event.event_id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-black text-ink dark:text-white">{event.event_name}</p>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-black text-brand dark:bg-teal-950">{event.status}</span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-muted dark:text-slate-400">
                  {event.screen_name} · {event.journey_stage} · {new Date(event.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Breakdown({ title, rows = [] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="mb-3 text-xs font-black uppercase text-muted dark:text-slate-400">{title}</p>
      {!rows.length ? (
        <p className="text-sm font-semibold text-muted dark:text-slate-400">Waiting for data</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 5).map((row) => (
            <div key={row.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-bold text-ink dark:text-white">{row.name}</span>
                <span className="font-black text-brand">{formatNumber(row.count)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${total ? Math.max(6, (row.count / total) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
