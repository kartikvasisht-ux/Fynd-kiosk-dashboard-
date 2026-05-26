/*
  First-party real-time event collector for the Fynd Kiosk dashboard.

  Run:
    node boilerplate/realtime-event-server.js

  Endpoints:
    POST /analytics/kiosk-events  - receive kiosk/dataLayer events
    GET  /analytics/stream        - SSE stream for dashboard live updates
    GET  /analytics/summary       - current counters + aggregates
    GET  /analytics/aggregates    - funnel, payment, API, device, sales-join rollups
    GET  /analytics/export        - export-ready event model

  This collector is intentionally live-only: it does not create sample events,
  default store/company values, or fallback metric values.
*/

const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const STORAGE_ROOT = process.env.ANALYTICS_DATA_DIR || path.join(__dirname, "..", ".analytics-store");
const CONTRACT_ROOT = path.join(__dirname, "..", "contracts");
const EVENT_SCHEMA = JSON.parse(fs.readFileSync(path.join(CONTRACT_ROOT, "kiosk-touchpoint-event-schema.json"), "utf8"));
const EVENT_CONTRACT = JSON.parse(fs.readFileSync(path.join(CONTRACT_ROOT, "kiosk-event-contract.json"), "utf8"));

const EVENT_TYPES = new Set(EVENT_SCHEMA.properties.event_type.enum);
const STATUSES = new Set(EVENT_SCHEMA.properties.status.enum);
const KNOWN_EVENTS = new Set(EVENT_CONTRACT.properties.event_name.enum);
const clients = new Set();
const events = [];
const seenEventIds = new Set();
const sessionIndex = new Map();
const TABLES = {
  events: "kiosk_events.jsonl",
  sessions: "kiosk_sessions.jsonl",
  api: "kiosk_api_events.jsonl",
  sales: "kiosk_sales_join_keys.jsonl",
  quarantine: "kiosk_quarantine.jsonl"
};

const BLOCKED_FIELD_NAMES = new Set([
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

function tablePath(name) {
  return path.join(STORAGE_ROOT, TABLES[name]);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function eventRule(eventName) {
  return EVENT_RULES[eventName] || ["system", "unknown", "unknown"];
}

function findBlockedFields(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  const matches = [];
  Object.entries(value).forEach(([key, entryValue]) => {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (BLOCKED_FIELD_NAMES.has(key)) matches.push(fieldPath);
    if (entryValue && typeof entryValue === "object") {
      matches.push(...findBlockedFields(entryValue, fieldPath));
    }
  });
  return matches;
}

function redactBlockedFields(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactBlockedFields);
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => {
    if (BLOCKED_FIELD_NAMES.has(key)) return [key, "[blocked]"];
    return [key, redactBlockedFields(entryValue)];
  }));
}

function hashReference(value) {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeEvent(raw) {
  const eventName = raw.event_name || raw.event;
  const [inferredType, inferredStatus, inferredStage] = eventRule(eventName);
  const timestamp = firstPresent(raw.timestamp, raw.occurred_at, new Date().toISOString());
  const cartRef = raw.cart_reference || {};
  const orderRef = raw.order_reference || {};
  const paymentRef = raw.payment_reference || {};

  const event = {
    event_id: raw.event_id || crypto.randomUUID(),
    event_name: eventName,
    event_type: firstPresent(raw.event_type, inferredType),
    occurred_at: firstPresent(raw.occurred_at, timestamp),
    timestamp,
    received_at: new Date().toISOString(),
    source: firstPresent(raw.source, "kiosk_frontend"),
    session_id: raw.session_id,
    screen_name: firstPresent(raw.screen_name, "unknown"),
    action_name: raw.action_name,
    journey_stage: firstPresent(raw.journey_stage, inferredStage),
    status: firstPresent(raw.status, inferredStatus),
    source_url: firstPresent(raw.source_url, raw.api_endpoint, "unknown"),
    company_id: raw.company_id,
    application_id: raw.application_id,
    store_id: raw.store_id,
    store_name: raw.store_name,
    city: raw.city,
    city_name: raw.city_name,
    device_session_id: raw.device_session_id,
    kiosk_id: raw.kiosk_id,
    device_status: raw.device_status,
    app_version: raw.app_version,
    user_id_hash: firstPresent(raw.user_id_hash, raw.raw_user_id && hashReference(raw.raw_user_id)),
    mobile_hash: firstPresent(raw.mobile_hash, raw.mobile && hashReference(raw.mobile), raw.mobileNo && hashReference(raw.mobileNo), raw.phone && hashReference(raw.phone)),
    cart_id_hash: firstPresent(raw.cart_id_hash, cartRef.cart_id_hash, raw.raw_cart_id && hashReference(raw.raw_cart_id)),
    order_id_hash: firstPresent(raw.order_id_hash, orderRef.order_id_hash, raw.raw_order_id && hashReference(raw.raw_order_id)),
    payment_session_id_hash: firstPresent(raw.payment_session_id_hash, paymentRef.payment_session_id_hash),
    payment_order_id_hash: firstPresent(raw.payment_order_id_hash, paymentRef.payment_order_id_hash),
    transaction_id_hash: firstPresent(raw.transaction_id_hash, paymentRef.transaction_id_hash, raw.raw_transaction_id && hashReference(raw.raw_transaction_id)),
    article: raw.article,
    barcode_hash: raw.barcode_hash,
    product_id: raw.product_id,
    product_name: raw.product_name,
    brand_id: raw.brand_id,
    brand_name: raw.brand_name,
    line_item_id: firstPresent(raw.line_item_id, cartRef.line_item_id),
    quantity: firstPresent(raw.quantity, cartRef.quantity),
    amount: raw.amount,
    currency: raw.currency,
    payment_mode: firstPresent(raw.payment_mode, paymentRef.payment_mode),
    aggregator_name: firstPresent(raw.aggregator_name, paymentRef.aggregator_name),
    failure_reason: raw.failure_reason,
    api_endpoint: raw.api_endpoint,
    api_status: raw.api_status,
    api_duration_ms: raw.api_duration_ms,
    queue_depth: raw.queue_depth,
    oms_elapsed_ms: raw.oms_elapsed_ms,
    order_placed_at: raw.order_placed_at,
    order_confirmed_at: raw.order_confirmed_at,
    context_missing: raw.context_missing
  };

  const missingContext = ["company_id", "application_id", "store_id"].filter((field) => !event[field]);
  if (missingContext.length) {
    event.context_missing = [event.context_missing, ...missingContext].filter(Boolean).join(",");
  }

  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function validateEvent(event) {
  const errors = [];
  if (!event.event_name) errors.push("event_name is required");
  if (event.event_name && !KNOWN_EVENTS.has(event.event_name)) errors.push(`unknown event_name: ${event.event_name}`);
  if (!event.session_id) errors.push("session_id is required");
  if (!event.timestamp) errors.push("timestamp is required");
  if (event.event_type && !EVENT_TYPES.has(event.event_type)) errors.push(`invalid event_type: ${event.event_type}`);
  if (event.status && !STATUSES.has(event.status)) errors.push(`invalid status: ${event.status}`);
  if (Number.isNaN(Date.parse(event.timestamp))) errors.push("timestamp must be ISO 8601");
  return errors;
}

async function appendJsonLine(name, payload) {
  await fsp.mkdir(STORAGE_ROOT, { recursive: true });
  await fsp.appendFile(tablePath(name), `${JSON.stringify(payload)}\n`);
}

function insertInMemory(event) {
  events.unshift(event);
  events.splice(1000);
  seenEventIds.add(event.event_id);
  updateSessionIndex(event);
}

function updateSessionIndex(event) {
  const existing = sessionIndex.get(event.session_id) || {
    session_id: event.session_id,
    started_at: event.timestamp,
    last_seen_at: event.timestamp,
    event_count: 0,
    status: "active"
  };
  existing.event_count += 1;
  existing.last_seen_at = event.timestamp;
  existing.company_id = firstPresent(existing.company_id, event.company_id);
  existing.application_id = firstPresent(existing.application_id, event.application_id);
  existing.store_id = firstPresent(existing.store_id, event.store_id);
  existing.store_name = firstPresent(existing.store_name, event.store_name);
  existing.kiosk_id = firstPresent(existing.kiosk_id, event.kiosk_id);
  existing.device_session_id = firstPresent(existing.device_session_id, event.device_session_id);
  existing.user_id_hash = firstPresent(existing.user_id_hash, event.user_id_hash);
  existing.cart_id_hash = firstPresent(existing.cart_id_hash, event.cart_id_hash);
  existing.order_id_hash = firstPresent(existing.order_id_hash, event.order_id_hash);
  if (event.event_name === "session_start") {
    existing.started_at = event.timestamp;
    existing.status = "active";
  }
  if (["session_end", "journey_complete", "session_timeout"].includes(event.event_name)) {
    existing.ended_at = event.timestamp;
    existing.status = event.event_name === "journey_complete" ? "completed" : event.status;
  }
  if (existing.started_at && existing.ended_at) {
    existing.duration_ms = Math.max(0, new Date(existing.ended_at).getTime() - new Date(existing.started_at).getTime());
  }
  sessionIndex.set(event.session_id, existing);
}

function toApiRow(event) {
  if (event.event_type !== "api" && !event.api_endpoint && event.api_status === undefined) return null;
  return {
    event_id: event.event_id,
    session_id: event.session_id,
    event_name: event.event_name,
    timestamp: event.timestamp,
    api_endpoint: event.api_endpoint || event.source_url,
    api_status: event.api_status,
    api_duration_ms: event.api_duration_ms,
    status: event.status,
    failure_reason: event.failure_reason,
    store_id: event.store_id,
    kiosk_id: event.kiosk_id
  };
}

function toSalesJoinRow(event) {
  const hasJoin = event.cart_id_hash || event.order_id_hash || event.payment_session_id_hash || event.payment_order_id_hash || event.transaction_id_hash || event.product_id || event.article || event.barcode_hash;
  if (!hasJoin) return null;
  return {
    event_id: event.event_id,
    session_id: event.session_id,
    timestamp: event.timestamp,
    event_name: event.event_name,
    company_id: event.company_id,
    application_id: event.application_id,
    store_id: event.store_id,
    cart_id_hash: event.cart_id_hash,
    order_id_hash: event.order_id_hash,
    payment_session_id_hash: event.payment_session_id_hash,
    payment_order_id_hash: event.payment_order_id_hash,
    transaction_id_hash: event.transaction_id_hash,
    line_item_id: event.line_item_id,
    article: event.article,
    barcode_hash: event.barcode_hash,
    product_id: event.product_id,
    brand_id: event.brand_id,
    quantity: event.quantity,
    amount: event.amount,
    currency: event.currency,
    payment_mode: event.payment_mode,
    aggregator_name: event.aggregator_name,
    status: event.status
  };
}

async function persistAcceptedEvent(event) {
  await appendJsonLine("events", event);
  const session = sessionIndex.get(event.session_id);
  if (["session_start", "session_end", "journey_complete", "session_timeout"].includes(event.event_name) && session) {
    await appendJsonLine("sessions", session);
  }
  const apiRow = toApiRow(event);
  if (apiRow) await appendJsonLine("api", apiRow);
  const salesRow = toSalesJoinRow(event);
  if (salesRow) await appendJsonLine("sales", salesRow);
}

function isFailure(event) {
  return event.status === "failure" || event.status === "timeout" || Number(event.api_status) >= 400 || event.event_name.includes("failure") || event.event_name.includes("failed");
}

function aggregateEvents(sourceEvents = events) {
  const names = (list) => sourceEvents.filter((event) => list.includes(event.event_name)).length;
  const ratio = (numerator, denominator) => denominator ? Number(((numerator / denominator) * 100).toFixed(2)) : null;
  const apiFailures = sourceEvents.filter((event) => event.event_type === "api" && isFailure(event));
  const activeDevices = new Set(sourceEvents.filter((event) => event.kiosk_id || event.device_session_id).map((event) => event.kiosk_id || event.device_session_id));
  const offlineDevices = new Set(sourceEvents.filter((event) => event.device_status === "offline").map((event) => event.kiosk_id || event.device_session_id).filter(Boolean));
  const paymentFailuresByReason = groupCounts(sourceEvents.filter((event) => event.event_name === "payment_failure"), (event) => event.failure_reason || "unknown");
  const storeActivity = groupCounts(sourceEvents, (event) => event.store_name || event.store_id || "unknown");
  const salesJoinReady = sourceEvents.filter((event) => event.cart_id_hash || event.order_id_hash || event.payment_session_id_hash).length;

  return {
    funnel: {
      open: names(["session_start", "welcome_screen_view", "kiosk_app_bootstrap_started"]),
      auth: names(["mobile_entry_view", "otp_verify_success"]),
      scan: names(["scan_success", "manual_barcode_submit"]),
      cart: names(["cart_add_success", "cart_view"]),
      checkout: names(["checkout_start"]),
      payment_init: names(["payment_init", "payment_methods_view"]),
      payment_success: names(["payment_success"]),
      order: names(["order_created", "order_complete"]),
      complete: names(["journey_complete"])
    },
    rates: {
      scan_to_cart_rate: ratio(names(["cart_add_success"]), names(["scan_success", "manual_barcode_submit"])),
      payment_success_rate: ratio(names(["payment_success"]), names(["payment_init"])),
      order_conversion_rate: ratio(names(["order_created", "order_complete"]), names(["session_start", "welcome_screen_view"])),
      api_failure_rate: ratio(apiFailures.length, sourceEvents.filter((event) => event.event_type === "api").length)
    },
    counts: {
      events: sourceEvents.length,
      sessions: new Set(sourceEvents.map((event) => event.session_id)).size,
      api_failures: apiFailures.length,
      payment_failures: names(["payment_failure"]),
      payment_timeouts: names(["payment_timeout"]),
      device_context_missing: names(["device_context_missing"]),
      sales_join_ready: salesJoinReady
    },
    device_health: {
      active_devices: activeDevices.size,
      offline_devices: offlineDevices.size,
      heartbeat_events: sourceEvents.filter((event) => event.source === "mdm" || event.event_name.includes("heartbeat")).length
    },
    payment_failures_by_reason: paymentFailuresByReason,
    store_activity: storeActivity
  };
}

function groupCounts(rows, labeler) {
  const map = new Map();
  rows.forEach((row) => {
    const label = labeler(row);
    const prior = map.get(label) || { label, count: 0, amount: 0 };
    prior.count += 1;
    const amount = Number(row.amount);
    if (Number.isFinite(amount)) prior.amount += amount;
    map.set(label, prior);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function currentSummary() {
  const recent = events.filter((event) => Date.now() - new Date(event.received_at || event.timestamp).getTime() <= 60_000);
  const latencyValues = events.map((event) => Number(event.api_duration_ms)).filter((value) => Number.isFinite(value));
  return {
    events_processed: events.length,
    events_per_minute: recent.length,
    api_latency_ms: latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : null,
    queue_depth: 0,
    failures: events.filter(isFailure).length,
    last_event_at: events[0] ? events[0].timestamp : null,
    aggregates: aggregateEvents()
  };
}

function broadcast(event) {
  const payload = `event: kiosk-event\ndata: ${JSON.stringify({ event, summary: currentSummary(), aggregates: aggregateEvents() })}\n\n`;
  clients.forEach((res) => res.write(payload));
}

function receiveBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseRequestUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
}

async function handleEventPost(req, res) {
  const body = await receiveBody(req);
  const raw = JSON.parse(body || "{}");
  const blocked = findBlockedFields(raw);
  if (blocked.length) {
    const quarantine = {
      quarantined_at: new Date().toISOString(),
      reason: "blocked_pii_fields",
      blocked_fields: blocked,
      redacted_event: redactBlockedFields(raw)
    };
    await appendJsonLine("quarantine", quarantine);
    sendJson(res, 422, { accepted: false, quarantined: true, error: "blocked PII fields", blocked_fields: blocked });
    return;
  }

  const event = normalizeEvent(raw);
  const errors = validateEvent(event);
  if (errors.length) {
    const quarantine = {
      quarantined_at: new Date().toISOString(),
      reason: "validation_failed",
      errors,
      redacted_event: redactBlockedFields(raw)
    };
    await appendJsonLine("quarantine", quarantine);
    sendJson(res, 400, { accepted: false, quarantined: true, errors });
    return;
  }

  if (seenEventIds.has(event.event_id)) {
    sendJson(res, 200, { accepted: true, duplicate: true, event_id: event.event_id });
    return;
  }

  insertInMemory(event);
  await persistAcceptedEvent(event);
  broadcast(event);
  sendJson(res, 202, { accepted: true, event_id: event.event_id });
}

async function loadPersistedEvents() {
  await fsp.mkdir(STORAGE_ROOT, { recursive: true });
  try {
    const content = await fsp.readFile(tablePath("events"), "utf8");
    content.split("\n").filter(Boolean).forEach((line) => {
      try {
        const event = JSON.parse(line);
        if (!event.event_id || seenEventIds.has(event.event_id)) return;
        events.unshift(event);
        events.splice(1000);
        seenEventIds.add(event.event_id);
        updateSessionIndex(event);
      } catch {
        // Ignore corrupt historical rows; new writes remain valid JSONL.
      }
    });
    events.sort((a, b) => new Date(b.timestamp || b.received_at).getTime() - new Date(a.timestamp || a.received_at).getTime());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const url = parseRequestUrl(req);

    if (req.method === "GET" && url.pathname === "/analytics/summary") {
      sendJson(res, 200, { summary: currentSummary(), recent_events: events.slice(0, 100), aggregates: aggregateEvents() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/analytics/aggregates") {
      sendJson(res, 200, { aggregates: aggregateEvents(), generated_at: new Date().toISOString() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/analytics/export") {
      sendJson(res, 200, {
        exported_at: new Date().toISOString(),
        tables: {
          kiosk_events: events,
          kiosk_sessions: [...sessionIndex.values()],
          kiosk_api_events: events.map(toApiRow).filter(Boolean),
          kiosk_sales_join_keys: events.map(toSalesJoinRow).filter(Boolean)
        }
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/analytics/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ summary: currentSummary(), aggregates: aggregateEvents() })}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/analytics/kiosk-events") {
      await handleEventPost(req, res);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { accepted: false, error: error.message });
  }
});

if (require.main === module) {
  loadPersistedEvents().then(() => {
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Kiosk realtime event server listening on http://127.0.0.1:${PORT}`);
      console.log(`Analytics data directory: ${STORAGE_ROOT}`);
    });
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  aggregateEvents,
  findBlockedFields,
  loadPersistedEvents,
  normalizeEvent,
  redactBlockedFields,
  server,
  validateEvent
};
