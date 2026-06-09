/*
  Fashion Factory first-party analytics layer.

  Include this script on https://fashionfactory.jiocommerce.io to create
  window.ffDataLayer and send accepted events to the owned collector.
*/
(function ffAnalyticsLayer(root) {
  var script = root.document && root.document.currentScript;
  var dataset = script && script.dataset ? script.dataset : {};
  var sourceUrl = dataset.sourceUrl || root.location.origin;
  var collectorUrl = dataset.collectorUrl || "/api/first-party/events";
  var context = {
    property_id: dataset.propertyId || "538449109",
    measurement_id: dataset.measurementId || "G-MYZM2V20D9",
    stream_id: dataset.streamId || "14914518095",
    stream_url: dataset.streamUrl || "https://fashionfactory.jiocommerce.io",
    source_url: sourceUrl,
    _ds: dataset.ds || "2790",
    company_id: dataset.companyId,
    application_id: dataset.applicationId,
    app_id: dataset.applicationId,
    store_id: dataset.storeId,
    kiosk_id: dataset.kioskId,
    device_id: dataset.deviceId
  };
  var blockedFields = {
    mobile: true,
    mobileNo: true,
    phone: true,
    otp: true,
    password: true,
    email: true,
    token: true,
    authorization: true,
    auth_token: true,
    access_token: true,
    refresh_token: true,
    raw_cart_id: true,
    raw_order_id: true,
    raw_transaction_id: true,
    raw_payment_id: true
  };

  function uuid(prefix) {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    uuid.sequence = (uuid.sequence || 0) + 1;
    return prefix + "_" + Date.now() + "_" + uuid.sequence;
  }

  function sessionId() {
    try {
      var key = "ff_analytics_session_id";
      var existing = root.sessionStorage && root.sessionStorage.getItem(key);
      if (existing) return existing;
      var next = uuid("ff_session");
      root.sessionStorage && root.sessionStorage.setItem(key, next);
      return next;
    } catch {
      return uuid("ff_session");
    }
  }

  function strip(value) {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(strip);
    return Object.keys(value).reduce(function clean(result, key) {
      if (!blockedFields[key]) result[key] = strip(value[key]);
      return result;
    }, {});
  }

  function normalize(message) {
    var clean = strip(message || {});
    var eventName = clean.event_name || clean.event;
    if (!eventName) throw new Error("ffDataLayer event_name or event is required");
    var timestamp = clean.timestamp || clean.occurred_at || new Date().toISOString();
    delete clean.event;
    return Object.assign({}, context, clean, {
      event_id: clean.event_id || uuid("ff_evt"),
      event_name: eventName,
      event_type: clean.event_type || "custom",
      timestamp: timestamp,
      occurred_at: clean.occurred_at || timestamp,
      session_id: clean.session_id || sessionId(),
      screen_name: clean.screen_name || "unknown",
      journey_stage: clean.journey_stage || "unknown",
      status: clean.status || "observed",
      source_url: clean.source_url || sourceUrl
    });
  }

  function send(event) {
    var body = JSON.stringify(event);
    if (root.navigator && typeof root.navigator.sendBeacon === "function") {
      var blob = new Blob([body], { type: "application/json" });
      if (root.navigator.sendBeacon(collectorUrl, blob)) return Promise.resolve({ transport: "beacon" });
    }
    return root.fetch(collectorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: body
    }).then(function parse(response) {
      return response.json().catch(function empty() {
        return { status: response.status };
      });
    });
  }

  function push(message) {
    var event = normalize(message);
    var result = send(event).catch(function onError(error) {
      if (root.console) root.console.warn("FashionFactory analytics failed", error);
      return { accepted: false, error: error.message };
    });
    return { event: event, result: result };
  }

  function track(eventName, params) {
    return root.ffDataLayer.push(Object.assign({ event: eventName }, params || {}));
  }

  function trackScreen(screenName, params) {
    return track((params && params.event_name) || screenName + "_view", Object.assign({
      event_type: "screen_view",
      screen_name: screenName,
      status: "viewed"
    }, params || {}));
  }

  function installClickTracking() {
    if (!root.document) return;
    root.document.addEventListener("click", function onClick(clickEvent) {
      var target = clickEvent.target && clickEvent.target.closest
        ? clickEvent.target.closest("[data-ff-action], [data-ff-event]")
        : null;
      if (!target) return;
      var action = target.getAttribute("data-ff-action") || target.getAttribute("data-ff-event");
      track(target.getAttribute("data-ff-event") || action + "_clicked", {
        event_type: "click",
        action_name: action,
        screen_name: target.getAttribute("data-ff-screen") || "unknown",
        journey_stage: target.getAttribute("data-ff-stage") || "unknown",
        status: "clicked"
      });
    }, true);
  }

  var queued = root.ffDataLayer && root.ffDataLayer.slice ? root.ffDataLayer.slice() : [];
  var dataLayer = root.ffDataLayer = root.ffDataLayer || [];
  var nativePush = Array.prototype.push.bind(dataLayer);
  dataLayer.push = function patchedPush() {
    var messages = Array.prototype.slice.call(arguments);
    var length = nativePush.apply(null, messages);
    messages.forEach(function handle(message) {
      if (message && typeof message === "object") push(message);
    });
    return length;
  };

  root.FFAnalytics = {
    context: context,
    push: push,
    track: track,
    trackScreen: trackScreen
  };

  installClickTracking();
  queued.forEach(function replay(message) {
    dataLayer.push(message);
  });
  track("session_start", {
    event_type: "session",
    screen_name: "entry",
    journey_stage: "session",
    status: "started"
  });
})(window);
