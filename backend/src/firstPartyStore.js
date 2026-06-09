import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

const BLOCKED_FIELDS = new Set([
  "mobile",
  "mobileNo",
  "phone",
  "phone_number",
  "customer_mobile",
  "otp",
  "password",
  "email",
  "token",
  "authorization",
  "auth_token",
  "access_token",
  "refresh_token",
  "cart_id",
  "order_id",
  "transaction_id",
  "payment_id",
  "payment_transaction_id",
  "raw_cart_id",
  "raw_order_id",
  "raw_transaction_id",
  "raw_payment_id"
]);

const FILTER_ALIASES = {
  brand: ["brand_id", "brand_name"],
  brand_id: ["brand_id", "brand_name"],
  store: ["store_id", "store_name"],
  store_id: ["store_id", "store_name"],
  city: ["city"],
  region: ["region"],
  company_id: ["company_id"],
  kiosk_id: ["kiosk_id", "device_id"],
  session_id: ["session_id"],
  order_id: ["order_id_hash"],
  order_id_hash: ["order_id_hash"],
  cart_id: ["cart_id_hash"],
  cart_id_hash: ["cart_id_hash"],
  source_url: ["source_url", "stream_url"],
  source: ["source_url", "stream_url"],
  user_id: ["user_id_hash", "customer_id_hash", "anonymous_id"],
  user_id_hash: ["user_id_hash", "customer_id_hash", "anonymous_id"],
  app_id: ["application_id", "app_id"],
  application_id: ["application_id", "app_id"]
};

const subscribers = new Set();
const state = {
  loaded: false,
  loadPromise: null,
  events: [],
  eventIds: new Set()
};

function storePath() {
  return path.resolve(process.cwd(), config.firstParty.storageDir, "events.jsonl");
}

async function ensureLoaded() {
  if (state.loaded) return;
  if (state.loadPromise) return state.loadPromise;
  state.loadPromise = loadEvents();
  await state.loadPromise;
}

async function loadEvents() {
  await mkdir(path.dirname(storePath()), { recursive: true });
  try {
    const content = await readFile(storePath(), "utf8");
    state.events = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    state.eventIds = new Set(state.events.map((event) => event.event_id).filter(Boolean));
  } catch {
    await writeFile(storePath(), "", { flag: "a" });
  }
  state.loaded = true;
  state.loadPromise = null;
}

function eventId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  eventId.sequence = (eventId.sequence || 0) + 1;
  return `ff_evt_${Date.now()}_${eventId.sequence}`;
}

function stripBlockedFields(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripBlockedFields);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !BLOCKED_FIELDS.has(key))
      .map(([key, entry]) => [key, stripBlockedFields(entry)])
  );
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  );
}

function normalizeEvent(payload = {}, req) {
  const clean = stripBlockedFields(payload);
  const eventName = clean.event_name || clean.event;
  if (!eventName) {
    const error = new Error("event_name or event is required");
    error.statusCode = 400;
    error.code = "FIRST_PARTY_EVENT_NAME_REQUIRED";
    throw error;
  }

  const timestamp = clean.timestamp || clean.occurred_at || new Date().toISOString();
  return compact({
    event_id: clean.event_id || eventId(),
    event_name: eventName,
    event_type: clean.event_type || "custom",
    timestamp,
    occurred_at: clean.occurred_at || timestamp,
    session_id: clean.session_id || "unknown",
    anonymous_id: clean.anonymous_id,
    user_id_hash: clean.user_id_hash,
    customer_id_hash: clean.customer_id_hash,
    user_type: clean.user_type,
    login_method: clean.login_method,
    screen_name: clean.screen_name || "unknown",
    action_name: clean.action_name,
    journey_stage: clean.journey_stage || "unknown",
    status: clean.status || "observed",
    source_url: clean.source_url || config.firstParty.sourceUrl,
    stream_url: clean.stream_url || config.source.streamUrl,
    _ds: clean._ds || clean.ds || config.source.dataSource,
    property_id: clean.property_id || config.source.propertyId,
    measurement_id: clean.measurement_id || config.source.measurementId,
    stream_id: clean.stream_id || config.source.streamId,
    company_id: clean.company_id,
    application_id: clean.application_id || clean.app_id,
    app_id: clean.app_id || clean.application_id,
    store_id: clean.store_id,
    store_name: clean.store_name,
    city: clean.city,
    region: clean.region,
    kiosk_id: clean.kiosk_id,
    device_id: clean.device_id,
    device_session_id: clean.device_session_id,
    device_status: clean.device_status,
    network_status: clean.network_status,
    app_version: clean.app_version,
    brand_id: clean.brand_id,
    brand_name: clean.brand_name,
    product_id: clean.product_id,
    sku: clean.sku,
    article: clean.article,
    barcode: clean.barcode,
    quantity: clean.quantity,
    item_count: clean.item_count,
    amount: clean.amount,
    currency: clean.currency || config.source.currency,
    transaction_id_hash: clean.transaction_id_hash,
    payment_session_id_hash: clean.payment_session_id_hash,
    payment_mode: clean.payment_mode,
    failure_reason: clean.failure_reason,
    cart_id_hash: clean.cart_id_hash,
    order_id_hash: clean.order_id_hash,
    api_endpoint_template: clean.api_endpoint_template,
    api_status: clean.api_status,
    api_latency_ms: clean.api_latency_ms,
    incremental_lift_rate: clean.incremental_lift_rate,
    oms_status: clean.oms_status,
    user_agent: clean.user_agent || req?.get?.("user-agent"),
    ip_hash: clean.ip_hash,
    metadata: clean.metadata
  });
}

function broadcast(event) {
  for (const subscriber of subscribers) {
    const body = {
      event,
      summary: summarizeFirstPartyEventsSync(applyFilters(state.events, subscriber.filters), subscriber.filters)
    };
    subscriber.res.write(`event: first-party-event\ndata: ${JSON.stringify(body)}\n\n`);
  }
}

export async function ingestFirstPartyEvent(payload, req) {
  await ensureLoaded();
  const event = normalizeEvent(payload, req);
  if (state.eventIds.has(event.event_id)) {
    return { accepted: true, duplicate: true, event };
  }
  state.events.push(event);
  state.eventIds.add(event.event_id);
  await writeFile(storePath(), `${JSON.stringify(event)}\n`, { flag: "a" });
  broadcast(event);
  return { accepted: true, duplicate: false, event };
}

export async function firstPartySummary(filters = {}) {
  await ensureLoaded();
  return summarizeFirstPartyEventsSync(applyFilters(state.events, filters), filters);
}

export async function firstPartyExport(filters = {}) {
  await ensureLoaded();
  return {
    generatedAt: new Date().toISOString(),
    filters: normalizeFilters(filters),
    rows: applyFilters(state.events, filters)
  };
}

export async function firstPartyStatus(filters = {}) {
  await ensureLoaded();
  const filtered = applyFilters(state.events, filters);
  const lastEvent = filtered.at(-1) || null;
  return {
    ok: true,
    mode: "first-party",
    generatedAt: new Date().toISOString(),
    storage: {
      type: "append-only-jsonl",
      path: storePath(),
      durable: true
    },
    realtime: {
      transport: "sse",
      connectedClients: subscribers.size
    },
    ingestion: {
      primary: "/api/first-party/events",
      webhook: "/api/webhooks/fashionfactory",
      compatibility: "/api/analytics/kiosk-events"
    },
    totals: {
      events: filtered.length,
      sessions: unique(filtered, "session_id", { skipUnknown: true }).size,
      lastEventAt: lastEvent?.timestamp || null,
      lastEventName: lastEvent?.event_name || null
    }
  };
}

export function subscribeFirstPartyStream(res, filters = {}) {
  const subscriber = { res, filters: normalizeFilters(filters) };
  subscribers.add(subscriber);
  res.on("close", () => subscribers.delete(subscriber));
  res.write(`event: connected\ndata: ${JSON.stringify({
    summary: summarizeFirstPartyEventsSync(applyFilters(state.events, subscriber.filters), subscriber.filters)
  })}\n\n`);
}

function normalizeFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function applyFilters(events, filters = {}) {
  const normalized = normalizeFilters(filters);
  const startMs = normalized.startDate ? new Date(`${normalized.startDate}T00:00:00.000`).getTime() : null;
  const endMs = normalized.endDate ? new Date(`${normalized.endDate}T23:59:59.999`).getTime() : null;
  return events.filter((event) => {
    const time = new Date(event.timestamp).getTime();
    if (startMs && time < startMs) return false;
    if (endMs && time > endMs) return false;

    return Object.entries(normalized).every(([key, value]) => {
      if (key === "startDate" || key === "endDate") return true;
      const aliases = FILTER_ALIASES[key] || [key];
      const expected = String(value).toLowerCase();
      return aliases.some((field) => String(event[field] || "").toLowerCase() === expected);
    });
  });
}

function summarizeFirstPartyEventsSync(events, filters = {}) {
  const now = Date.now();
  const last30m = events.filter((event) => now - toMs(event.timestamp) <= 30 * 60 * 1000);
  const last5m = events.filter((event) => now - toMs(event.timestamp) <= 5 * 60 * 1000);
  const sessions = unique(events, "session_id", { skipUnknown: true });
  const activeSessions = unique(last30m, "session_id", { skipUnknown: true });
  const orderEvents = events.filter(isOrderCompleted);
  const paymentInitiated = events.filter(isPaymentInitiated);
  const paymentSuccess = events.filter(isPaymentSuccess);
  const paymentFailed = events.filter(isPaymentFailure);
  const paymentDeclined = events.filter(isPaymentDeclined);
  const paymentTimeout = events.filter(isPaymentTimeout);
  const paymentRetries = events.filter(isPaymentRetry);
  const cartEvents = events.filter(isCartEvent);
  const cartsCreated = events.filter(isCartCreated);
  const cartAdds = events.filter(isCartAdd);
  const cartRemove = events.filter(isCartRemove);
  const quantityChanges = events.filter(isQuantityChange);
  const kioskOpenEvents = events.filter(isKioskOpen);
  const registrationEvents = events.filter(isRegistrationSuccess);
  const newUserEvents = events.filter(isNewUser);
  const returningUserEvents = events.filter(isReturningUser);
  const loginEvents = events.filter(isLogin);
  const qrLogins = loginEvents.filter((event) => hasAny(event, ["qr"]));
  const otpLogins = events.filter((event) => hasAny(event, ["otp"]));
  const otpSuccess = otpLogins.filter((event) => isSuccessStatus(event));
  const otpFailure = otpLogins.filter((event) => isFailureStatus(event));
  const scanEvents = events.filter(isProductScan);
  const scanSuccess = scanEvents.filter((event) => isSuccessStatus(event) || hasAny(event, ["scan_success", "item_resolved"]));
  const scanFailure = scanEvents.filter((event) => isFailureStatus(event) || hasAny(event, ["scan_failure", "not_found"]));
  const productNotFound = events.filter(isProductNotFound);
  const manualBarcode = events.filter((event) => hasAny(event, ["manual_barcode", "manual barcode", "barcode_entry"]));
  const duplicateItems = events.filter((event) => hasAny(event, ["duplicate_item", "duplicate item"]));
  const supportEvents = events.filter(isSupportEvent);
  const retryEvents = events.filter(isRetryEvent);
  const errorEvents = events.filter(isErrorEvent);
  const deviceEvents = events.filter(isDeviceHealthEvent);

  const totalOrders = countDistinctOrEvents(orderEvents, ["order_id_hash"]);
  const revenue = sumRevenue(events);
  const totalUsers = countDistinctValues(events, ["user_id_hash", "customer_id_hash"]);
  const cartSessions = sessionSet(cartEvents);
  const orderSessions = sessionSet(orderEvents);
  const abandonedCartSessions = [...cartSessions].filter((sessionId) => !orderSessions.has(sessionId)).length;
  const totalCarts = countDistinctOrEvents(cartsCreated.length ? cartsCreated : cartEvents, ["cart_id_hash"]);

  return {
    dataSource: "First-party analytics layer",
    generatedAt: new Date().toISOString(),
    filters: normalizeFilters(filters),
    deployment: config.deployment,
    totalEvents: events.length,
    totalSessions: sessions.size,
    activeSessions30m: activeSessions.size,
    eventsLast30m: last30m.length,
    eventsLast5m: last5m.length,
    revenue,
    lastEventAt: events.at(-1)?.timestamp || null,
    eventBreakdown: topCounts(events, (event) => event.event_name),
    stageBreakdown: topCounts(events, (event) => event.journey_stage),
    recentEvents: events.slice(-12).reverse(),
    executive: {
      totalKioskOpens: kioskOpenEvents.length,
      totalUsers,
      newRegisteredUsers: countDistinctOrEvents(newUserEvents.length ? newUserEvents : registrationEvents, ["user_id_hash", "customer_id_hash"]),
      returningUsers: countDistinctOrEvents(returningUserEvents, ["user_id_hash", "customer_id_hash"]),
      totalOrders,
      totalRevenue: revenue,
      totalRevenue30d: sumRevenue(events.filter((event) => toMs(event.timestamp) >= Date.now() - 30 * 24 * 60 * 60 * 1000)),
      averageOrderValue: safeDivide(revenue, totalOrders),
      averageCartValue: averageAmount(cartEvents),
      revenuePerKiosk: safeDivide(revenue, config.deployment.kiosksInstalled),
      momOrderGrowthRate: momOrderGrowthRate(orderEvents),
      conversionRate: percent(totalOrders, sessions.size),
      cartAbandonmentRate: percent(abandonedCartSessions, cartSessions.size),
      paymentSuccessRate: percent(paymentSuccess.length, paymentInitiated.length || paymentSuccess.length + paymentFailed.length),
      paymentFailureRate: percent(paymentFailed.length, paymentInitiated.length || paymentSuccess.length + paymentFailed.length),
      incrementalLiftRate: explicitIncrementalLiftRate(events),
      networkUptimeRate: networkUptimeRate(deviceEvents),
      avgSessionDurationMs: averageJourneyDuration(events, isSessionStart, isSessionEnd),
      pilotStoresLive: config.deployment.pilotStoresLive,
      pilotStoresTotal: config.deployment.pilotStoresTotal,
      kiosksInstalled: config.deployment.kiosksInstalled
    },
    usage: {
      totalKioskOpens: kioskOpenEvents.length,
      dailyKioskOpens: countInWindow(kioskOpenEvents, 1),
      weeklyKioskOpens: countInWindow(kioskOpenEvents, 7),
      monthlyKioskOpens: countInWindow(kioskOpenEvents, 30),
      activeKiosks: latestDeviceCounts(events).active,
      kioskUsageByStore: groupPerformance(events, (event) => event.store_id || event.store_name || "unknown"),
      kioskUsageByBrand: groupPerformance(events, (event) => event.brand_id || event.brand_name || "unknown"),
      totalSessions: sessions.size,
      avgSessionDurationMs: averageJourneyDuration(events, isSessionStart, isSessionEnd),
      sessionTimeoutCount: events.filter(isSessionTimeout).length,
      sessionsCompleted: countDistinctOrEvents(events.filter(isJourneyCompleted), ["session_id"]),
      sessionsAbandoned: Math.max(0, sessions.size - countDistinctOrEvents(events.filter(isJourneyCompleted), ["session_id"]))
    },
    users: {
      totalRegisteredNumbers: countDistinctOrEvents(registrationEvents, ["user_id_hash", "customer_id_hash"]),
      newUserRegistrations: countDistinctOrEvents(newUserEvents.length ? newUserEvents : registrationEvents, ["user_id_hash", "customer_id_hash"]),
      dailyNewUsers: countInWindow(newUserEvents.length ? newUserEvents : registrationEvents, 1),
      weeklyNewUsers: countInWindow(newUserEvents.length ? newUserEvents : registrationEvents, 7),
      monthlyNewUsers: countInWindow(newUserEvents.length ? newUserEvents : registrationEvents, 30),
      returningUsers: countDistinctOrEvents(returningUserEvents, ["user_id_hash", "customer_id_hash"]),
      returningUserOrders: orderEvents.filter((event) => isReturningUser(event)).length,
      repeatPurchaseRate: repeatPurchaseRate(orderEvents),
      existingUserRevenue: sumRevenue(orderEvents.filter((event) => isReturningUser(event))),
      qrLoginCount: qrLogins.length,
      otpLoginCount: otpLogins.length,
      otpSuccessRate: percent(otpSuccess.length, otpLogins.length),
      otpFailureRate: percent(otpFailure.length, otpLogins.length)
    },
    journey: {
      funnel: buildJourneyFunnel(events),
      commerceFunnel: buildCommerceFunnel(events),
      cartAbandonmentRate: percent(abandonedCartSessions, cartSessions.size),
      checkoutConversionRate: percent(totalOrders, events.filter(isCheckoutStart).length),
      paymentConversionRate: percent(paymentSuccess.length, paymentInitiated.length),
      totalCartsCreated: totalCarts,
      averageCartValue: averageAmount(cartEvents),
      avgItemsPerCart: averageNumeric(cartEvents, "item_count") ?? averageNumeric(cartEvents, "quantity"),
      abandonedCarts: abandonedCartSessions,
      cartValueByBrand: groupAmount(cartEvents, (event) => event.brand_id || event.brand_name || "unknown"),
      cartValueByStore: groupAmount(cartEvents, (event) => event.store_id || event.store_name || "unknown"),
      cartToOrderAvgMs: averageJourneyDuration(events, isCartEvent, isOrderCompleted),
      plpToCartAvgMs: averageJourneyDuration(events, isProductDiscovery, isCartAdd),
      overallJourneyAvgMs: averageJourneyDuration(events, isSessionStart, isOrderCompleted),
      paymentCompletionAvgMs: averageJourneyDuration(events, isPaymentInitiated, isPaymentFinal),
      productViews: countDistinctOrEvents(events.filter(isProductDiscovery), ["session_id"]),
      addToCart: countDistinctOrEvents(events.filter(isCartAdd), ["session_id"]),
      checkoutStarted: countDistinctOrEvents(events.filter(isCheckoutStart), ["session_id"]),
      paymentAttempted: countDistinctOrEvents(events.filter(isPaymentInitiated), ["session_id"]),
      paymentSuccess: countDistinctOrEvents(events.filter(isPaymentSuccess), ["session_id"]),
      orderCompleted: countDistinctOrEvents(events.filter(isOrderCompleted), ["session_id"])
    },
    ordersRevenue: {
      dailyOrders: countInWindow(orderEvents, 1),
      weeklyOrders: countInWindow(orderEvents, 7),
      monthlyOrders: countInWindow(orderEvents, 30),
      ordersByStore: groupCounts(orderEvents, (event) => event.store_id || event.store_name || "unknown"),
      ordersByBrand: groupCounts(orderEvents, (event) => event.brand_id || event.brand_name || "unknown"),
      totalRevenue: revenue,
      revenueByStore: groupAmount(events, (event) => event.store_id || event.store_name || "unknown", isRevenueEvent),
      revenueTrend: dailyTrend(events, isRevenueEvent, (event) => Number(event.amount) || 0),
      averageOrderValue: safeDivide(revenue, totalOrders),
      revenuePerUser: safeDivide(revenue, totalUsers),
      revenuePerSession: safeDivide(revenue, sessions.size),
      revenuePerKiosk: safeDivide(revenue, config.deployment.kiosksInstalled),
      momOrderGrowthRate: momOrderGrowthRate(orderEvents)
    },
    payments: {
      totalTransactions: countDistinctOrEvents(events.filter(isPaymentEvent), ["payment_session_id_hash", "transaction_id_hash"]),
      paymentSuccessRate: percent(paymentSuccess.length, paymentInitiated.length || paymentSuccess.length + paymentFailed.length),
      paymentFailureRate: percent(paymentFailed.length, paymentInitiated.length || paymentSuccess.length + paymentFailed.length),
      paymentDeclinedByCustomer: paymentDeclined.length,
      paymentRetryCount: paymentRetries.length,
      paymentTimeoutCount: paymentTimeout.length,
      avgPaymentCompletionTimeMs: averageJourneyDuration(events, isPaymentInitiated, isPaymentFinal),
      paymentModeDistribution: groupCounts(events.filter(isPaymentEvent), (event) => event.payment_mode || "unknown"),
      successVsFailureTrend: successFailureTrend(events),
      failureReasons: groupCounts(paymentFailed, (event) => event.failure_reason || "unknown"),
      funnel: buildPaymentFunnel(events)
    },
    brands: {
      topOrderedBrands: groupCounts(orderEvents, (event) => event.brand_id || event.brand_name || "unknown"),
      brandWiseRevenue: groupAmount(events, (event) => event.brand_id || event.brand_name || "unknown", isRevenueEvent),
      brandWiseOrders: groupCounts(orderEvents, (event) => event.brand_id || event.brand_name || "unknown"),
      brandConversion: brandConversion(events),
      brandCartAbandonment: brandCartAbandonment(events),
      avgOrderValueByBrand: avgOrderValueByGroup(orderEvents, (event) => event.brand_id || event.brand_name || "unknown")
    },
    oms: {
      confirmCtaClicks: events.filter(isConfirmCta).length,
      packCtaClicks: events.filter(isPackCta).length,
      returnCtaClicks: events.filter(isReturnCta).length,
      cancelCtaClicks: events.filter(isCancelCta).length,
      companiesClickingConfirmCta: unique(events.filter(isConfirmCta), "company_id", { skipUnknown: true }).size,
      companiesClickingReturnCta: unique(events.filter(isReturnCta), "company_id", { skipUnknown: true }).size,
      avgPlaceToConfirmTimeMs: averageJourneyDuration(events, isOrderCompleted, isConfirmCta),
      cancellationPatterns: groupCounts(events.filter(isCancelCta), (event) => event.failure_reason || event.oms_status || "unknown")
    },
    products: {
      mostScannedProducts: groupCounts(scanEvents, productLabel),
      mostPurchasedProducts: groupCounts(orderEvents, productLabel),
      productNotFoundCount: productNotFound.length,
      manualBarcodeEntryCount: manualBarcode.length,
      duplicateItemCount: duplicateItems.length,
      quantityModificationCount: quantityChanges.length,
      productConversion: productConversion(events),
      productReturnRate: productReturnRate(events),
      productAbandonmentRate: productAbandonmentRate(events)
    },
    errors: {
      otpFailures: otpFailure.length,
      paymentFailures: paymentFailed.length,
      scannerErrors: scanFailure.length,
      networkErrors: events.filter((event) => hasAny(event, ["network_error", "network error", "offline"])).length,
      productNotFoundErrors: productNotFound.length,
      appCrashes: events.filter((event) => hasAny(event, ["app_crash", "crash"])).length,
      sessionTimeoutErrors: events.filter(isSessionTimeout).length,
      supportModuleClicks: supportEvents.length,
      retryButtonClicks: retryEvents.length,
      offlineRetryClicks: retryEvents.filter((event) => hasAny(event, ["offline"])).length,
      paymentRetryClicks: paymentRetries.length,
      errorCategories: groupCounts(errorEvents, (event) => event.failure_reason || event.event_name || "unknown")
    },
    devices: {
      activeKiosks: latestDeviceCounts(events).active,
      offlineKiosks: latestDeviceCounts(events).offline,
      deviceUptimeRate: deviceUptimeRate(deviceEvents),
      networkUptimeRate: networkUptimeRate(deviceEvents),
      internetConnectivityStatus: latestDeviceCounts(events).networkStatus,
      kioskHealthStatus: latestDeviceCounts(events).healthStatus,
      appVersionDistribution: groupCounts(events.filter((event) => event.app_version), (event) => event.app_version),
      storeWiseOrders: groupCounts(orderEvents, (event) => event.store_id || event.store_name || "unknown"),
      storeWiseRevenue: groupAmount(events, (event) => event.store_id || event.store_name || "unknown", isRevenueEvent),
      storeWiseConversion: storeConversion(events),
      storeWiseReturnRate: storeReturnRate(events)
    },
    trends: {
      daily: dailyPerformanceTrend(events),
      userGrowth: dailyTrend(newUserEvents.length ? newUserEvents : registrationEvents),
      revenue: dailyTrend(events, isRevenueEvent, (event) => Number(event.amount) || 0),
      paymentOutcomes: successFailureTrend(events),
      timeComparison: periodComparison(events)
    }
  };
}

function toMs(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function eventText(event) {
  return [
    event.event_name,
    event.event_type,
    event.action_name,
    event.journey_stage,
    event.screen_name,
    event.status,
    event.failure_reason,
    event.oms_status,
    event.device_status,
    event.network_status,
    event.api_endpoint_template
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasAny(event, needles) {
  const text = eventText(event);
  return needles.some((needle) => text.includes(String(needle).toLowerCase()));
}

function isSuccessStatus(event) {
  return hasAny(event, ["success", "completed", "created", "confirmed", "viewed", "started"]);
}

function isFailureStatus(event) {
  return hasAny(event, ["failure", "failed", "error", "timeout", "cancel", "declined", "not_found"]);
}

function isKioskOpen(event) {
  return hasAny(event, ["session_start", "kiosk_open", "kiosk_opened", "app_open", "welcome_screen_view"]);
}

function isSessionStart(event) {
  return hasAny(event, ["session_start", "kiosk_open", "app_open"]);
}

function isSessionEnd(event) {
  return hasAny(event, ["session_end", "journey_completion", "journey_completed", "order_completed", "order_created"]);
}

function isJourneyCompleted(event) {
  return hasAny(event, ["journey_completion", "journey_completed", "order_completed", "order_created"]);
}

function isSessionTimeout(event) {
  return hasAny(event, ["session_timeout", "session timeout"]);
}

function isRegistrationSuccess(event) {
  return hasAny(event, ["registration_success", "user_registered", "mobile_registered", "signup_success"]);
}

function isNewUser(event) {
  return event.user_type === "new" || hasAny(event, ["new_user", "registration_success", "user_registered"]);
}

function isReturningUser(event) {
  return event.user_type === "returning" || hasAny(event, ["returning_user", "existing_user", "repeat_user"]);
}

function isLogin(event) {
  return hasAny(event, ["login", "otp", "qr_login", "mobile_registered"]);
}

function isProductScan(event) {
  return hasAny(event, ["scan", "barcode", "item_resolved", "product_scanned"]);
}

function isProductDiscovery(event) {
  return hasAny(event, ["plp", "product_list", "product_view", "product_scanned", "scan_success", "item_resolved", "cart/additems", "catalog"]);
}

function isProductNotFound(event) {
  return hasAny(event, ["product_not_found", "item_resolved_failure", "not_found"]);
}

function isCartEvent(event) {
  return hasAny(event, ["cart"]);
}

function isCartCreated(event) {
  return hasAny(event, ["cart_created", "create_cart"]);
}

function isCartAdd(event) {
  return hasAny(event, ["cart_add", "add_to_cart", "added_to_cart", "cart_add_success", "cart/additems", "additems"]);
}

function isCartRemove(event) {
  return hasAny(event, ["cart_remove", "remove_item", "removed_from_cart"]);
}

function isQuantityChange(event) {
  return hasAny(event, ["quantity_change", "quantity_update", "qty_change"]);
}

function isCheckoutStart(event) {
  return hasAny(event, ["checkout_start", "checkout_started", "proceed to checkout", "cart/payment"]);
}

function isPaymentEvent(event) {
  return hasAny(event, ["payment"]);
}

function isPaymentInitiated(event) {
  return hasAny(event, ["payment_initiated", "payment_initiation", "payment_start", "payment_started", "jio partner pay"]);
}

function isPaymentSuccess(event) {
  return hasAny(event, ["payment_success", "payment_completed", "payment_captured"]);
}

function isPaymentFailure(event) {
  return hasAny(event, ["payment_failure", "payment_failed", "payment_timeout", "payment_cancel", "payment_declined", "bank_failure"]);
}

function isPaymentDeclined(event) {
  return hasAny(event, ["declined", "user_cancelled", "customer_cancelled", "cancel"]);
}

function isPaymentTimeout(event) {
  return hasAny(event, ["payment_timeout", "upi_timeout", "qr_expired", "timeout"]);
}

function isPaymentRetry(event) {
  return hasAny(event, ["payment_retry", "retry_payment"]);
}

function isPaymentFinal(event) {
  return isPaymentSuccess(event) || isPaymentFailure(event);
}

function isOrderCompleted(event) {
  return hasAny(event, ["order_completed", "order_created", "order_success", "order_placed"]);
}

function isRevenueEvent(event) {
  return Number(event.amount) > 0 && (isOrderCompleted(event) || isPaymentSuccess(event) || hasAny(event, ["revenue", "purchase"]));
}

function isConfirmCta(event) {
  return hasAny(event, ["confirm_cta", "confirm clicked", "order_confirm"]);
}

function isPackCta(event) {
  return hasAny(event, ["pack_cta", "pack clicked", "order_pack"]);
}

function isReturnCta(event) {
  return hasAny(event, ["return_cta", "return clicked", "order_return"]);
}

function isCancelCta(event) {
  return hasAny(event, ["cancel_cta", "cancel clicked", "order_cancel", "cancel_order"]);
}

function isSupportEvent(event) {
  return hasAny(event, ["support", "help"]);
}

function isRetryEvent(event) {
  return hasAny(event, ["retry"]);
}

function isErrorEvent(event) {
  return isFailureStatus(event) || hasAny(event, ["error", "crash", "failure"]);
}

function isDeviceHealthEvent(event) {
  return hasAny(event, ["device_heartbeat", "device_health", "kiosk_health", "heartbeat", "network"]);
}

function countInWindow(events, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter((event) => toMs(event.timestamp) >= cutoff).length;
}

function unique(events, field, options = {}) {
  const values = new Set();
  events.forEach((event) => {
    const value = event[field];
    if (!value) return;
    if (options.skipUnknown && value === "unknown") return;
    values.add(value);
  });
  return values;
}

function countDistinctValues(events, fields) {
  const values = new Set();
  events.forEach((event) => {
    const value = fields.map((field) => event[field]).find(Boolean);
    if (value && value !== "unknown") values.add(value);
  });
  return values.size;
}

function countDistinctOrEvents(events, fields) {
  const distinct = countDistinctValues(events, fields);
  return distinct || events.length;
}

function sessionSet(events) {
  return unique(events, "session_id", { skipUnknown: true });
}

function percent(part, whole) {
  return whole ? (part / whole) * 100 : null;
}

function safeDivide(value, count) {
  return count ? value / count : null;
}

function averageAmount(events) {
  return average(events.map((event) => Number(event.amount)).filter((amount) => amount > 0));
}

function averageNumeric(events, field) {
  return average(events.map((event) => Number(event[field])).filter((value) => Number.isFinite(value) && value > 0));
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumRevenue(events) {
  const seen = new Set();
  return events.filter(isRevenueEvent).reduce((total, event) => {
    const key = event.order_id_hash || event.transaction_id_hash || event.payment_session_id_hash || event.event_id;
    if (seen.has(key)) return total;
    seen.add(key);
    return total + (Number(event.amount) || 0);
  }, 0);
}

function averageJourneyDuration(events, startPredicate, endPredicate) {
  const groups = groupBy(events, (event) => event.session_id || event.payment_session_id_hash || event.order_id_hash || "unknown");
  const durations = [];
  for (const groupEvents of groups.values()) {
    const sorted = [...groupEvents].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
    const start = sorted.find(startPredicate);
    if (!start) continue;
    const end = sorted.find((event) => toMs(event.timestamp) >= toMs(start.timestamp) && endPredicate(event));
    if (!end || end.event_id === start.event_id) continue;
    const duration = toMs(end.timestamp) - toMs(start.timestamp);
    if (duration >= 0) durations.push(duration);
  }
  return average(durations);
}

function groupBy(events, keyFn) {
  const groups = new Map();
  events.forEach((event) => {
    const key = keyFn(event) || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });
  return groups;
}

function groupCounts(events, keyFn, limit = 8) {
  return topCounts(events, keyFn, limit).filter((row) => row.name !== "unknown" || events.length);
}

function topCounts(events, keyFn, limit = 10) {
  const counts = new Map();
  events.forEach((event) => {
    const value = keyFn(event) || "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function groupAmount(events, keyFn, predicate = () => true, limit = 8) {
  const groups = new Map();
  events.filter(predicate).forEach((event) => {
    const key = keyFn(event) || "unknown";
    groups.set(key, (groups.get(key) || 0) + (Number(event.amount) || 0));
  });
  return [...groups.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function groupPerformance(events, keyFn) {
  const groups = groupBy(events, keyFn);
  return [...groups.entries()]
    .map(([name, groupEvents]) => {
      const orders = groupEvents.filter(isOrderCompleted);
      const sessions = sessionSet(groupEvents).size;
      return {
        name,
        opens: groupEvents.filter(isKioskOpen).length,
        sessions,
        orders: countDistinctOrEvents(orders, ["order_id_hash"]),
        revenue: sumRevenue(groupEvents),
        conversionRate: percent(countDistinctOrEvents(orders, ["order_id_hash"]), sessions)
      };
    })
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 8);
}

function dailyKey(event) {
  return new Date(event.timestamp).toISOString().slice(0, 10);
}

function dailyTrend(events, predicate = () => true, valueFn = () => 1) {
  const buckets = new Map();
  events.filter(predicate).forEach((event) => {
    const key = dailyKey(event);
    buckets.set(key, (buckets.get(key) || 0) + valueFn(event));
  });
  return [...buckets.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function dailyPerformanceTrend(events) {
  const groups = groupBy(events, dailyKey);
  return [...groups.entries()]
    .map(([date, groupEvents]) => ({
      date,
      kioskOpens: groupEvents.filter(isKioskOpen).length,
      sessions: sessionSet(groupEvents).size,
      orders: countDistinctOrEvents(groupEvents.filter(isOrderCompleted), ["order_id_hash"]),
      revenue: sumRevenue(groupEvents)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildJourneyFunnel(events) {
  const stages = [
    ["Kiosk Opened", isKioskOpen],
    ["Mobile Registered/Login", (event) => isRegistrationSuccess(event) || isLogin(event)],
    ["Product Scanned", isProductScan],
    ["Product Added to Cart", isCartAdd],
    ["Payment Initiated", isPaymentInitiated],
    ["Payment Success", isPaymentSuccess],
    ["Order Completed", isOrderCompleted]
  ];
  return stages.map(([name, predicate], index) => {
    const sessions = sessionSet(events.filter(predicate)).size || events.filter(predicate).length;
    const previous = index > 0 ? sessionSet(events.filter(stages[index - 1][1])).size || events.filter(stages[index - 1][1]).length : sessions;
    return {
      name,
      count: sessions,
      dropOffRate: index === 0 ? null : percent(Math.max(0, previous - sessions), previous)
    };
  });
}

function buildCommerceFunnel(events) {
  const stages = [
    ["Sessions", (event) => event.session_id && event.session_id !== "unknown"],
    ["Product Views", isProductDiscovery],
    ["Add to Cart", isCartAdd],
    ["Checkout Started", isCheckoutStart],
    ["Payment Attempted", isPaymentInitiated],
    ["Payment Success", isPaymentSuccess]
  ];
  return stages.map(([name, predicate], index) => {
    const matching = events.filter(predicate);
    const count = countDistinctOrEvents(matching, ["session_id"]);
    const previous = index > 0 ? countDistinctOrEvents(events.filter(stages[index - 1][1]), ["session_id"]) : count;
    return {
      name,
      count,
      conversionRate: index === 0 ? null : percent(count, previous),
      dropOffRate: index === 0 ? null : percent(Math.max(0, previous - count), previous)
    };
  });
}

function buildPaymentFunnel(events) {
  const initiated = events.filter(isPaymentInitiated).length;
  const success = events.filter(isPaymentSuccess).length;
  const failure = events.filter(isPaymentFailure).length;
  return [
    { name: "Payment Initiated", count: initiated },
    { name: "Payment Success", count: success, dropOffRate: percent(Math.max(0, initiated - success), initiated) },
    { name: "Payment Failure", count: failure }
  ];
}

function periodComparison(events) {
  const now = Date.now();
  const currentStart = now - 7 * 24 * 60 * 60 * 1000;
  const previousStart = now - 14 * 24 * 60 * 60 * 1000;
  const current = events.filter((event) => toMs(event.timestamp) >= currentStart);
  const previous = events.filter((event) => {
    const time = toMs(event.timestamp);
    return time >= previousStart && time < currentStart;
  });
  const currentOrders = countDistinctOrEvents(current.filter(isOrderCompleted), ["order_id_hash"]);
  const previousOrders = countDistinctOrEvents(previous.filter(isOrderCompleted), ["order_id_hash"]);
  const currentSessions = sessionSet(current).size;
  const previousSessions = sessionSet(previous).size;
  return {
    current7d: {
      events: current.length,
      sessions: currentSessions,
      orders: currentOrders,
      revenue: sumRevenue(current),
      conversionRate: percent(currentOrders, currentSessions)
    },
    previous7d: {
      events: previous.length,
      sessions: previousSessions,
      orders: previousOrders,
      revenue: sumRevenue(previous),
      conversionRate: percent(previousOrders, previousSessions)
    }
  };
}

function successFailureTrend(events) {
  const groups = groupBy(events.filter(isPaymentEvent), dailyKey);
  return [...groups.entries()]
    .map(([date, groupEvents]) => ({
      date,
      success: groupEvents.filter(isPaymentSuccess).length,
      failure: groupEvents.filter(isPaymentFailure).length
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function repeatPurchaseRate(orderEvents) {
  const userOrders = groupBy(orderEvents.filter((event) => event.user_id_hash || event.customer_id_hash), (event) => event.user_id_hash || event.customer_id_hash);
  if (!userOrders.size) return null;
  const repeatUsers = [...userOrders.values()].filter((events) => events.length > 1).length;
  return percent(repeatUsers, userOrders.size);
}

function brandConversion(events) {
  return conversionByGroup(events, (event) => event.brand_id || event.brand_name || "unknown");
}

function brandCartAbandonment(events) {
  return abandonmentByGroup(events, (event) => event.brand_id || event.brand_name || "unknown");
}

function storeConversion(events) {
  return conversionByGroup(events, (event) => event.store_id || event.store_name || "unknown");
}

function storeReturnRate(events) {
  return rateByGroup(events, (event) => event.store_id || event.store_name || "unknown", isReturnCta, isOrderCompleted);
}

function productConversion(events) {
  return conversionByGroup(events, productLabel);
}

function productReturnRate(events) {
  return rateByGroup(events, productLabel, isReturnCta, isOrderCompleted);
}

function productAbandonmentRate(events) {
  return abandonmentByGroup(events, productLabel);
}

function conversionByGroup(events, keyFn) {
  const groups = groupBy(events.filter((event) => keyFn(event) !== "unknown"), keyFn);
  return [...groups.entries()].map(([name, groupEvents]) => ({
    name,
    conversionRate: percent(countDistinctOrEvents(groupEvents.filter(isOrderCompleted), ["order_id_hash"]), sessionSet(groupEvents).size || groupEvents.length)
  })).sort((a, b) => (b.conversionRate || 0) - (a.conversionRate || 0)).slice(0, 8);
}

function abandonmentByGroup(events, keyFn) {
  const groups = groupBy(events.filter((event) => keyFn(event) !== "unknown"), keyFn);
  return [...groups.entries()].map(([name, groupEvents]) => {
    const carts = sessionSet(groupEvents.filter(isCartEvent));
    const orders = sessionSet(groupEvents.filter(isOrderCompleted));
    const abandoned = [...carts].filter((sessionId) => !orders.has(sessionId)).length;
    return { name, abandonmentRate: percent(abandoned, carts.size) };
  }).sort((a, b) => (b.abandonmentRate || 0) - (a.abandonmentRate || 0)).slice(0, 8);
}

function rateByGroup(events, keyFn, numeratorPredicate, denominatorPredicate) {
  const groups = groupBy(events.filter((event) => keyFn(event) !== "unknown"), keyFn);
  return [...groups.entries()].map(([name, groupEvents]) => ({
    name,
    rate: percent(groupEvents.filter(numeratorPredicate).length, groupEvents.filter(denominatorPredicate).length)
  })).sort((a, b) => (b.rate || 0) - (a.rate || 0)).slice(0, 8);
}

function avgOrderValueByGroup(orderEvents, keyFn) {
  const groups = groupBy(orderEvents.filter((event) => keyFn(event) !== "unknown"), keyFn);
  return [...groups.entries()].map(([name, groupEvents]) => ({
    name,
    amount: safeDivide(sumRevenue(groupEvents), countDistinctOrEvents(groupEvents, ["order_id_hash"]))
  })).sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 8);
}

function latestDeviceCounts(events) {
  const latest = new Map();
  events.filter((event) => event.kiosk_id || event.device_id || isDeviceHealthEvent(event)).forEach((event) => {
    const key = event.kiosk_id || event.device_id || event.session_id || "unknown";
    if (!latest.has(key) || toMs(event.timestamp) > toMs(latest.get(key).timestamp)) latest.set(key, event);
  });
  const rows = [...latest.values()];
  const active = rows.filter((event) => hasAny(event, ["online", "active", "healthy"]) || event.device_status === "online").length;
  const offline = rows.filter((event) => hasAny(event, ["offline", "inactive", "unhealthy"]) || event.device_status === "offline").length;
  return {
    active,
    offline,
    networkStatus: groupCounts(rows, (event) => event.network_status || "unknown"),
    healthStatus: groupCounts(rows, (event) => event.device_status || "unknown")
  };
}

function deviceUptimeRate(events) {
  if (!events.length) return null;
  const online = events.filter((event) => hasAny(event, ["online", "active", "healthy"])).length;
  return percent(online, events.length);
}

function networkUptimeRate(events) {
  const networkEvents = events.filter((event) => event.network_status || hasAny(event, ["network"]));
  if (!networkEvents.length) return null;
  const online = networkEvents.filter((event) => hasAny(event, ["online", "connected", "healthy"])).length;
  return percent(online, networkEvents.length);
}

function momOrderGrowthRate(orderEvents) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = previous.getMonth();
  const previousYear = previous.getFullYear();
  const currentCount = orderEvents.filter((event) => {
    const date = new Date(event.timestamp);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  }).length;
  const previousCount = orderEvents.filter((event) => {
    const date = new Date(event.timestamp);
    return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
  }).length;
  return previousCount ? ((currentCount - previousCount) / previousCount) * 100 : null;
}

function explicitIncrementalLiftRate(events) {
  const event = [...events].reverse().find((entry) => {
    const value = entry.incremental_lift_rate ?? entry.metadata?.incremental_lift_rate ?? entry.metadata?.incremental_lift;
    return Number.isFinite(Number(value));
  });
  if (!event) return null;
  return Number(event.incremental_lift_rate ?? event.metadata?.incremental_lift_rate ?? event.metadata?.incremental_lift);
}

function productLabel(event) {
  return event.product_id || event.sku || event.article || event.barcode || "unknown";
}
