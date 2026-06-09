/*
  Temporary FashionFactory self-checkout source bridge.

  Use this only until the self-checkout app owns native instrumentation.
  It emits real page/session/click/API/error events from the browser runtime
  into the first-party collector without sending raw form values or PII.
*/
(function fashionFactorySourceBridge(root) {
  var doc = root.document;
  if (!doc) return;

  var script = doc.currentScript;
  var dataset = script && script.dataset ? script.dataset : {};
  var bridgeOrigin = script && script.src ? new URL(script.src).origin : root.location.origin;
  var collectorUrl = dataset.collectorUrl || bridgeOrigin + "/api/first-party/events";
  var sourceUrl = dataset.sourceUrl || root.location.href;
  var sdkUrl = dataset.sdkUrl || bridgeOrigin + "/sdk/ff-analytics-layer.js";
  var context = {
    company_id: dataset.companyId || "59",
    application_id: dataset.applicationId,
    store_id: dataset.storeId,
    kiosk_id: dataset.kioskId,
    device_id: dataset.deviceId,
    _ds: dataset.ds || "2790",
    source_url: sourceUrl,
    stream_url: dataset.streamUrl || "https://fashionfactory.jiocommerce.io",
    stream_id: dataset.streamId || "14914518095"
  };

  function cleanContext(value) {
    return Object.keys(value).reduce(function compact(result, key) {
      if (value[key] !== undefined && value[key] !== null && value[key] !== "") result[key] = value[key];
      return result;
    }, {});
  }

  function screenName() {
    var path = root.location.pathname.split("/").filter(Boolean).slice(-2).join("/");
    var hash = root.location.hash ? root.location.hash.replace(/^#\/?/, "") : "";
    return hash || path || "selfcheckout";
  }

  function safeText(element) {
    var raw = [
      element.getAttribute("data-testid"),
      element.getAttribute("aria-label"),
      element.getAttribute("name"),
      element.getAttribute("type"),
      element.textContent
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (!raw) return element.tagName.toLowerCase();
    return raw
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/\b\d{4,}\b/g, "[number]")
      .slice(0, 80);
  }

  function endpointTemplate(input) {
    try {
      var url = new URL(String(input), root.location.href);
      return url.pathname
        .replace(/[0-9a-f]{8}-[0-9a-f-]{13,}/gi, ":id")
        .replace(/\b\d{4,}\b/g, ":id");
    } catch {
      return "unknown";
    }
  }

  function isTelemetryUrl(input) {
    try {
      var url = new URL(String(input && input.url ? input.url : input), root.location.href);
      var collector = new URL(collectorUrl, root.location.href);
      return url.origin === collector.origin && (
        url.pathname === collector.pathname ||
        url.pathname.indexOf("/sdk/") === 0
      );
    } catch {
      return false;
    }
  }

  function track(eventName, params) {
    var payload = Object.assign(cleanContext(context), params || {}, {
      event: eventName,
      screen_name: (params && params.screen_name) || screenName(),
      source_url: sourceUrl
    });

    if (root.FFAnalytics && typeof root.FFAnalytics.track === "function") {
      return root.FFAnalytics.track(eventName, payload);
    }

    return root.fetch(collectorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify(Object.assign({
        event_name: eventName,
        event_type: payload.event_type || "custom",
        timestamp: new Date().toISOString(),
        session_id: root.sessionStorage && root.sessionStorage.getItem("ff_analytics_session_id") || "source_bridge_session"
      }, payload))
    }).catch(function ignore() {});
  }

  function loadSdk() {
    return new Promise(function load(resolve) {
      if (root.FFAnalytics) {
        resolve();
        return;
      }
      var sdk = doc.createElement("script");
      sdk.src = sdkUrl;
      sdk.async = true;
      sdk.dataset.collectorUrl = collectorUrl;
      sdk.dataset.sourceUrl = sourceUrl;
      sdk.dataset.companyId = context.company_id || "";
      sdk.dataset.applicationId = context.application_id || "";
      sdk.dataset.storeId = context.store_id || "";
      sdk.dataset.kioskId = context.kiosk_id || "";
      sdk.dataset.deviceId = context.device_id || "";
      sdk.dataset.ds = context._ds || "";
      sdk.dataset.streamId = context.stream_id || "";
      sdk.dataset.streamUrl = context.stream_url || "";
      sdk.onload = resolve;
      sdk.onerror = resolve;
      doc.head.appendChild(sdk);
    });
  }

  function installNavigationTracking() {
    var lastScreen = screenName();
    function emitScreen(reason) {
      var next = screenName();
      if (next === lastScreen && reason !== "initial") return;
      lastScreen = next;
      track("screen_view", {
        event_type: "screen_view",
        journey_stage: "navigation",
        status: "viewed",
        action_name: reason,
        screen_name: next
      });
    }

    ["pushState", "replaceState"].forEach(function patch(method) {
      var original = root.history[method];
      root.history[method] = function patchedHistory() {
        var result = original.apply(this, arguments);
        setTimeout(function afterRoute() { emitScreen(method); }, 0);
        return result;
      };
    });
    root.addEventListener("popstate", function onPop() { emitScreen("popstate"); });
    emitScreen("initial");
  }

  function installClickTracking() {
    doc.addEventListener("click", function onClick(event) {
      var target = event.target && event.target.closest
        ? event.target.closest("button, a, [role='button'], input, select, textarea, [data-testid]")
        : null;
      if (!target) return;
      track("ui_click", {
        event_type: "click",
        journey_stage: "interaction",
        status: "clicked",
        action_name: safeText(target),
        metadata: {
          tag: target.tagName.toLowerCase(),
          role: target.getAttribute("role") || undefined,
          href_path: target.href ? endpointTemplate(target.href) : undefined
        }
      });
    }, true);

    doc.addEventListener("submit", function onSubmit(event) {
      track("form_submit", {
        event_type: "form",
        journey_stage: "interaction",
        status: "submitted",
        action_name: safeText(event.target)
      });
    }, true);

    doc.addEventListener("change", function onChange(event) {
      var target = event.target;
      if (!target || !target.matches || !target.matches("input, textarea, select")) return;
      var fingerprint = [
        target.getAttribute("name"),
        target.getAttribute("id"),
        target.getAttribute("placeholder"),
        target.getAttribute("aria-label")
      ].filter(Boolean).join(" ").toLowerCase();
      if (!/(barcode|article|sku|scan)/.test(fingerprint)) return;
      track("manual_barcode_entry", {
        event_type: "scan",
        journey_stage: "scan",
        status: "observed",
        action_name: "manual_barcode_entry",
        metadata: { value_length: String(target.value || "").length }
      });
    }, true);
  }

  function installApiTracking() {
    if (typeof root.fetch === "function" && !root.fetch.__ffBridgePatched) {
      var originalFetch = root.fetch.bind(root);
      var patchedFetch = function patchedFetch(input, init) {
        if (isTelemetryUrl(input && input.url ? input.url : input)) {
          return originalFetch(input, init);
        }
        var start = Date.now();
        return originalFetch(input, init).then(function onSuccess(response) {
          track("api_request_success", {
            event_type: "api",
            journey_stage: "api",
            status: "success",
            api_endpoint_template: endpointTemplate(input && input.url ? input.url : input),
            api_status: response.status,
            api_latency_ms: Date.now() - start
          });
          return response;
        }).catch(function onFailure(error) {
          track("api_request_failure", {
            event_type: "api",
            journey_stage: "api",
            status: "failure",
            api_endpoint_template: endpointTemplate(input && input.url ? input.url : input),
            api_latency_ms: Date.now() - start,
            failure_reason: error && error.name || "fetch_error"
          });
          throw error;
        });
      };
      patchedFetch.__ffBridgePatched = true;
      root.fetch = patchedFetch;
    }

    if (root.XMLHttpRequest && !root.XMLHttpRequest.prototype.__ffBridgePatched) {
      var open = root.XMLHttpRequest.prototype.open;
      var send = root.XMLHttpRequest.prototype.send;
      root.XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
        this.__ffBridgeUrl = url;
        this.__ffBridgeIgnore = isTelemetryUrl(url);
        return open.apply(this, arguments);
      };
      root.XMLHttpRequest.prototype.send = function patchedSend() {
        var xhr = this;
        if (xhr.__ffBridgeIgnore) return send.apply(this, arguments);
        var start = Date.now();
        xhr.addEventListener("loadend", function onLoadEnd() {
          track(xhr.status >= 200 && xhr.status < 400 ? "api_request_success" : "api_request_failure", {
            event_type: "api",
            journey_stage: "api",
            status: xhr.status >= 200 && xhr.status < 400 ? "success" : "failure",
            api_endpoint_template: endpointTemplate(xhr.__ffBridgeUrl),
            api_status: xhr.status,
            api_latency_ms: Date.now() - start
          });
        });
        return send.apply(this, arguments);
      };
      root.XMLHttpRequest.prototype.__ffBridgePatched = true;
    }
  }

  function installErrorTracking() {
    root.addEventListener("error", function onError(errorEvent) {
      track("app_error", {
        event_type: "error",
        journey_stage: "runtime",
        status: "failure",
        failure_reason: errorEvent.message || "runtime_error"
      });
    });
    root.addEventListener("unhandledrejection", function onRejection(event) {
      track("app_unhandled_rejection", {
        event_type: "error",
        journey_stage: "runtime",
        status: "failure",
        failure_reason: event.reason && event.reason.name || "unhandled_rejection"
      });
    });
  }

  function installSessionEnd() {
    root.addEventListener("visibilitychange", function onVisibility() {
      if (doc.visibilityState !== "hidden") return;
      track("session_end", {
        event_type: "session",
        journey_stage: "session",
        status: "ended",
        action_name: "visibility_hidden"
      });
    });
  }

  loadSdk().then(function startBridge() {
    track("source_bridge_connected", {
      event_type: "system",
      journey_stage: "source_bridge",
      status: "connected",
      action_name: "fashionfactory_source_bridge"
    });
    installNavigationTracking();
    installClickTracking();
    installApiTracking();
    installErrorTracking();
    installSessionEnd();
  });
})(window);
