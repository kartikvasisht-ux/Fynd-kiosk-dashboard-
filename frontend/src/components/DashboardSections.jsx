import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  CreditCard,
  Database,
  LayoutDashboard,
  Monitor,
  Radio,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  XCircle
} from "lucide-react";
import { formatCurrency, formatDurationMs, formatNumber, formatPercent, shortDate } from "../lib/format";

export const dashboardTabs = [
  { id: "overview", label: "Executive Overview", description: "Business KPIs", icon: LayoutDashboard, headerCopy: "Kiosk adoption, revenue, conversion, and action priorities." },
  { id: "usage", label: "Kiosk Usage Analytics", description: "Utilization", icon: Monitor, headerCopy: "How often kiosks are opened, used, completed, or abandoned across stores and brands." },
  { id: "users", label: "User Registration & Customer Analytics", description: "Registration", icon: Users, headerCopy: "Customer acquisition, returning user behavior, login reliability, and repeat purchase signals." },
  { id: "journey", label: "Customer Journey & Funnel", description: "Drop-offs", icon: TrendingUp, headerCopy: "Where customers progress, pause, and drop off inside the kiosk journey." },
  { id: "orders", label: "Order & Revenue Analytics", description: "Sales", icon: Database, headerCopy: "Order volume, revenue generation, AOV, and commercial contribution by store and brand." },
  { id: "payments", label: "Payment Analytics", description: "Success rate", icon: CreditCard, headerCopy: "Payment mode performance, success rate, retries, failures, and timeout behavior." },
  { id: "brands", label: "Brand Health Analytics", description: "Performance", icon: Building2, headerCopy: "Brand rankings, revenue, orders, conversion, abandonment, and average order value." },
  { id: "oms", label: "OMS & Operational Analytics", description: "SLA", icon: ClipboardCheck, headerCopy: "OMS workflow activity, operational SLA timing, company-level actions, and cancellation patterns." },
  { id: "products", label: "Product & Cart Analytics", description: "Catalog", icon: ShoppingCart, headerCopy: "Product scans, cart behavior, barcode issues, conversion, returns, and abandonment." },
  { id: "errors", label: "Error & Support Analytics", description: "Issues", icon: AlertTriangle, headerCopy: "Technical and operational issues affecting kiosk performance and customer experience." },
  { id: "devices", label: "Device & Store Health", description: "Health", icon: Radio, headerCopy: "Device uptime, connectivity, app versions, and store-level performance health." },
  { id: "adoption", label: "Adoption Insights", description: "Actions", icon: Target, headerCopy: "Advanced adoption signals across acquisition, conversion, operations, and business growth." }
];

export function DashboardSections({ activeTab, summary, property, installSnippet, copied, onCopySnippet }) {
  const sections = {
    overview: <ExecutiveOverview summary={summary} />,
    usage: <KioskUsage summary={summary} />,
    users: <UserAnalytics summary={summary} />,
    journey: <JourneyFunnel summary={summary} />,
    orders: <OrdersRevenue summary={summary} />,
    payments: <PaymentAnalytics summary={summary} />,
    brands: <BrandHealth summary={summary} />,
    oms: <OmsOperations summary={summary} />,
    products: <ProductCart summary={summary} />,
    errors: <ErrorSupport summary={summary} />,
    devices: (
      <DeviceStore
        summary={summary}
        property={property}
        installSnippet={installSnippet}
        copied={copied}
        onCopySnippet={onCopySnippet}
      />
    ),
    adoption: <AdoptionInsights summary={summary} />
  };

  return sections[activeTab] || sections.overview;
}

function ExecutiveOverview({ summary }) {
  const executive = summary?.executive || {};
  const journey = summary?.journey || {};
  const brands = summary?.brands || {};
  const products = summary?.products || {};
  const oms = summary?.oms || {};

  return (
    <Section title="Executive Overview" copy="High-level kiosk business performance from the planning document: engagement, revenue, conversion, and payment health.">
      <MetricGrid
        metrics={[
          ["Total kiosk opens", executive.totalKioskOpens, "number", "Customer engagement"],
          ["Total users", executive.totalUsers, "number", "Known hashed users"],
          ["New registered users", executive.newRegisteredUsers, "number", "Customer acquisition"],
          ["Returning users", executive.returningUsers, "number", "Customer retention"],
          ["Total orders", executive.totalOrders, "number", "Orders completed"],
          ["Total revenue", executive.totalRevenue, "currency", "Accepted revenue events"],
          ["AOV", executive.averageOrderValue, "currency", "Total revenue / orders"],
          ["Average cart value", executive.averageCartValue, "currency", "Customer purchase intent"],
          ["Conversion rate", executive.conversionRate, "percent", "Orders / sessions"],
          ["Cart abandonment", executive.cartAbandonmentRate, "percent", "Lost opportunity"],
          ["Payment success", executive.paymentSuccessRate, "percent", "Payment system health"],
          ["Payment failure", executive.paymentFailureRate, "percent", "Payment friction"],
          ["Brand health", firstRowValue(brands.brandConversion, "conversionRate"), "percent", "Top tracked brand conversion"],
          ["Avg checkout time", journey.cartToOrderAvgMs, "duration", "Cart to order completion"],
          ["Return rate", firstRowValue(products.productReturnRate, "rate"), "percent", "Highest tracked product return rate"],
          ["OMS processing time", oms.avgPlaceToConfirmTimeMs, "duration", "Order placed to confirm"],
          ["Avg session duration", executive.avgSessionDurationMs, "duration", "User experience efficiency"],
          ["Pilot stores live", `${executive.pilotStoresLive ?? 0}/${executive.pilotStoresTotal ?? 0}`, "text", "Rollout coverage"],
          ["Kiosks installed", executive.kiosksInstalled, "number", "Fleet size"]
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <Panel title="Daily trend graph" subtitle="Sessions, orders, and revenue trend from live events" tall>
          <LineChart
            rows={summary?.trends?.daily || []}
            series={[
              { key: "sessions", label: "Sessions", color: "#3157e8" },
              { key: "orders", label: "Orders", color: "#16a34a" },
              { key: "revenue", label: "Revenue", color: "#f59e0b" }
            ]}
          />
        </Panel>
        <Panel title="Conversion funnel snapshot" subtitle="Kiosk opened to order completed">
          <EnterpriseFunnel rows={journeyStages(summary)} />
        </Panel>
      </div>
    </Section>
  );
}

function KioskUsage({ summary }) {
  const usage = summary?.usage || {};

  return (
    <Section title="Kiosk Usage Analytics" copy="Kiosk utilization, customer interaction, and session behavior across stores and brands.">
      <MetricGrid
        metrics={[
          ["Total kiosk opens", usage.totalKioskOpens, "number", "All tracked opens"],
          ["Daily kiosk opens", usage.dailyKioskOpens, "number", "Last 24 hours"],
          ["Weekly kiosk opens", usage.weeklyKioskOpens, "number", "Last 7 days"],
          ["Monthly kiosk opens", usage.monthlyKioskOpens, "number", "Last 30 days"],
          ["Active kiosks", usage.activeKiosks, "number", "Latest online status"],
          ["Total sessions", usage.totalSessions, "number", "Tracked sessions"],
          ["Avg session duration", usage.avgSessionDurationMs, "duration", "Session start to end"],
          ["Session timeouts", usage.sessionTimeoutCount, "number", "Timeout events"],
          ["Sessions completed", usage.sessionsCompleted, "number", "Completed journeys"],
          ["Sessions abandoned", usage.sessionsAbandoned, "number", "Not completed"]
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <RankedList title="Kiosk usage by store" rows={usage.kioskUsageByStore} valueKey="count" />
        <RankedList title="Kiosk usage by brand" rows={usage.kioskUsageByBrand} valueKey="count" />
        <Panel title="Usage trend" subtitle="Peak kiosk usage signals">
          <LineChart rows={summary?.trends?.daily || []} series={[{ key: "sessions", label: "Sessions", color: "#3157e8" }]} />
        </Panel>
      </div>
    </Section>
  );
}

function UserAnalytics({ summary }) {
  const users = summary?.users || {};

  return (
    <Section title="User Registration & Customer Analytics" copy="Customer acquisition, retention, repeat purchase behavior, and login performance.">
      <MetricGrid
        metrics={[
          ["Registered numbers", users.totalRegisteredNumbers, "number", "Hashed customer identifiers"],
          ["New registrations", users.newUserRegistrations, "number", "New user acquisition"],
          ["Daily new users", users.dailyNewUsers, "number", "Last 24 hours"],
          ["Weekly new users", users.weeklyNewUsers, "number", "Last 7 days"],
          ["Monthly new users", users.monthlyNewUsers, "number", "Last 30 days"],
          ["Returning users", users.returningUsers, "number", "Customer retention"],
          ["Returning user orders", users.returningUserOrders, "number", "Repeat behavior"],
          ["Repeat purchase", users.repeatPurchaseRate, "percent", "Repeat purchase rate"],
          ["Existing user revenue", users.existingUserRevenue, "currency", "Revenue from returning users"],
          ["QR login count", users.qrLoginCount, "number", "QR login usage"],
          ["OTP login count", users.otpLoginCount, "number", "OTP login usage"],
          ["OTP success rate", users.otpSuccessRate, "percent", "OTP reliability"],
          ["OTP failure rate", users.otpFailureRate, "percent", "OTP friction"]
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="User growth trend" subtitle="New user registrations by day">
          <LineChart rows={summary?.trends?.userGrowth || []} series={[{ key: "value", label: "New users", color: "#3157e8" }]} />
        </Panel>
        <Panel title="New vs returning users" subtitle="Acquisition and retention balance">
          <OutcomeRatio
            positiveLabel="New"
            negativeLabel="Returning"
            positive={users.newUserRegistrations}
            negative={users.returningUsers}
          />
        </Panel>
      </div>
    </Section>
  );
}

function JourneyFunnel({ summary }) {
  const journey = summary?.journey || {};
  const stages = journeyStages(summary);

  return (
    <Section title="Customer Journey & Funnel Analytics" copy="Complete customer journey from kiosk open to order completion, including cart and payment drop-offs.">
      <Panel title="Customer flow to checkout" subtitle="Stage-by-stage movement through the kiosk journey">
        <JourneyFlowCards rows={stages} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Full kiosk conversion funnel" subtitle="Customers at each journey stage" tall>
          <PremiumFunnel rows={stages} />
        </Panel>
        <Panel title="Drop-off analysis" subtitle="Largest friction points and next actions" tall>
          <DropOffTable rows={stages} />
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <CompactMetric label="Cart abandonment" value={journey.cartAbandonmentRate} type="percent" note="Cart sessions without order" />
        <CompactMetric label="Checkout conversion" value={journey.checkoutConversionRate} type="percent" note="Orders / checkout starts" />
        <CompactMetric label="Payment conversion" value={journey.paymentConversionRate} type="percent" note="Payment success / attempts" />
        <CompactMetric label="Cart to order avg" value={journey.cartToOrderAvgMs} type="duration" note="Cart to order" />
        <CompactMetric label="Overall journey avg" value={journey.overallJourneyAvgMs} type="duration" note="Session to order" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <MetricGrid
          compact
          metrics={[
            ["Total carts created", journey.totalCartsCreated, "number", "Created cart references"],
            ["Average cart value", journey.averageCartValue, "currency", "Average amount in cart"],
            ["Avg items per cart", journey.avgItemsPerCart, "number", "Items per cart"],
            ["Abandoned carts", journey.abandonedCarts, "number", "Cart sessions without order"],
            ["PLP to cart avg", journey.plpToCartAvgMs, "duration", "Discovery to cart"],
            ["Payment completion avg", journey.paymentCompletionAvgMs, "duration", "Payment initiation to final state"]
          ]}
        />
        <Panel title="Checkout friction indicators" subtitle="Cart value and scan issues">
          <FrictionIndicators summary={summary} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedList title="Cart value by brand" rows={journey.cartValueByBrand} valueKey="amount" valueType="currency" />
        <RankedList title="Cart value by store" rows={journey.cartValueByStore} valueKey="amount" valueType="currency" />
      </div>
    </Section>
  );
}

function OrdersRevenue({ summary }) {
  const orders = summary?.ordersRevenue || {};
  const orderRows = orderStages(summary);

  return (
    <Section title="Order & Revenue Analytics" copy="Order performance, revenue generation, AOV, and store or brand contribution.">
      <MetricGrid
        metrics={[
          ["Daily orders", orders.dailyOrders, "number", "Last 24 hours"],
          ["Weekly orders", orders.weeklyOrders, "number", "Last 7 days"],
          ["Monthly orders", orders.monthlyOrders, "number", "Last 30 days"],
          ["Total revenue", orders.totalRevenue, "currency", "Revenue generated"],
          ["AOV", orders.averageOrderValue, "currency", "Total revenue / total orders"],
          ["Revenue per user", orders.revenuePerUser, "currency", "Revenue / users"],
          ["Revenue per session", orders.revenuePerSession, "currency", "Revenue / sessions"],
          ["Revenue per kiosk", orders.revenuePerKiosk, "currency", "Revenue / kiosks"],
          ["MoM order growth", orders.momOrderGrowthRate, "percent", "Current vs previous month"]
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Order funnel" subtitle="Cart creation through payment success, order completion, and OMS handling" tall>
          <PremiumFunnel rows={orderRows} />
        </Panel>
        <Panel title="Order drop-off analysis" subtitle="Where carts stop before confirmed operations" tall>
          <DropOffTable rows={orderRows} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Revenue trend" subtitle="Revenue by day from order/payment amount fields">
          <LineChart rows={orders.revenueTrend || []} series={[{ key: "value", label: "Revenue", color: "#3157e8" }]} valueType="currency" />
        </Panel>
        <RankedList title="Revenue by store" rows={orders.revenueByStore} valueKey="amount" valueType="currency" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RankedList title="Orders by store" rows={orders.ordersByStore} valueKey="count" />
        <RankedList title="Orders by brand" rows={orders.ordersByBrand} valueKey="count" />
      </div>
    </Section>
  );
}

function PaymentAnalytics({ summary }) {
  const payments = summary?.payments || {};

  return (
    <Section title="Payment Analytics" copy="Payment mode behavior, success and failure rate, retries, timeouts, and payment friction reasons.">
      <MetricGrid
        metrics={[
          ["Total transactions", payments.totalTransactions, "number", "Payment events"],
          ["Payment success rate", payments.paymentSuccessRate, "percent", "Successful outcomes"],
          ["Payment failure rate", payments.paymentFailureRate, "percent", "Failed outcomes"],
          ["Declined by customer", payments.paymentDeclinedByCustomer, "number", "Customer declined"],
          ["Retry count", payments.paymentRetryCount, "number", "Retry attempts"],
          ["Timeout count", payments.paymentTimeoutCount, "number", "Timeout events"],
          ["Avg payment completion", payments.avgPaymentCompletionTimeMs, "duration", "Payment start to final state"]
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Panel title="Payment funnel" subtitle="Payment initiation to success">
          <EnterpriseFunnel rows={payments.funnel || paymentStages(summary)} />
        </Panel>
        <Panel title="Success vs failure trend" subtitle="Payment outcome trend">
          <StackedOutcome rows={payments.successVsFailureTrend || []} />
        </Panel>
        <RankedList title="Payment modes" rows={payments.paymentModeDistribution} valueKey="count" />
      </div>

      <RankedList title="Failure reason tracking" rows={payments.failureReasons} valueKey="count" />
    </Section>
  );
}

function BrandHealth({ summary }) {
  const brands = summary?.brands || {};

  return (
    <Section title="Brand Health Analytics" copy="Brand performance through kiosk orders, revenue, conversion, cart abandonment, and AOV.">
      <div className="grid gap-5 xl:grid-cols-3">
        <RankedList title="Top ordered brands" rows={brands.topOrderedBrands} valueKey="count" />
        <RankedList title="Brand-wise revenue" rows={brands.brandWiseRevenue} valueKey="amount" valueType="currency" />
        <RankedList title="Brand-wise orders" rows={brands.brandWiseOrders} valueKey="count" />
        <RankedList title="Brand conversion rate" rows={brands.brandConversion} valueKey="conversionRate" valueType="percent" />
        <RankedList title="Brand cart abandonment" rows={brands.brandCartAbandonment} valueKey="abandonmentRate" valueType="percent" />
        <RankedList title="Avg order value by brand" rows={brands.avgOrderValueByBrand} valueKey="amount" valueType="currency" />
      </div>
    </Section>
  );
}

function OmsOperations({ summary }) {
  const oms = summary?.oms || {};

  return (
    <Section title="OMS & Operational Analytics" copy="OMS workflow, CTA actions, company-level activity, SLA timing, and cancellation patterns.">
      <MetricGrid
        metrics={[
          ["Confirm CTA clicks", oms.confirmCtaClicks, "number", "Confirm workflow"],
          ["Pack CTA clicks", oms.packCtaClicks, "number", "Packing workflow"],
          ["Return CTA clicks", oms.returnCtaClicks, "number", "Return workflow"],
          ["Cancel CTA clicks", oms.cancelCtaClicks, "number", "Cancellation workflow"],
          ["Companies confirm CTA", oms.companiesClickingConfirmCta, "number", "Company-level action"],
          ["Companies return CTA", oms.companiesClickingReturnCta, "number", "Company-level action"],
          ["Avg place to confirm", oms.avgPlaceToConfirmTimeMs, "duration", "Confirmation timestamp - placement timestamp"]
        ]}
      />

      <RankedList title="Cancellation patterns" rows={oms.cancellationPatterns} valueKey="count" />
    </Section>
  );
}

function ProductCart({ summary }) {
  const products = summary?.products || {};

  return (
    <Section title="Product & Cart Analytics" copy="Product-level customer behavior, barcode issues, cart edits, conversion, returns, and abandonment.">
      <MetricGrid
        metrics={[
          ["Product not found", products.productNotFoundCount, "number", "Catalog issue"],
          ["Manual barcode entry", products.manualBarcodeEntryCount, "number", "Manual scan fallback"],
          ["Duplicate item count", products.duplicateItemCount, "number", "Duplicate cart/scans"],
          ["Quantity modifications", products.quantityModificationCount, "number", "Cart quantity edits"]
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <RankedList title="Most scanned products" rows={products.mostScannedProducts} valueKey="count" />
        <RankedList title="Most purchased products" rows={products.mostPurchasedProducts} valueKey="count" />
        <RankedList title="Product conversion rate" rows={products.productConversion} valueKey="conversionRate" valueType="percent" />
        <RankedList title="Product return rate" rows={products.productReturnRate} valueKey="rate" valueType="percent" />
        <RankedList title="Product abandonment rate" rows={products.productAbandonmentRate} valueKey="abandonmentRate" valueType="percent" />
      </div>
    </Section>
  );
}

function ErrorSupport({ summary }) {
  const errors = summary?.errors || {};

  return (
    <Section title="Error & Support Analytics" copy="Technical and operational issues affecting customer experience and kiosk stability.">
      <MetricGrid
        metrics={[
          ["OTP failures", errors.otpFailures, "number", "Login friction"],
          ["Payment failures", errors.paymentFailures, "number", "Payment friction"],
          ["Scanner errors", errors.scannerErrors, "number", "Scan problems"],
          ["Network errors", errors.networkErrors, "number", "Connectivity issues"],
          ["Product not found errors", errors.productNotFoundErrors, "number", "Catalog mismatch"],
          ["App crashes", errors.appCrashes, "number", "Application stability"],
          ["Session timeout errors", errors.sessionTimeoutErrors, "number", "Timeout friction"],
          ["Support module clicks", errors.supportModuleClicks, "number", "Support demand"],
          ["Retry button clicks", errors.retryButtonClicks, "number", "Retry behavior"],
          ["Offline retry clicks", errors.offlineRetryClicks, "number", "Offline recovery"],
          ["Payment retry clicks", errors.paymentRetryClicks, "number", "Payment retry behavior"]
        ]}
      />

      <RankedList title="Error categories" rows={errors.errorCategories} valueKey="count" />
    </Section>
  );
}

function DeviceStore({ summary, property, installSnippet, copied, onCopySnippet }) {
  const devices = summary?.devices || {};

  return (
    <Section title="Device & Store Health Analytics" copy="Kiosk infrastructure, device performance, connectivity, app version, and store-level performance.">
      <MetricGrid
        metrics={[
          ["Active kiosks", devices.activeKiosks, "number", "Latest online status"],
          ["Offline kiosks", devices.offlineKiosks, "number", "Latest offline status"],
          ["Device uptime", devices.deviceUptimeRate, "percent", "Device health events"],
          ["Network uptime", devices.networkUptimeRate, "percent", "Network heartbeat events"],
          ["Accepted events", summary?.totalEvents, "number", "Stored first-party rows"],
          ["Events last 5m", summary?.eventsLast5m, "number", "Realtime stream activity"],
          ["Active sessions 30m", summary?.activeSessions30m, "number", "Realtime sessions"]
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <RankedList title="Internet connectivity status" rows={devices.internetConnectivityStatus} valueKey="count" />
        <RankedList title="Kiosk health status" rows={devices.kioskHealthStatus} valueKey="count" />
        <RankedList title="App version distribution" rows={devices.appVersionDistribution} valueKey="count" />
        <RankedList title="Store-wise orders" rows={devices.storeWiseOrders} valueKey="count" />
        <RankedList title="Store-wise revenue" rows={devices.storeWiseRevenue} valueKey="amount" valueType="currency" />
        <RankedList title="Store-wise conversion" rows={devices.storeWiseConversion} valueKey="conversionRate" valueType="percent" />
        <RankedList title="Store-wise return rate" rows={devices.storeWiseReturnRate} valueKey="rate" valueType="percent" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Recent live events" subtitle="Latest accepted collector rows">
          <RecentEvents events={summary?.recentEvents || []} />
        </Panel>
        <Panel title="First-party data-layer injection" subtitle="Install this in the FashionFactory self-checkout entrypoint">
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Collector" value={property.collectorPath} />
            <InfoTile label="Bridge" value={property.bridgePath} />
            <InfoTile label="Source" value="_ds=2790" />
          </div>
          <pre className="max-h-80 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs font-semibold leading-6 text-slate-100">
            {installSnippet}
          </pre>
          <button
            type="button"
            onClick={onCopySnippet}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700 dark:bg-white dark:text-ink"
          >
            <Clipboard size={16} />
            {copied ? "Copied" : "Copy snippet"}
          </button>
        </Panel>
      </div>
    </Section>
  );
}

function AdoptionInsights({ summary }) {
  const executive = summary?.executive || {};
  const journey = summary?.journey || {};
  const oms = summary?.oms || {};
  const devices = summary?.devices || {};

  const pillars = [
    {
      title: "Customer Acquisition",
      copy: "Kiosk usage, registrations, and user growth.",
      metrics: [
        ["Kiosk opens", executive.totalKioskOpens, "number"],
        ["New registrations", executive.newRegisteredUsers, "number"],
        ["Total users", executive.totalUsers, "number"]
      ]
    },
    {
      title: "Conversion Optimization",
      copy: "Cart funnel, payment success, and order completion.",
      metrics: [
        ["Conversion", executive.conversionRate, "percent"],
        ["Payment success", executive.paymentSuccessRate, "percent"],
        ["Orders", executive.totalOrders, "number"]
      ]
    },
    {
      title: "Operational Efficiency",
      copy: "OMS processing, return handling, and cancellation trends.",
      metrics: [
        ["Avg place to confirm", oms.avgPlaceToConfirmTimeMs, "duration"],
        ["Cancel CTA clicks", oms.cancelCtaClicks, "number"],
        ["Return CTA clicks", oms.returnCtaClicks, "number"]
      ]
    },
    {
      title: "Business Growth",
      copy: "Revenue, brand performance, and repeat customers.",
      metrics: [
        ["Revenue", executive.totalRevenue, "currency"],
        ["AOV", executive.averageOrderValue, "currency"],
        ["Cart value", journey.averageCartValue, "currency"]
      ]
    }
  ];

  return (
    <Section title="Adoption Insights" copy="Advanced adoption signals across acquisition, conversion optimization, operational efficiency, and business growth.">
      <div className="grid gap-5 xl:grid-cols-4">
        {pillars.map((pillar) => (
          <Panel key={pillar.title} title={pillar.title} subtitle={pillar.copy}>
            <div className="grid gap-3">
              {pillar.metrics.map(([label, value, type]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm font-bold text-muted dark:text-slate-400">{label}</p>
                  <p className="text-lg font-black text-ink dark:text-white">{formatMetric(value, type)}</p>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Cohort analysis" subtitle="Repeat customer behavior over time">
          <Waiting copy="Cohort rows will populate when repeat customer events include cohort windows." />
        </Panel>
        <Panel title="Peak hour analysis" subtitle="Busiest kiosk usage hours">
          <Waiting copy="Peak hour analysis needs hourly event aggregation from the collector." />
        </Panel>
        <Panel title="Store benchmarking" subtitle="Compare stores by conversion, revenue, orders, and returns">
          <RankedMini rows={devices.storeWiseConversion} valueKey="conversionRate" valueType="percent" />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Funnel drop-off analysis" subtitle="Identify stages where customers abandon">
          <DropOffTable rows={journeyStages(summary)} />
        </Panel>
        <Panel title="SLA monitoring" subtitle="OMS processing and operational readiness">
          <div className="grid gap-3">
            <InlineMetric label="OMS processing time" value={oms.avgPlaceToConfirmTimeMs} type="duration" />
            <InlineMetric label="Cancel CTA clicks" value={oms.cancelCtaClicks} type="number" />
            <InlineMetric label="Return CTA clicks" value={oms.returnCtaClicks} type="number" />
            <InlineMetric label="Device uptime" value={devices.deviceUptimeRate} type="percent" />
            <InlineMetric label="Network uptime" value={devices.networkUptimeRate} type="percent" />
          </div>
        </Panel>
      </div>

    </Section>
  );
}

function Section({ title, copy, children }) {
  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-black uppercase text-brand">Fynd kiosk dashboard</p>
        <h2 className="text-2xl font-black text-ink dark:text-white">{title}</h2>
        <p className="max-w-4xl text-sm font-medium leading-6 text-muted dark:text-slate-400">{copy}</p>
      </div>
      {children}
    </section>
  );
}

function MetricGrid({ metrics, compact = false }) {
  return (
    <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"}`}>
      {metrics.map(([label, value, type, note]) => (
        <CompactMetric key={label} label={label} value={value} type={type} note={note} />
      ))}
    </div>
  );
}

function CompactMetric({ label, value, type, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-bold text-muted dark:text-slate-400">{label}</p>
      <p className="mt-4 break-words text-2xl font-black text-ink dark:text-white">{formatMetric(value, type)}</p>
      {note ? <p className="mt-2 text-xs font-semibold leading-5 text-muted dark:text-slate-500">{note}</p> : null}
    </div>
  );
}

function Panel({ title, subtitle, children, tall = false }) {
  return (
    <section
      className={[
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900",
        tall ? "min-h-[430px]" : ""
      ].join(" ")}
    >
      <div className="mb-4">
        <h3 className="text-lg font-black text-ink dark:text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm font-medium text-muted dark:text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function EnterpriseFunnel({ rows = [] }) {
  const max = Math.max(...rows.map((row) => Number(row.count) || 0), 0);
  const hasSignal = rows.some((row) => Number(row.count) > 0);

  return (
    <div className="grid gap-3">
      {rows.map((row, index) => (
        <div key={row.name} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-black text-brand shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-ink dark:text-white">{row.name}</p>
                <p className="text-xs font-semibold text-muted dark:text-slate-500">
                  {row.dropOffRate === null || row.dropOffRate === undefined ? "Entry stage" : `Drop-off ${formatPercent(row.dropOffRate)}`}
                </p>
              </div>
            </div>
            <p className="text-xl font-black text-ink dark:text-white">{formatNumber(row.count)}</p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${max ? Math.max(4, ((Number(row.count) || 0) / max) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
      {!hasSignal ? <Waiting copy="Funnel stages are ready. Counts appear when real journey events arrive." /> : null}
    </div>
  );
}

function JourneyFlowCards({ rows = [] }) {
  const first = Number(rows[0]?.count) || 0;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[1080px] items-stretch gap-3">
        {rows.map((row, index) => {
          const count = Number(row.count) || 0;
          const reach = first ? (count / first) * 100 : index === 0 && count ? 100 : 0;
          return (
            <div key={row.name} className="relative flex min-h-[132px] flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              {index > 0 ? <span className="absolute -left-3 top-1/2 hidden h-px w-3 bg-slate-300 lg:block" /> : null}
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-brand dark:bg-blue-950">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black leading-5 text-ink dark:text-white">{row.name}</p>
                  <p className="mt-2 text-2xl font-black text-ink dark:text-white">{formatNumber(count)}</p>
                  <p className="mt-1 text-xs font-black text-muted dark:text-slate-500">
                    {index === 0 ? "100% reach" : `${formatPercent(reach)} reach | ${formatPercent(row.dropOffRate)} drop`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PremiumFunnel({ rows = [] }) {
  const first = Number(rows[0]?.count) || 0;

  if (!rows.some((row) => Number(row.count) > 0)) {
    return <Waiting copy="Funnel visualization updates when real journey events arrive." />;
  }

  return (
    <div className="grid gap-4">
      {rows.map((row, index) => {
        const count = Number(row.count) || 0;
        const percent = first ? (count / first) * 100 : 0;
        return (
          <div key={row.name} className="grid grid-cols-[150px_minmax(0,1fr)_74px] items-center gap-4 text-sm">
            <p className="truncate font-black text-slate-700 dark:text-slate-300">{row.name}</p>
            <div className="h-10 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
              <div
                className="flex h-full items-center justify-end rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-3 text-sm font-black text-white shadow-sm"
                style={{ width: `${Math.max(0, percent)}%`, minWidth: count ? "48px" : "0" }}
              >
                {count ? formatPercent(index === 0 ? 100 : percent) : ""}
              </div>
            </div>
            <p className="text-right font-bold text-muted dark:text-slate-400">{formatNumber(count)}</p>
          </div>
        );
      })}
    </div>
  );
}

function DropOffTable({ rows = [] }) {
  const losses = rows.slice(1).map((row, index) => {
    const previous = Number(rows[index]?.count) || 0;
    const current = Number(row.count) || 0;
    const lost = Math.max(0, previous - current);
    const drop = row.dropOffRate ?? (previous ? (lost / previous) * 100 : null);
    return {
      stage: `${rows[index]?.name || "Previous"} to ${row.name}`,
      lost,
      drop,
      severity: severityFor(drop),
      action: actionForStage(row.name)
    };
  });

  if (!losses.some((row) => row.lost > 0 || Number(row.drop) > 0)) {
    return <Waiting copy="Drop-off analysis appears when at least two journey stages have customer movement." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr className="text-xs font-black uppercase tracking-wide text-slate-500">
            <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">Stage</th>
            <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">Users lost</th>
            <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">Drop-off %</th>
            <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">Severity</th>
            <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">Recommended action</th>
          </tr>
        </thead>
        <tbody>
          {losses.map((row) => (
            <tr key={row.stage} className="border-b border-slate-100">
              <td className="border-b border-slate-100 px-4 py-4 font-bold text-ink dark:border-slate-800 dark:text-white">{row.stage}</td>
              <td className="border-b border-slate-100 px-4 py-4 font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">{formatNumber(row.lost)}</td>
              <td className="border-b border-slate-100 px-4 py-4 font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">{formatPercent(row.drop)}</td>
              <td className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
                <SeverityBadge severity={row.severity} />
              </td>
              <td className="border-b border-slate-100 px-4 py-4 font-semibold text-muted dark:border-slate-800 dark:text-slate-400">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FrictionIndicators({ summary }) {
  const products = summary?.products || {};
  const errors = summary?.errors || {};
  const rows = [
    ["Product not found", products.productNotFoundCount],
    ["Manual barcode entry", products.manualBarcodeEntryCount],
    ["Duplicate item count", products.duplicateItemCount],
    ["Quantity modifications", products.quantityModificationCount],
    ["Scanner errors", errors.scannerErrors],
    ["Payment retry clicks", errors.paymentRetryClicks]
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-muted dark:text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-ink dark:text-white">{formatNumber(value)}</p>
        </div>
      ))}
    </div>
  );
}

function LineChart({ rows = [], series = [], valueType = "number" }) {
  const width = 640;
  const height = 300;
  const padding = 34;
  const visibleSeries = series.filter((item) => rows.some((row) => Number(row[item.key]) > 0));
  const values = rows.flatMap((row) => visibleSeries.map((item) => Number(row[item.key]) || 0));
  const max = Math.max(...values, 0);

  if (!rows.length || max === 0 || !visibleSeries.length) return <EmptyChart />;

  const pointsFor = (key) => rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : padding + (index / (rows.length - 1)) * (width - padding * 2);
    const y = height - padding - ((Number(row[key]) || 0) / max) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  const ticks = rows.length < 3 ? rows : [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full overflow-visible">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d6deea" strokeWidth="1.2" />
        {[0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1={padding}
            y1={height - padding - tick * (height - padding * 2)}
            x2={width - padding}
            y2={height - padding - tick * (height - padding * 2)}
            stroke="#e8edf5"
            strokeDasharray="4 6"
            strokeWidth="1"
          />
        ))}
        {visibleSeries.map((item, index) => (
          <polyline
            key={item.key}
            fill="none"
            stroke={item.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={index === 0 ? "4" : "2.5"}
            points={pointsFor(item.key)}
            opacity={index === 0 ? 1 : 0.75}
          />
        ))}
        {ticks.map((row, index) => {
          const rowIndex = rows.indexOf(row);
          const x = rows.length === 1 ? width / 2 : padding + (rowIndex / (rows.length - 1)) * (width - padding * 2);
          return (
            <text key={`${row.date || index}-${index}`} x={x} y={height - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#98a2b3">
              {shortDate(row.date) || row.label || row.name || ""}
            </text>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
        {visibleSeries.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2 text-sm font-bold text-muted dark:text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="text-sm font-semibold text-muted dark:text-slate-500">Peak {formatMetric(max, valueType)}</span>
      </div>
    </div>
  );
}

function StackedOutcome({ rows = [] }) {
  if (!rows.length) return <Waiting copy="Payment success and failure trends populate from payment outcome events." />;
  const max = Math.max(...rows.map((row) => (Number(row.success) || 0) + (Number(row.failure) || 0)), 0);
  if (!max) return <Waiting copy="No payment outcome volume yet." />;

  return (
    <div className="flex h-64 items-end gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950">
      {rows.slice(-24).map((row) => {
        const successHeight = ((Number(row.success) || 0) / max) * 180;
        const failureHeight = ((Number(row.failure) || 0) / max) * 180;
        return (
          <div key={row.date} className="flex min-w-10 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex w-full flex-col justify-end overflow-hidden rounded-t bg-slate-200 dark:bg-slate-800" style={{ height: `${Math.max(4, successHeight + failureHeight)}px` }}>
              <div className="w-full bg-red-500" style={{ height: `${failureHeight}px` }} />
              <div className="w-full bg-brand" style={{ height: `${successHeight}px` }} />
            </div>
            <span className="text-[10px] font-bold text-muted dark:text-slate-500">{row.date?.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function OutcomeRatio({ positiveLabel, negativeLabel, positive, negative }) {
  const positiveCount = Number(positive) || 0;
  const negativeCount = Number(negative) || 0;
  const total = positiveCount + negativeCount;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <OutcomeTile icon={CheckCircle2} label={positiveLabel} value={positiveCount} tone="success" />
        <OutcomeTile icon={XCircle} label={negativeLabel} value={negativeCount} tone="failure" />
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full bg-brand" style={{ width: `${total ? (positiveCount / total) * 100 : 0}%` }} />
      </div>
      <p className="text-sm font-bold text-muted dark:text-slate-400">
        {total ? `${formatPercent((positiveCount / total) * 100)} ${positiveLabel.toLowerCase()} share.` : "Waiting for matching user events."}
      </p>
    </div>
  );
}

function OutcomeTile({ icon: Icon, label, value, tone }) {
  const colors = tone === "success" ? "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase text-muted dark:text-slate-500">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${colors}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-black text-ink dark:text-white">{formatNumber(value)}</p>
    </div>
  );
}

function RankedList({ title, rows = [], valueKey = "count", valueType = "number" }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 0);
  return (
    <Panel title={title} subtitle="Ranked from live event data">
      {!rows.length ? (
        <Waiting />
      ) : (
        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {rows.slice(0, 10).map((row) => (
            <div key={row.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-bold text-ink dark:text-white">{row.name || "unknown"}</span>
                <span className="font-black text-brand">{formatMetric(row[valueKey], valueType)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${max ? Math.max(5, ((Number(row[valueKey]) || 0) / max) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RankedMini({ rows = [], valueKey = "count", valueType = "number" }) {
  if (!rows.length) return <Waiting copy="Store benchmarking appears when store-level events are available." />;
  return (
    <div className="grid gap-3">
      {rows.slice(0, 6).map((row) => (
        <div key={row.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="truncate text-sm font-bold text-ink dark:text-white">{row.name || "unknown"}</p>
          <p className="text-sm font-black text-brand">{formatMetric(row[valueKey], valueType)}</p>
        </div>
      ))}
    </div>
  );
}

function InlineMetric({ label, value, type }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm font-bold text-muted dark:text-slate-400">{label}</p>
      <p className="text-sm font-black text-ink dark:text-white">{formatMetric(value, type)}</p>
    </div>
  );
}

function RecentEvents({ events }) {
  if (!events.length) return <Waiting copy="Accepted events will appear here as the collector receives them." />;
  return (
    <div className="max-h-[460px] overflow-y-auto pr-1">
      <div className="grid gap-3">
        {events.slice(0, 18).map((event) => (
          <div key={event.event_id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-ink dark:text-white">{event.event_name}</p>
              <p className="mt-1 truncate text-xs font-semibold text-muted dark:text-slate-500">
                {event.screen_name} / {event.journey_stage} / {event.source_url}
              </p>
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-brand dark:bg-blue-950">{event.status}</span>
              <span className="text-xs font-bold text-muted dark:text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-black uppercase text-muted dark:text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-ink dark:text-white">{value}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center dark:border-slate-800 dark:bg-slate-950">
      <div>
        <BarChart3 className="mx-auto text-slate-400" size={26} />
        <p className="mt-3 text-sm font-black text-ink dark:text-white">Waiting for trend data</p>
        <p className="mt-1 text-sm font-semibold text-muted dark:text-slate-500">Charts populate from real first-party events.</p>
      </div>
    </div>
  );
}

function Waiting({ copy = "Waiting for matching first-party events." }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm font-semibold text-muted dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
      {copy}
    </div>
  );
}

function journeyStages(summary) {
  const fromApi = summary?.journey?.funnel;
  if (Array.isArray(fromApi) && fromApi.length) return fromApi;
  const journey = summary?.journey || {};
  return [
    { name: "Kiosk Opened", count: summary?.executive?.totalKioskOpens || 0 },
    { name: "Mobile Registered/Login", count: summary?.users?.newUserRegistrations || summary?.users?.otpLoginCount || 0 },
    { name: "Product Scanned", count: summary?.products?.mostScannedProducts?.reduce((sum, row) => sum + (Number(row.count) || 0), 0) || 0 },
    { name: "Product Added to Cart", count: journey.addToCart || 0 },
    { name: "Payment Initiated", count: journey.paymentAttempted || 0 },
    { name: "Payment Success", count: journey.paymentSuccess || 0 },
    { name: "Order Completed", count: journey.orderCompleted || summary?.executive?.totalOrders || 0 }
  ];
}

function paymentStages(summary) {
  const journey = summary?.journey || {};
  return [
    { name: "Checkout Started", count: journey.checkoutStarted || 0 },
    { name: "Payment Initiated", count: journey.paymentAttempted || 0 },
    { name: "Payment Success", count: journey.paymentSuccess || 0 }
  ];
}

function orderStages(summary) {
  const journey = summary?.journey || {};
  const oms = summary?.oms || {};
  const executive = summary?.executive || {};
  const rows = [
    { name: "Cart Created", count: journey.totalCartsCreated || journey.addToCart || 0 },
    { name: "Checkout Started", count: journey.checkoutStarted || 0 },
    { name: "Payment Initiated", count: journey.paymentAttempted || 0 },
    { name: "Payment Success", count: journey.paymentSuccess || 0 },
    { name: "Order Completed", count: journey.orderCompleted || executive.totalOrders || 0 },
    { name: "OMS Confirmed", count: oms.confirmCtaClicks || 0 },
    { name: "Packed", count: oms.packCtaClicks || 0 }
  ];

  return rows.map((row, index) => ({
    ...row,
    dropOffRate: index === 0 ? null : dropOffRate(rows[index - 1]?.count, row.count)
  }));
}

function dropOffRate(previous, current) {
  const previousCount = Number(previous) || 0;
  const currentCount = Number(current) || 0;
  if (!previousCount) return null;
  return (Math.max(0, previousCount - currentCount) / previousCount) * 100;
}

function firstRowValue(rows = [], key) {
  const row = Array.isArray(rows) ? rows.find((item) => Number.isFinite(Number(item?.[key]))) : null;
  return row ? row[key] : null;
}

function severityFor(drop) {
  const value = Number(drop);
  if (!Number.isFinite(value)) return "Unknown";
  if (value >= 18) return "High";
  if (value >= 8) return "Medium";
  return "Low";
}

function SeverityBadge({ severity }) {
  const classes = {
    High: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
    Medium: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
    Low: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    Unknown: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${classes[severity] || classes.Unknown}`}>
      {severity}
    </span>
  );
}

function actionForStage(stage) {
  const name = String(stage).toLowerCase();
  if (name.includes("login")) return "Prompt assisted login and review OTP friction.";
  if (name.includes("scanned")) return "Improve scanner guidance and catalog match rate.";
  if (name.includes("cart")) return "Monitor cart clarity, item availability, and value cues.";
  if (name.includes("payment initiated")) return "Review checkout CTA placement and payment readiness.";
  if (name.includes("payment success")) return "Investigate UPI, QR, and network payment failures.";
  if (name.includes("order")) return "Audit OMS order creation and confirmation flow.";
  return "Review event quality and customer touchpoint context.";
}

function formatMetric(value, type = "number") {
  if (value === null || value === undefined || value === "") return "--";
  if (type === "currency") return formatCurrency(value);
  if (type === "percent") return formatPercent(value);
  if (type === "duration") return formatDurationMs(value);
  if (type === "text") return String(value);
  return formatNumber(value);
}
