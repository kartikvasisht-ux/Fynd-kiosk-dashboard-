#!/usr/bin/env node
/*
  Ruflo observability bridge for the Fynd Kiosk dashboard.

  Reads the live collector summary and prints a Ruflo-compatible metric snapshot.
  It does not create events, infer store data, or generate fallback KPI values.

  Usage:
    node boilerplate/ruflo-observability-exporter.js
    COLLECTOR_URL=http://127.0.0.1:8787 node boilerplate/ruflo-observability-exporter.js
*/

const collectorUrl = process.env.COLLECTOR_URL || "http://127.0.0.1:8787";

async function readJson(url) {
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

function metric(name, type, value, unit, tags = {}) {
  return {
    name,
    type,
    value,
    unit,
    tags
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function main() {
  const payload = await readJson(`${collectorUrl}/analytics/summary`);
  const summary = payload.summary || {};
  const recentEvents = Array.isArray(payload.recent_events) ? payload.recent_events : [];
  const timestamp = new Date().toISOString();

  const snapshot = {
    type: "metric-snapshot",
    namespace: "observability",
    source: "fynd-kiosk-dashboard",
    collector_url: collectorUrl,
    timestamp,
    correlationId: `fynd-kiosk-${summary.last_event_at || timestamp}`,
    metrics: [
      metric("kiosk.events_processed", "counter", toNumber(summary.events_processed) || 0, "events"),
      metric("kiosk.events_per_minute", "gauge", toNumber(summary.events_per_minute) || 0, "events/min"),
      metric("kiosk.api_latency_ms", "gauge", toNumber(summary.api_latency_ms), "ms"),
      metric("kiosk.queue_depth", "gauge", toNumber(summary.queue_depth) || 0, "events"),
      metric("kiosk.failures", "counter", toNumber(summary.failures) || 0, "events"),
      metric("kiosk.recent_events", "gauge", recentEvents.length, "events")
    ],
    recent_events: recentEvents.slice(0, 20).map((event) => ({
      event_id: event.event_id,
      event_name: event.event_name,
      occurred_at: event.occurred_at,
      source: event.source,
      screen_name: event.screen_name,
      store_id: event.store_id,
      api_status: event.api_status,
      api_duration_ms: event.api_duration_ms,
      failure_reason: event.failure_reason
    }))
  };

  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`ruflo-observability-exporter failed: ${error.message}\n`);
  process.exitCode = 1;
});
