/*
  First-party analytics verification for the kiosk dashboard.

  Run from fynd_kiosk_dashboard:
    node boilerplate/test-first-party-analytics.js
*/

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const createDataLayerPlugin = require("./kiosk-data-layer-plugin.js");
const serverModule = require("./realtime-event-server.js");
const tagManager = require("./kiosk-tag-manager.js");
const eventContract = require("./kiosk-event-contract.json");

const TIMESTAMP = "2026-05-25T00:00:00.000Z";

function validPayload(overrides = {}) {
  return {
    event_id: `evt-${overrides.event_name || "session_start"}`,
    event_name: "session_start",
    event_type: "session",
    timestamp: TIMESTAMP,
    screen_name: "welcome",
    session_id: "unit-session",
    status: "started",
    source_url: "/selfcheckout",
    company_id: "59",
    application_id: "kiosk-app",
    store_id: "store-001",
    ...overrides
  };
}

async function readJsonLines(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return content.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function waitForCollector(port, child) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (child.exitCode !== null) throw new Error(`collector exited early with ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/analytics/summary`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("collector did not start within 5 seconds");
}

async function postEvent(port, payload) {
  const response = await fetch(`http://127.0.0.1:${port}/analytics/kiosk-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function main() {
  const eventNames = eventContract.properties.event_name.enum;
  assert.strictEqual(eventNames.length, 66, "contract should include the current complete event set");

  eventNames.forEach((eventName) => {
    const normalized = serverModule.normalizeEvent(validPayload({
      event_id: `evt-contract-${eventName}`,
      event_name: eventName
    }));
    assert.deepStrictEqual(serverModule.validateEvent(normalized), [], `${eventName} should validate`);
  });

  const missingOptional = serverModule.normalizeEvent({
    event_name: "scan_attempt",
    session_id: "missing-optional",
    timestamp: TIMESTAMP
  });
  assert.strictEqual(missingOptional.screen_name, "unknown");
  assert.strictEqual(missingOptional.source_url, "unknown");

  const piiFields = serverModule.findBlockedFields({
    mobile: "9999999999",
    nested: {
      otp: "123456",
      authorization: "Bearer secret"
    }
  });
  assert.deepStrictEqual(piiFields.sort(), ["mobile", "nested.authorization", "nested.otp"]);

  tagManager.configure({
    context: {
      company_id: "59",
      application_id: "kiosk-app",
      store_id: "store-001"
    }
  });
  const normalizedClientEvent = tagManager.normalizeMessage({
    event: "mobile_number_submit",
    session_id: "client-session",
    screen_name: "mobile_entry",
    mobile: "9999999999",
    otp: "123456",
    source_url: "/auth"
  });
  assert.strictEqual(normalizedClientEvent.event_name, "mobile_number_submit");
  assert.strictEqual(normalizedClientEvent.mobile, undefined);
  assert.strictEqual(normalizedClientEvent.otp, undefined);
  assert.strictEqual(normalizedClientEvent.company_id, "59");

  const fakeRoot = {
    KIOSK_ANALYTICS_CONFIG: { autoInstall: false },
    location: { pathname: "/selfcheckout", search: "?_ds=2790" },
    fetch: async () => ({ status: 200, json: async () => ({ ok: true }) })
  };
  fakeRoot.window = fakeRoot;
  fakeRoot.KioskTagManager = {
    install(options) {
      fakeRoot.installedOptions = options;
      return this;
    },
    wrapFetch(fetchImpl) {
      const wrapped = async (...args) => fetchImpl(...args);
      wrapped.__wrappedByTest = true;
      return wrapped;
    },
    trackScreenView(screenName, params = {}) {
      fakeRoot.screenView = { screenName, params };
      fakeRoot.kioskDataLayer.push({
        event: params.event_name || `${screenName}_view`,
        screen_name: screenName,
        ...params
      });
    },
    setContext(context) {
      fakeRoot.context = { ...(fakeRoot.context || {}), ...context };
    }
  };

  const dataLayerPlugin = createDataLayerPlugin(fakeRoot);
  assert.ok(Array.isArray(fakeRoot.kioskDataLayer), "kioskDataLayer should be created immediately");
  await dataLayerPlugin.install({
    collectorUrl: "http://collector.internal/analytics/kiosk-events",
    screenName: "welcome",
    screenEvent: "welcome_screen_view",
    autoWrapFetch: false,
    context: {
      company_id: "59",
      application_id: "kiosk-app",
      store_id: "store-001"
    }
  });
  assert.strictEqual(fakeRoot.installedOptions.collectorUrl, "http://collector.internal/analytics/kiosk-events");
  assert.strictEqual(fakeRoot.installedOptions.context.company_id, "59");
  assert.ok(fakeRoot.kioskDataLayer.some((entry) => entry.event === "kiosk_app_bootstrap_started"));
  assert.ok(fakeRoot.kioskDataLayer.some((entry) => entry.event === "welcome_screen_view"));
  dataLayerPlugin.push("scan_attempt", { session_id: "client-session", screen_name: "scan_home" });
  assert.ok(fakeRoot.kioskDataLayer.some((entry) => entry.event === "scan_attempt"));

  const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), "kiosk-analytics-"));
  const port = 19000 + (process.pid % 1000);
  const serverPath = path.join(__dirname, "realtime-event-server.js");
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      ANALYTICS_DATA_DIR: storeDir
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForCollector(port, child);

    const accepted = await postEvent(port, validPayload({
      event_id: "evt-integration-session",
      event_name: "session_start"
    }));
    assert.strictEqual(accepted.status, 202);
    assert.strictEqual(accepted.body.accepted, true);

    const duplicate = await postEvent(port, validPayload({
      event_id: "evt-integration-session",
      event_name: "session_start"
    }));
    assert.strictEqual(duplicate.status, 200);
    assert.strictEqual(duplicate.body.duplicate, true);

    const apiFailure = await postEvent(port, validPayload({
      event_id: "evt-integration-api",
      event_name: "api_request_failure",
      event_type: "api",
      status: "failure",
      api_endpoint: "/payment/options",
      api_status: 500,
      api_duration_ms: 340,
      failure_reason: "test_failure"
    }));
    assert.strictEqual(apiFailure.status, 202);

    const paymentInit = await postEvent(port, validPayload({
      event_id: "evt-integration-payment-init",
      event_name: "payment_init",
      event_type: "payment",
      status: "started",
      payment_session_id_hash: "pay-hash-1",
      amount: 1299,
      currency: "INR"
    }));
    assert.strictEqual(paymentInit.status, 202);

    const paymentSuccess = await postEvent(port, validPayload({
      event_id: "evt-integration-payment-success",
      event_name: "payment_success",
      event_type: "payment",
      status: "success",
      payment_session_id_hash: "pay-hash-1",
      order_id_hash: "order-hash-1",
      amount: 1299,
      currency: "INR"
    }));
    assert.strictEqual(paymentSuccess.status, 202);

    const quarantined = await postEvent(port, validPayload({
      event_id: "evt-integration-pii",
      event_name: "mobile_number_submit",
      event_type: "input",
      status: "submitted",
      mobile: "9999999999"
    }));
    assert.strictEqual(quarantined.status, 422);
    assert.strictEqual(quarantined.body.quarantined, true);
    assert.ok(quarantined.body.blocked_fields.includes("mobile"));

    const aggregateResponse = await fetch(`http://127.0.0.1:${port}/analytics/aggregates`);
    assert.strictEqual(aggregateResponse.ok, true);
    const aggregatePayload = await aggregateResponse.json();
    assert.strictEqual(aggregatePayload.aggregates.counts.events, 4);
    assert.strictEqual(aggregatePayload.aggregates.counts.api_failures, 1);
    assert.strictEqual(aggregatePayload.aggregates.rates.payment_success_rate, 100);

    const exportResponse = await fetch(`http://127.0.0.1:${port}/analytics/export`);
    const exportPayload = await exportResponse.json();
    assert.strictEqual(exportPayload.tables.kiosk_events.length, 4);
    assert.strictEqual(exportPayload.tables.kiosk_api_events.length, 1);
    assert.strictEqual(exportPayload.tables.kiosk_sales_join_keys.length, 2);

    const eventRows = await readJsonLines(path.join(storeDir, "kiosk_events.jsonl"));
    const sessionRows = await readJsonLines(path.join(storeDir, "kiosk_sessions.jsonl"));
    const apiRows = await readJsonLines(path.join(storeDir, "kiosk_api_events.jsonl"));
    const salesRows = await readJsonLines(path.join(storeDir, "kiosk_sales_join_keys.jsonl"));
    const quarantineRows = await readJsonLines(path.join(storeDir, "kiosk_quarantine.jsonl"));
    assert.strictEqual(eventRows.length, 4);
    assert.strictEqual(sessionRows.length, 1);
    assert.strictEqual(apiRows.length, 1);
    assert.strictEqual(salesRows.length, 2);
    assert.strictEqual(quarantineRows.length, 1);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    if (child.exitCode && child.exitCode !== 0 && child.signalCode !== "SIGTERM") {
      throw new Error(`collector failed\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }
  }
}

main().then(() => {
  console.log("First-party kiosk analytics tests passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
