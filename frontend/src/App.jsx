import { CheckCircle2, Moon, RefreshCw, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardSections, dashboardTabs } from "./components/DashboardSections";
import { GlobalFilters } from "./components/GlobalFilters";
import { ErrorState } from "./components/States";
import { api } from "./lib/api";
import { toInputDate } from "./lib/format";

const property = {
  name: "Fashion Factory",
  streamId: "14914518095",
  streamUrl: "https://fashionfactory.jiocommerce.io",
  sourceUrl: "https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790",
  collectorPath: "/api/first-party/events",
  sdkPath: "/sdk/ff-analytics-layer.js",
  bridgePath: "/sdk/fashionfactory-source-bridge.js",
  currency: "INR"
};

function defaultFilters() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
    kiosk_id: "",
    source_url: "",
    store: "",
    brand: "",
    city: "",
    region: "",
    company_id: "",
    session_id: "",
    order_id: "",
    cart_id: "",
    user_id: "",
    application_id: ""
  };
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [firstPartyError, setFirstPartyError] = useState("");
  const [firstPartySummary, setFirstPartySummary] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState(defaultFilters);

  const loadFirstParty = useCallback(async () => {
    setFirstPartyError("");
    try {
      setFirstPartySummary(await api.firstPartySummary(filters));
    } catch (loadError) {
      setFirstPartyError(loadError.message);
      setFirstPartySummary(null);
    }
  }, [filters]);

  useEffect(() => {
    loadFirstParty();
    if (typeof EventSource !== "function") {
      const timer = window.setInterval(loadFirstParty, 5000);
      return () => window.clearInterval(timer);
    }
    const stream = new EventSource(api.firstPartyStreamUrl(filters));
    stream.addEventListener("connected", (message) => {
      const payload = JSON.parse(message.data || "{}");
      if (payload.summary) setFirstPartySummary(payload.summary);
      setFirstPartyError("");
    });
    stream.addEventListener("first-party-event", (message) => {
      const payload = JSON.parse(message.data || "{}");
      if (payload.summary) setFirstPartySummary(payload.summary);
      setFirstPartyError("");
    });
    stream.onerror = () => {
      setFirstPartyError("First-party stream unavailable; polling summary");
      loadFirstParty();
    };
    return () => stream.close();
  }, [loadFirstParty]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const installSnippet = `<script
  src="https://your-api.example.com/sdk/fashionfactory-source-bridge.js"
  data-collector-url="https://your-api.example.com/api/first-party/events"
  data-source-url="https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790"
  data-company-id="59"
  data-application-id=""
  data-store-id=""
  data-kiosk-id=""
  data-ds="2790"
  data-stream-id="14914518095"
  data-stream-url="https://fashionfactory.jiocommerce.io">
</script>`;

  const copySnippet = async () => {
    await navigator.clipboard.writeText(installSnippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const activeTabMeta = dashboardTabs.find((tab) => tab.id === activeTab) || dashboardTabs[0];
  const lastUpdatedLabel = useMemo(() => {
    if (!firstPartySummary?.lastEventAt) return "waiting for events";
    return `last event ${new Date(firstPartySummary.lastEventAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }, [firstPartySummary?.lastEventAt]);

  return (
    <div className="min-h-screen bg-[#eef2f7] text-ink dark:bg-slate-950 dark:text-white md:grid md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-50 h-auto border-b border-slate-800 bg-slate-950 px-4 py-4 text-white md:flex md:h-screen md:flex-col md:overflow-hidden md:border-b-0 md:px-5 md:py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <span className="text-xl font-black">FK</span>
          </div>
          <div>
            <p className="text-lg font-black leading-tight">Fynd Kio</p>
            <p className="text-sm font-semibold text-slate-400">Adoption Dashboard</p>
          </div>
        </div>

        <div className="my-5 hidden h-px bg-white/10 md:block" />

        <nav className="flex gap-2 overflow-x-auto pb-1 md:grid md:min-h-0 md:flex-1 md:overflow-y-auto md:overflow-x-hidden md:pr-1">
          {dashboardTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "group flex min-w-[230px] items-center gap-3 rounded-2xl px-3 py-3 text-left transition md:min-w-0",
                  selected
                    ? "bg-white text-slate-950 shadow-lg"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                    selected ? "bg-blue-50 text-brand" : "bg-white/10 text-slate-400 group-hover:bg-white/15 group-hover:text-white"
                  ].join(" ")}
                >
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-black leading-tight">{tab.label}</span>
                  <span className={selected ? "text-xs font-semibold text-slate-500" : "text-xs font-semibold text-slate-500"}>
                    {tab.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-5 shrink-0 rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.16)]" />
            <p className="text-sm font-black">Live monitoring</p>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-400">{firstPartyError ? "Polling fallback active" : lastUpdatedLabel}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-6 lg:px-8">
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.75fr)_minmax(620px,1.25fr)] xl:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-brand">Internal analytics</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-ink dark:text-white">{activeTabMeta.label}</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted dark:text-slate-400">
                {activeTabMeta.headerCopy}
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-xs font-black text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                  <CheckCircle2 size={15} />
                  {firstPartyError ? "Polling fallback" : "Live"}
                </div>
                <button
                  type="button"
                  onClick={loadFirstParty}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-ink shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode((current) => !current)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-ink shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                  {darkMode ? "Light" : "Dark"}
                </button>
              </div>
              <GlobalFilters
                filters={filters}
                property={property}
                activeTabLabel={activeTabMeta.label}
                onChange={setFilters}
                onReset={() => setFilters(defaultFilters())}
                onApply={loadFirstParty}
              />
            </div>
          </div>
        </header>

        <main className="grid gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {firstPartyError ? <ErrorState message={firstPartyError} /> : null}

          <DashboardSections
            activeTab={activeTab}
            summary={firstPartySummary}
            property={property}
            installSnippet={installSnippet}
            copied={copied}
            onCopySnippet={copySnippet}
          />
        </main>
      </div>
    </div>
  );
}
