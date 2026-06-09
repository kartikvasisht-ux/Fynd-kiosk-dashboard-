import { CalendarDays, Copy, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { last28Days, toInputDate } from "../lib/format";

const primaryControl =
  "h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950";
const labelClass = "mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-500";
const chipInput =
  "h-9 min-w-0 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-ink shadow-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white";

export function GlobalFilters({ filters, onChange, onReset, onApply }) {
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const update = (key, value) => onChange({ ...filters, [key]: value });
  const dateRange = useMemo(() => dateRangeValue(filters), [filters.startDate, filters.endDate]);
  const shareUrl = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  }, [filters]);

  const setDateRange = (value) => {
    if (value === "custom") return;
    onChange({ ...filters, ...rangeFor(value) });
  };

  const copyShareUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_6px_18px_rgba(16,24,40,0.05)] dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-[1.05fr_1fr_1fr_1fr_1fr_auto] 2xl:items-end">
        <label>
          <span className={labelClass}>Date Range</span>
          <span className="relative block">
            <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className={`${primaryControl} w-full pl-9`}>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="qtd">Quarter to date</option>
              <option value="custom">Custom range</option>
            </select>
          </span>
        </label>
        <FilterInput label="Brand" value={filters.brand} placeholder="All brands" onChange={(value) => update("brand", value)} />
        <FilterInput label="Store" value={filters.store} placeholder="All stores" onChange={(value) => update("store", value)} />
        <FilterInput label="City" value={filters.city} placeholder="All cities" onChange={(value) => update("city", value)} />
        <FilterInput label="Region" value={filters.region} placeholder="All regions" onChange={(value) => update("region", value)} />

        <div className="grid grid-cols-2 gap-2 2xl:min-w-[300px]">
          <button
            type="button"
            onClick={onApply}
            className="h-9 rounded-xl bg-slate-950 px-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-ink shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          >
            <RotateCcw size={15} />
            Clear
          </button>
        </div>
      </div>

      {dateRange === "custom" ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:max-w-[520px]">
          <DateInput label="Start date" value={filters.startDate} onChange={(value) => update("startDate", value)} />
          <DateInput label="End date" value={filters.endDate} onChange={(value) => update("endDate", value)} />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SummaryChip text={`Date Range: ${dateLabel(dateRange)}`} />
        <SummaryChip text={scopeSummary(filters)} />
        <button
          type="button"
          onClick={() => setShowMore((value) => !value)}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-ink shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        >
          <SlidersHorizontal size={14} />
          {showMore ? "Hide ID filters" : "More filters"}
        </button>
        <button
          type="button"
          onClick={copyShareUrl}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-ink shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        >
          <Copy size={14} />
          {copied ? "Copied" : "Share view"}
        </button>
      </div>

      {showMore ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            <IdentifierInput label="Company ID" value={filters.company_id} placeholder="Company" onChange={(value) => update("company_id", value)} />
            <IdentifierInput label="Kiosk ID" value={filters.kiosk_id} placeholder="Kiosk" onChange={(value) => update("kiosk_id", value)} />
            <IdentifierInput label="Session ID" value={filters.session_id} placeholder="Session" onChange={(value) => update("session_id", value)} />
            <IdentifierInput label="Order ID" value={filters.order_id} placeholder="Order hash" onChange={(value) => update("order_id", value)} />
            <IdentifierInput label="Cart ID" value={filters.cart_id} placeholder="Cart hash" onChange={(value) => update("cart_id", value)} />
            <IdentifierInput label="User ID" value={filters.user_id} placeholder="User hash" onChange={(value) => update("user_id", value)} />
            <IdentifierInput label="App ID" value={filters.application_id} placeholder="App" onChange={(value) => update("application_id", value)} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilterInput({ label, value, placeholder, onChange }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${primaryControl} w-full`} />
    </label>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input type="date" value={value || ""} onChange={(event) => onChange(event.target.value)} className={`${primaryControl} w-full`} />
    </label>
  );
}

function IdentifierInput({ label, value, placeholder, onChange }) {
  return (
    <label className="grid gap-1">
      <span className="px-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <input value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={chipInput} />
    </label>
  );
}

function SummaryChip({ text, tone = "neutral" }) {
  const classes = tone === "blue" ? "bg-blue-50 text-brand ring-blue-100 dark:bg-blue-950 dark:ring-blue-900" : "bg-white text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800";
  return <span className={`inline-flex rounded-full px-3 py-2 text-xs font-black ring-1 ${classes}`}>{text}</span>;
}

function dateRangeValue(filters) {
  const ranges = {
    last7: rangeFor("last7"),
    last30: rangeFor("last30"),
    qtd: rangeFor("qtd")
  };
  const match = Object.entries(ranges).find(([, range]) => range.startDate === filters.startDate && range.endDate === filters.endDate);
  return match?.[0] || "custom";
}

function rangeFor(value) {
  const end = new Date();
  const start = new Date();
  if (value === "last7") start.setDate(end.getDate() - 6);
  if (value === "last30") start.setDate(end.getDate() - 29);
  if (value === "qtd") {
    const quarterStartMonth = Math.floor(end.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
  }
  if (!value) return last28Days();
  return { startDate: toInputDate(start), endDate: toInputDate(end) };
}

function dateLabel(value) {
  if (value === "last7") return "Last 7 days";
  if (value === "last30") return "Last 30 days";
  if (value === "qtd") return "Quarter to date";
  return "Custom range";
}

function scopeSummary(filters) {
  const active = ["brand", "store", "city", "region"].filter((key) => filters[key]);
  if (!active.length) return "All brands, stores, cities, and regions";
  return `${active.length} scoped filter${active.length === 1 ? "" : "s"}`;
}
