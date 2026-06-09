/*
  First-party Kiosk Tag Manager runtime.

  This is a GA4/GTM-like dataLayer for the kiosk without using Google as the
  holistic collector. It listens to window.kioskDataLayer.push(...), enriches
  events with kiosk context, strips obvious raw PII fields, and forwards the
  normalized event to the first-party collector.
*/

(function kioskTagManagerFactory(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KioskTagManager = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createKioskTagManager(root = {}) {
  const DEFAULT_COLLECTOR_URL = "/analytics/kiosk-events";
  const SESSION_STORAGE_KEY = "kiosk_analytics_session_id";
  const BLOCKED_FIELDS = new Set([
    "mobile",
    "mobileNo",
    "phone",
    "otp",
    "raw_user_id",
    "raw_cart_id",
    "raw_order_id",
    "raw_transaction_id",
    "token",
    "authorization",
    "auth_token",
    "access_token",
    "refresh_token"
  ]);

  const EVENT_RULES = {
    session_start: ["session", "started", "bootstrap"],
    session_end: ["session", "closed", "completion"],
    welcome_screen_view: ["screen_view", "viewed", "welcome"],
    kiosk_app_bootstrap_started: ["system", "started", "bootstrap"],
    kiosk_config_loaded: ["api", "success", "bootstrap"],
    api_request_success: ["api", "success", "api"],
    api_request_failure: ["api", "failure", "api"],
    store_context_loaded: ["api", "success", "bootstrap"],
    device_context_missing: ["system", "failure", "bootstrap"],
    session_check_failed: ["api", "failure", "bootstrap"],
    tap_get_started: ["click", "clicked", "welcome"],
    mobile_entry_view: ["screen_view", "viewed", "auth"],
    journey_form_schema_failed: ["api", "failure", "auth"],
    mobile_number_keypad_input: ["input", "submitted", "auth"],
    mobile_number_submit: ["click", "submitted", "auth"],
    otp_send_success: ["api", "success", "auth"],
    otp_send_failure: ["api", "failure", "auth"],
    otp_resend: ["click", "clicked", "auth"],
    otp_verify_success: ["api", "success", "auth"],
    otp_verify_failure: ["api", "failure", "auth"],
    scan_home_view: ["screen_view", "viewed", "scan"],
    scan_start_clicked: ["click", "clicked", "scan"],
    manual_barcode_open: ["click", "clicked", "scan"],
    manual_barcode_submit: ["input", "submitted", "scan"],
    manual_barcode_validation_error: ["input", "failure", "scan"],
    scan_attempt: ["scan", "started", "scan"],
    scan_success: ["scan", "success", "scan"],
    scan_failure: ["scan", "failure", "scan"],
    item_resolved: ["api", "success", "scan"],
    item_resolved_failure: ["api", "failure", "scan"],
    product_not_found: ["api", "failure", "scan"],
    oos_scan: ["scan", "failure", "scan"],
    cart_add_started: ["cart", "started", "cart"],
    cart_add_success: ["cart", "success", "cart"],
    cart_add_failure: ["cart", "failure", "cart"],
    cart_user_updated: ["api", "success", "cart"],
    cart_view: ["screen_view", "viewed", "cart"],
    cart_quantity_changed: ["cart", "success", "cart"],
    cart_item_removed: ["cart", "success", "cart"],
    coupon_apply_clicked: ["click", "clicked", "cart"],
    coupon_applied: ["cart", "success", "cart"],
    coupon_removed: ["cart", "success", "cart"],
    packaging_options_loaded: ["api", "success", "cart"],
    voucher_options_loaded: ["api", "success", "cart"],
    support_click: ["click", "clicked", "support"],
    gst_invoice_toggle: ["click", "clicked", "cart"],
    checkout_start: ["checkout", "started", "checkout"],
    checkout_address_lookup: ["api", "success", "checkout"],
    payment_methods_view: ["screen_view", "viewed", "payment"],
    payment_options_loaded: ["api", "success", "payment"],
    payment_options_failed: ["api", "failure", "payment"],
    payment_aggregator_key_loaded: ["api", "success", "payment"],
    payment_method_selected: ["click", "clicked", "payment"],
    payment_init: ["payment", "started", "payment"],
    payment_success: ["payment", "success", "payment"],
    payment_failure: ["payment", "failure", "payment"],
    payment_timeout: ["payment", "timeout", "payment"],
    payment_cancelled: ["payment", "cancelled", "payment"],
    payment_retry_clicked: ["click", "clicked", "payment"],
    order_created: ["order", "success", "order"],
    order_creation_failed: ["order", "failure", "order"],
    order_complete: ["order", "success", "order"],
    order_status_view: ["screen_view", "viewed", "order"],
    journey_complete: ["session", "success", "completion"],
    session_timeout: ["session", "timeout", "completion"],
    app_crash: ["error", "failure", "ops"]
  };

  const state = {
    collectorUrl: DEFAULT_COLLECTOR_URL,
    sourceUrl: "",
    context: {},
    installed: false,
    autoClickTracking: true,
    autoSession: true,
    debug: false
  };

  function createEventId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    createEventId.sequence = (createEventId.sequence || 0) + 1;
    return `evt_${Date.now()}_${createEventId.sequence}`;
  }

  function getSessionId() {
    const storage = root.sessionStorage;
    if (!storage) return `ks_${Date.now()}`;
    const existing = storage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    getSessionId.sequence = (getSessionId.sequence || 0) + 1;
    const next = `ks_${Date.now()}_${getSessionId.sequence}`;
    storage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  }

  function stripBlockedFields(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(stripBlockedFields);
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !BLOCKED_FIELDS.has(key))
        .map(([key, entryValue]) => [key, stripBlockedFields(entryValue)])
    );
  }

  function currentSourceUrl() {
    if (state.sourceUrl) return state.sourceUrl;
    if (!root.location) return "unknown";
    return root.location.href || `${root.location.pathname || ""}${root.location.search || ""}` || "unknown";
  }

  function inferRule(eventName) {
    return EVENT_RULES[eventName] || ["system", "unknown", "unknown"];
  }

  function normalizeMessage(message = {}) {
    const clean = stripBlockedFields(message);
    const eventName = clean.event_name || clean.event;
    if (!eventName) {
      throw new Error("kioskDataLayer event is required");
    }

    const [eventType, status, journeyStage] = inferRule(eventName);
    const timestamp = clean.timestamp || clean.occurred_at || new Date().toISOString();
    const context = stripBlockedFields(state.context);
    const normalized = {
      event_id: clean.event_id || createEventId(),
      event_name: eventName,
      event_type: clean.event_type || eventType,
      occurred_at: clean.occurred_at || timestamp,
      timestamp,
      source: clean.source || "kiosk_frontend",
      session_id: clean.session_id || context.session_id || getSessionId(),
      screen_name: clean.screen_name || context.screen_name || "unknown",
      action_name: clean.action_name,
      journey_stage: clean.journey_stage || journeyStage,
      status: clean.status || status,
      source_url: clean.source_url || currentSourceUrl(),
      ...context,
      ...clean
    };

    delete normalized.event;
    return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined && value !== null && value !== ""));
  }

  async function sendEvent(event) {
    const body = JSON.stringify(event);
    if (root.navigator && typeof root.navigator.sendBeacon === "function") {
      const sent = root.navigator.sendBeacon(state.collectorUrl, body);
      if (sent) return { accepted: true, event_id: event.event_id, transport: "beacon" };
    }

    if (typeof root.fetch !== "function") {
      return { accepted: false, event_id: event.event_id, error: "fetch unavailable" };
    }

    const response = await root.fetch(state.collectorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body
    });
    const payload = await response.json().catch(() => ({}));
    return { ...payload, status: response.status };
  }

  function push(message) {
    const event = normalizeMessage(message);
    const result = sendEvent(event).catch((error) => {
      if (state.debug && root.console) root.console.warn("Kiosk analytics send failed", error);
      return { accepted: false, event_id: event.event_id, error: error.message };
    });
    return { event, result };
  }

  function patchDataLayer() {
    const dataLayer = root.kioskDataLayer = root.kioskDataLayer || [];
    const queued = dataLayer.slice();
    const nativePush = Array.prototype.push.bind(dataLayer);
    dataLayer.push = function patchedPush(...messages) {
      const length = nativePush(...messages);
      messages.forEach((message) => {
        if (message && typeof message === "object") push(message);
      });
      return length;
    };
    queued.forEach((message) => {
      if (message && typeof message === "object") push(message);
    });
  }

  function installClickTracking() {
    if (!root.document || !state.autoClickTracking) return;
    root.document.addEventListener("click", (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest("[data-kiosk-action], [data-kiosk-event]")
        : null;
      if (!target) return;
      const eventName = target.getAttribute("data-kiosk-event") || `${target.getAttribute("data-kiosk-action")}_clicked`;
      root.kioskDataLayer.push({
        event: eventName,
        event_type: "click",
        action_name: target.getAttribute("data-kiosk-action") || eventName,
        screen_name: target.getAttribute("data-kiosk-screen") || state.context.screen_name || "unknown",
        journey_stage: target.getAttribute("data-kiosk-stage") || undefined,
        status: "clicked",
        source_url: currentSourceUrl()
      });
    }, true);
  }

  function configure(options = {}) {
    if (options.collectorUrl) state.collectorUrl = options.collectorUrl;
    if (options.sourceUrl) state.sourceUrl = options.sourceUrl;
    if (options.context) state.context = { ...state.context, ...stripBlockedFields(options.context) };
    if (typeof options.autoClickTracking === "boolean") state.autoClickTracking = options.autoClickTracking;
    if (typeof options.autoSession === "boolean") state.autoSession = options.autoSession;
    if (typeof options.debug === "boolean") state.debug = options.debug;
    return { ...state, context: { ...state.context } };
  }

  function setContext(context = {}) {
    state.context = { ...state.context, ...stripBlockedFields(context) };
    return { ...state.context };
  }

  function trackScreenView(screenName, params = {}) {
    state.context.screen_name = screenName;
    return root.kioskDataLayer.push({
      event: params.event_name || `${screenName}_view`,
      event_type: "screen_view",
      screen_name: screenName,
      status: "viewed",
      ...params
    });
  }

  function trackApi(endpoint, response, params = {}) {
    const status = Number(response && response.status);
    const success = Number.isFinite(status) && status < 400;
    return root.kioskDataLayer.push({
      event: params.event_name || (success ? "api_request_success" : "api_request_failure"),
      event_type: "api",
      status: success ? "success" : "failure",
      api_endpoint: endpoint,
      api_endpoint_template: endpoint,
      api_status: Number.isFinite(status) ? status : undefined,
      api_duration_ms: params.api_duration_ms || params.api_latency_ms,
      api_latency_ms: params.api_latency_ms || params.api_duration_ms,
      source_url: endpoint,
      ...params
    });
  }

  function trackScannerEvent(eventName, params = {}) {
    return root.kioskDataLayer.push({
      event: eventName,
      source: "kiosk_frontend",
      screen_name: params.screen_name || state.context.screen_name || "scan_home",
      ...params
    });
  }

  function wrapFetch(fetchImpl = root.fetch) {
    if (typeof fetchImpl !== "function") return fetchImpl;
    return async function kioskAnalyticsFetch(input, init) {
      const started = Date.now();
      const endpoint = typeof input === "string" ? input : input && input.url;
      try {
        const response = await fetchImpl(input, init);
        const duration = Date.now() - started;
        trackApi(maskEndpoint(endpoint || "unknown"), response, {
          api_duration_ms: duration,
          api_latency_ms: duration,
          event_name: response.status >= 400 ? "api_request_failure" : "api_request_success"
        });
        return response;
      } catch (error) {
        const duration = Date.now() - started;
        root.kioskDataLayer.push({
          event: "api_request_failure",
          event_type: "api",
          status: "failure",
          api_endpoint: maskEndpoint(endpoint || "unknown"),
          api_endpoint_template: maskEndpoint(endpoint || "unknown"),
          api_duration_ms: duration,
          api_latency_ms: duration,
          failure_reason: error.message,
          source_url: maskEndpoint(endpoint || "unknown")
        });
        throw error;
      }
    };
  }

  function maskEndpoint(endpoint) {
    return String(endpoint)
      .replace(/([?&](?:mobileNo|userId|user_id|cart_id|order_id|token|authorization)=)[^&]+/gi, "$1{masked}")
      .replace(/\/orders\/[^/?]+/gi, "/orders/{order_id}")
      .replace(/\/payment-orders\/[^/?]+/gi, "/payment-orders/{payment_order_id}")
      .replace(/\/cart\/[^/?]+/gi, "/cart/{cart_id}")
      .replace(/id=[^&]+/gi, "id={masked}");
  }

  function install(options = {}) {
    configure(options);
    if (state.installed) return api;
    patchDataLayer();
    installClickTracking();
    state.installed = true;
    if (state.autoSession) {
      root.kioskDataLayer.push({
        event: "session_start",
        event_type: "session",
        screen_name: state.context.screen_name || "unknown",
        status: "started",
        source_url: currentSourceUrl()
      });
      if (root.addEventListener) {
        root.addEventListener("pagehide", () => {
          root.kioskDataLayer.push({
            event: "session_end",
            event_type: "session",
            screen_name: state.context.screen_name || "unknown",
            status: "closed",
            source_url: currentSourceUrl()
          });
        });
      }
    }
    return api;
  }

  const api = {
    configure,
    install,
    normalizeMessage,
    push,
    setContext,
    trackApi,
    trackScannerEvent,
    trackScreenView,
    wrapFetch,
    maskEndpoint,
    _rules: EVENT_RULES,
    _blockedFields: BLOCKED_FIELDS
  };

  if (root.window === root) {
    root.KioskTagManager = api;
  }

  return api;
});
