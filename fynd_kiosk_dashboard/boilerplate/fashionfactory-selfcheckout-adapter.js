/*
  FashionFactory self-checkout analytics adapter.

  Load this in the self-checkout app entrypoint before the app renders, then
  load kiosk-data-layer-plugin.js. It makes the FashionFactory kiosk URL the
  canonical source and exposes small helpers for React/React Native handlers,
  scanner bridges, API wrappers, and payment/order callbacks.
*/

(function fashionFactorySelfCheckoutAdapter(root) {
  const SOURCE_URL = "https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790";
  const DEFAULT_CONTEXT = {
    company_id: "59",
    application_id: "688a0fc42f61c5197c8bbfc5",
    store_id: "2790",
    data_source_id: "2790",
    source_url: SOURCE_URL
  };

  function readMeta(name) {
    const element = root.document && root.document.querySelector(`meta[name="${name}"]`);
    return element && element.getAttribute("content");
  }

  function readDataSourceId() {
    try {
      const current = new URL(root.location && root.location.href ? root.location.href : SOURCE_URL);
      return current.searchParams.get("_ds") || DEFAULT_CONTEXT.data_source_id;
    } catch {
      return DEFAULT_CONTEXT.data_source_id;
    }
  }

  function compact(value) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
    );
  }

  function context(overrides = {}) {
    const dataSourceId = overrides.data_source_id || readMeta("kiosk:data-source-id") || readDataSourceId();
    return compact({
      ...DEFAULT_CONTEXT,
      store_id: overrides.store_id || readMeta("kiosk:store-id") || dataSourceId,
      data_source_id: dataSourceId,
      kiosk_id: overrides.kiosk_id || readMeta("kiosk:kiosk-id"),
      device_session_id: overrides.device_session_id || readMeta("kiosk:device-session-id"),
      app_version: overrides.app_version || readMeta("kiosk:app-version"),
      ...overrides
    });
  }

  function configure(options = {}) {
    const collectorUrl = options.collectorUrl
      || root.KIOSK_ANALYTICS_COLLECTOR_URL
      || readMeta("kiosk:collector-url")
      || "http://127.0.0.1:8787/analytics/kiosk-events";

    const nextConfig = {
      collectorUrl,
      sourceUrl: options.sourceUrl || SOURCE_URL,
      screenName: options.screenName || "welcome",
      screenEvent: options.screenEvent || "welcome_screen_view",
      autoInstall: options.autoInstall !== false,
      autoSession: options.autoSession !== false,
      autoClickTracking: options.autoClickTracking !== false,
      autoWrapFetch: options.autoWrapFetch !== false,
      debug: Boolean(options.debug),
      context: context(options.context || {})
    };

    root.KIOSK_ANALYTICS_CONFIG = {
      ...(root.KIOSK_ANALYTICS_CONFIG || {}),
      ...nextConfig,
      context: {
        ...((root.KIOSK_ANALYTICS_CONFIG || {}).context || {}),
        ...nextConfig.context
      }
    };

    root.kioskDataLayer = root.kioskDataLayer || [];
    return root.KIOSK_ANALYTICS_CONFIG;
  }

  function push(event, params = {}) {
    const payload = typeof event === "string" ? { event, ...params } : event;
    root.kioskDataLayer = root.kioskDataLayer || [];
    return root.kioskDataLayer.push({
      source: "kiosk_frontend",
      source_url: SOURCE_URL,
      ...payload
    });
  }

  function trackScreen(screenName, params = {}) {
    return push(params.event_name || `${screenName}_view`, {
      event_type: "screen_view",
      screen_name: screenName,
      status: "viewed",
      ...params
    });
  }

  function trackClick(actionName, params = {}) {
    return push(params.event_name || `${actionName}_clicked`, {
      event_type: "click",
      action_name: actionName,
      status: "clicked",
      ...params
    });
  }

  function trackScanner(eventName, params = {}) {
    return push(eventName, {
      screen_name: params.screen_name || "scan_home",
      journey_stage: params.journey_stage || "scan",
      ...params
    });
  }

  function trackApi(endpointTemplate, responseOrStatus, params = {}) {
    const apiStatus = typeof responseOrStatus === "number"
      ? responseOrStatus
      : responseOrStatus && responseOrStatus.status;
    const statusNumber = Number(apiStatus);
    const success = Number.isFinite(statusNumber) && statusNumber < 400;
    return push(params.event_name || (success ? "api_request_success" : "api_request_failure"), {
      event_type: "api",
      status: success ? "success" : "failure",
      api_endpoint: endpointTemplate,
      api_endpoint_template: endpointTemplate,
      api_status: Number.isFinite(statusNumber) ? statusNumber : undefined,
      source_url: endpointTemplate,
      ...params
    });
  }

  const api = {
    SOURCE_URL,
    configure,
    context,
    push,
    trackApi,
    trackClick,
    trackScanner,
    trackScreen
  };

  root.FashionFactorySelfCheckoutAnalytics = api;
  configure();

  if (root.KioskDataLayerPlugin && typeof root.KioskDataLayerPlugin.install === "function") {
    root.KioskDataLayerPlugin.install(root.KIOSK_ANALYTICS_CONFIG);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
