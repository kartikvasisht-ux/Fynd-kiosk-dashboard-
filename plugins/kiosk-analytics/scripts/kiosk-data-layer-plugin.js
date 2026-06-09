/*
  Kiosk analytics data layer plugin.

  Include this file in the kiosk frontend to create window.kioskDataLayer,
  load/install KioskTagManager, wrap fetch for API events, and emit the first
  bootstrap/screen events. Keep this script first-party; it does not load GA4
  or GTM as the collector.
*/

(function kioskDataLayerPluginFactory(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory;
  } else {
    root.KioskDataLayerPlugin = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createKioskDataLayerPlugin(root = {}) {
  const DEFAULT_COLLECTOR_URL = "http://127.0.0.1:8787/analytics/kiosk-events";
  const DEFAULT_SOURCE_URL = "https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790";
  const DEFAULT_COMPANY_ID = "59";
  const DEFAULT_APPLICATION_ID = "688a0fc42f61c5197c8bbfc5";
  const DEFAULT_STORE_ID = "2790";
  const DEFAULT_DATA_SOURCE_ID = "2790";
  const DEFAULT_SCREEN_NAME = "welcome";
  const DEFAULT_SCREEN_EVENT = "welcome_screen_view";
  const DATASET_CONTEXT_MAP = {
    companyId: "company_id",
    applicationId: "application_id",
    storeId: "store_id",
    storeName: "store_name",
    kioskId: "kiosk_id",
    deviceSessionId: "device_session_id",
    dataSourceId: "data_source_id",
    appVersion: "app_version"
  };

  let installed = false;
  let installPromise = null;

  function ensureDataLayer() {
    root.kioskDataLayer = root.kioskDataLayer || [];
    return root.kioskDataLayer;
  }

  function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return !["false", "0", "no", "off"].includes(String(value).toLowerCase());
  }

  function cleanObject(value = {}) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));
  }

  function firstPresent(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== "");
  }

  function extractDataSourceId(url) {
    try {
      return new URL(url, root.location && root.location.href ? root.location.href : DEFAULT_SOURCE_URL).searchParams.get("_ds");
    } catch {
      return null;
    }
  }

  function currentLocationSourceUrl() {
    if (!root.location) return DEFAULT_SOURCE_URL;
    return root.location.href || `${root.location.pathname || ""}${root.location.search || ""}` || DEFAULT_SOURCE_URL;
  }

  function currentScript() {
    return root.document && root.document.currentScript;
  }

  function datasetOptions() {
    const script = currentScript();
    const dataset = script && script.dataset ? script.dataset : {};
    const context = {};
    Object.entries(DATASET_CONTEXT_MAP).forEach(([datasetKey, contextKey]) => {
      if (dataset[datasetKey]) context[contextKey] = dataset[datasetKey];
    });

    return cleanObject({
      collectorUrl: dataset.collectorUrl,
      sourceUrl: dataset.sourceUrl,
      screenName: dataset.screenName,
      screenEvent: dataset.screenEvent,
      autoInstall: parseBoolean(dataset.autoInstall, undefined),
      autoSession: parseBoolean(dataset.autoSession, undefined),
      autoClickTracking: parseBoolean(dataset.autoClickTracking, undefined),
      autoWrapFetch: parseBoolean(dataset.autoWrapFetch, undefined),
      debug: parseBoolean(dataset.debug, undefined),
      context
    });
  }

  function globalOptions() {
    return root.KIOSK_ANALYTICS_CONFIG && typeof root.KIOSK_ANALYTICS_CONFIG === "object"
      ? root.KIOSK_ANALYTICS_CONFIG
      : {};
  }

  function mergedOptions(options = {}) {
    const fromDataset = datasetOptions();
    const fromGlobal = globalOptions();
    const sourceUrl = firstPresent(options.sourceUrl, fromGlobal.sourceUrl, fromDataset.sourceUrl, DEFAULT_SOURCE_URL);
    const dataSourceId = firstPresent(
      options.context && options.context.data_source_id,
      fromGlobal.context && fromGlobal.context.data_source_id,
      fromDataset.context && fromDataset.context.data_source_id,
      extractDataSourceId(currentLocationSourceUrl()),
      extractDataSourceId(sourceUrl),
      DEFAULT_DATA_SOURCE_ID
    );
    return {
      collectorUrl: DEFAULT_COLLECTOR_URL,
      sourceUrl,
      screenName: DEFAULT_SCREEN_NAME,
      screenEvent: DEFAULT_SCREEN_EVENT,
      autoInstall: true,
      autoSession: true,
      autoClickTracking: true,
      autoWrapFetch: true,
      debug: false,
      ...fromDataset,
      ...fromGlobal,
      ...options,
      context: cleanObject({
        company_id: DEFAULT_COMPANY_ID,
        application_id: DEFAULT_APPLICATION_ID,
        store_id: dataSourceId || DEFAULT_STORE_ID,
        data_source_id: dataSourceId || DEFAULT_DATA_SOURCE_ID,
        source_url: sourceUrl,
        ...(fromDataset.context || {}),
        ...(fromGlobal.context || {}),
        ...(options.context || {})
      })
    };
  }

  function tagManagerScriptUrl() {
    const script = currentScript();
    if (!root.document || !root.location) return "";
    const src = script && script.getAttribute("src");
    const base = src ? new URL(src, root.location.href) : new URL(root.location.href);
    return new URL("kiosk-tag-manager.js", base).href;
  }

  function loadTagManager() {
    if (root.KioskTagManager) return Promise.resolve(root.KioskTagManager);
    if (!root.document || !root.document.createElement) return Promise.resolve(null);

    const existing = root.document.querySelector('script[data-kiosk-tag-manager="true"]');
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", () => resolve(root.KioskTagManager || null), { once: true });
        existing.addEventListener("error", () => reject(new Error("KioskTagManager failed to load")), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = root.document.createElement("script");
      script.src = tagManagerScriptUrl();
      script.async = false;
      script.defer = false;
      script.dataset.kioskTagManager = "true";
      script.onload = () => resolve(root.KioskTagManager || null);
      script.onerror = () => reject(new Error(`KioskTagManager failed to load from ${script.src}`));
      (root.document.head || root.document.documentElement).appendChild(script);
    });
  }

  function push(messageOrEventName, params = {}) {
    const payload = typeof messageOrEventName === "string"
      ? { event: messageOrEventName, ...params }
      : messageOrEventName;
    return ensureDataLayer().push(payload);
  }

  function setContext(context = {}) {
    if (root.KioskTagManager && typeof root.KioskTagManager.setContext === "function") {
      root.KioskTagManager.setContext(context);
    }
    root.KIOSK_ANALYTICS_CONFIG = {
      ...(root.KIOSK_ANALYTICS_CONFIG || {}),
      context: {
        ...((root.KIOSK_ANALYTICS_CONFIG || {}).context || {}),
        ...context
      }
    };
    return root.KIOSK_ANALYTICS_CONFIG.context;
  }

  function install(options = {}) {
    if (installPromise) return installPromise;
    ensureDataLayer();
    const config = mergedOptions(options);

    push({
      event: "kiosk_app_bootstrap_started",
      event_type: "system",
      screen_name: config.screenName,
      journey_stage: "bootstrap",
      status: "started",
      source_url: config.sourceUrl
    });

    installPromise = loadTagManager().then((manager) => {
      if (!manager) return api;
      manager.install({
        collectorUrl: config.collectorUrl,
        sourceUrl: config.sourceUrl,
        context: config.context,
        autoSession: config.autoSession,
        autoClickTracking: config.autoClickTracking,
        debug: config.debug
      });

      if (config.autoWrapFetch && root.fetch && typeof manager.wrapFetch === "function" && !root.fetch.__kioskAnalyticsWrapped) {
        const wrappedFetch = manager.wrapFetch(root.fetch.bind(root));
        wrappedFetch.__kioskAnalyticsWrapped = true;
        root.fetch = wrappedFetch;
      }

      if (config.screenEvent && typeof manager.trackScreenView === "function") {
        manager.trackScreenView(config.screenName, {
          event_name: config.screenEvent,
          journey_stage: config.screenName === "welcome" ? "welcome" : undefined,
          source_url: config.sourceUrl
        });
      }

      if (config.context.store_id) {
        root.kioskDataLayer.push({
          event: "store_context_loaded",
          event_type: "api",
          screen_name: config.screenName,
          journey_stage: "bootstrap",
          status: "success",
          source_url: config.sourceUrl
        });
      }

      if (!config.context.kiosk_id && !config.context.device_session_id) {
        root.kioskDataLayer.push({
          event: "device_context_missing",
          event_type: "system",
          screen_name: config.screenName,
          journey_stage: "bootstrap",
          status: "failure",
          context_missing: "kiosk_id,device_session_id",
          source_url: config.sourceUrl
        });
      }

      installed = true;
      return api;
    }).catch((error) => {
      installPromise = null;
      if (config.debug && root.console) root.console.warn("Kiosk data layer install failed", error);
      throw error;
    });

    return installPromise;
  }

  function trackScreen(screenName, params = {}) {
    if (root.KioskTagManager && typeof root.KioskTagManager.trackScreenView === "function") {
      return root.KioskTagManager.trackScreenView(screenName, params);
    }
    return push(params.event_name || `${screenName}_view`, {
      event_type: "screen_view",
      screen_name: screenName,
      status: "viewed",
      ...params
    });
  }

  function trackScanner(eventName, params = {}) {
    if (root.KioskTagManager && typeof root.KioskTagManager.trackScannerEvent === "function") {
      return root.KioskTagManager.trackScannerEvent(eventName, params);
    }
    return push(eventName, { screen_name: "scan_home", ...params });
  }

  const api = {
    ensureDataLayer,
    install,
    push,
    setContext,
    trackScanner,
    trackScreen,
    get installed() {
      return installed;
    }
  };

  ensureDataLayer();
  if (root.window === root) {
    const config = mergedOptions();
    root.KioskDataLayerPlugin = api;
    root.kioskAnalytics = api;
    if (config.autoInstall) install(config);
  }

  return api;
});
