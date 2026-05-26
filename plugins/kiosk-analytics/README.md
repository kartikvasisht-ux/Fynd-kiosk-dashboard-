# Kiosk Analytics Plugin

First-party analytics bundle for the Fynd kiosk dashboard.

This plugin packages the live-only kiosk analytics system:

- `kioskDataLayer` and internal tag manager runtime.
- Kiosk-side one-script include: `scripts/kiosk-data-layer-plugin.js`.
- Existing tracker bridge.
- Collector API with validation, PII quarantine, `event_id` dedupe, JSONL storage, SSE, aggregate APIs, and export shape.
- Touchpoint contracts and dashboard data maps.
- Onboarding and journey documentation.
- Ruflo observability workflow bridge.
- Verification tests.

## Run

```sh
node scripts/realtime-event-server.js
```

## Kiosk Include

```html
<script
  src="/plugins/kiosk-analytics/scripts/kiosk-data-layer-plugin.js"
  data-collector-url="http://127.0.0.1:8787/analytics/kiosk-events"
  data-company-id="59"
  data-application-id="unknown"
  data-store-id="unknown"
  data-kiosk-id="unknown"
  data-screen-name="welcome"
  data-screen-event="welcome_screen_view">
</script>
```

Collector endpoints:

- `POST /analytics/kiosk-events`
- `GET /analytics/stream`
- `GET /analytics/summary`
- `GET /analytics/aggregates`
- `GET /analytics/export`

## Test

```sh
node scripts/test-first-party-analytics.js
```

## Data Rules

- No mock events or random KPI generation.
- Raw PII is stripped in the browser runtime and quarantined by the collector if it appears server-side.
- Sales joins use hashed references only.
