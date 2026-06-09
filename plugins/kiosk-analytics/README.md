# Kiosk Analytics Plugin

First-party analytics bundle for the Fynd kiosk dashboard.

This plugin packages the live-only kiosk analytics system:

- `kioskDataLayer` and internal tag manager runtime.
- Kiosk-side one-script include: `scripts/kiosk-data-layer-plugin.js`.
- FashionFactory source adapter: `scripts/fashionfactory-selfcheckout-adapter.js`.
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
<script src="/plugins/kiosk-analytics/scripts/fashionfactory-selfcheckout-adapter.js"></script>
<script
  src="/plugins/kiosk-analytics/scripts/kiosk-data-layer-plugin.js"
  data-collector-url="http://127.0.0.1:8787/analytics/kiosk-events"
  data-source-url="https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790"
  data-company-id="59"
  data-application-id="688a0fc42f61c5197c8bbfc5"
  data-store-id="2790"
  data-data-source-id="2790"
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
- `GET /analytics/destinations`

## Tracking Feed

Use the collector as the first-party tracking endpoint. Browser/MCP inspection can validate the journey, but real-time data is produced by the checkout frontend, scanner bridge, API wrapper, payment/order callbacks, OMS, and device heartbeat emitters.

```txt
FashionFactory checkout -> kioskDataLayer -> KioskTagManager -> /analytics/kiosk-events -> dashboard/export APIs
```

## Test

```sh
node scripts/test-first-party-analytics.js
```

## Data Rules

- No mock events or random KPI generation.
- Raw PII is stripped in the browser runtime and quarantined by the collector if it appears server-side.
- Sales joins use hashed references only.
