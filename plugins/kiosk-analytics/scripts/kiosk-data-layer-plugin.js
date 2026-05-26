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
  const DEFAULT_SCREEN_NAME = "welcome";
  const DEFAULT_SCREEN_EVENT = "welcome_screen_view";
  const DATASET_CONTEXT_MAP = {
    companyId: "company_id",
    applicationId: "application_id",
    storeId: "store_id",
    storeName: "store_name",
    kioskId: "kiosk_id",
    deviceSessionId: "device_session_id",
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
    return {
      collectorUrl: DEFAULT_COLLECTOR_URL,
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
      source_url: root.location ? `${root.location.pathname || ""}${root.location.search || ""}` : "unknown"
    });

    installPromise = loadTagManager().then((manager) => {
      if (!manager) return api;
      manager.install({
        collectorUrl: config.collectorUrl,
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
          journey_stage: config.screenName === "welcome" ? "welcome" : undefined
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
