₹---
name: kiosk-analytics
description: Use when implementing, validating, or onboarding the Fynd kiosk first-party analytics layer, including kioskDataLayer events, touchpoint schemas, live-only collector APIs, dashboard aggregates, PII quarantine, and sales join keys.
---

# Kiosk Analytics

Use this plugin when working on the Fynd kiosk dashboard's first-party GA4/GTM-like analytics layer.

## Core Files

- `scripts/kiosk-tag-manager.js`: browser dataLayer runtime.
- `scripts/kiosk-data-layer-plugin.js`: kiosk-side one-script include that creates `window.kioskDataLayer`, installs the runtime, wraps `fetch`, and emits bootstrap/screen events.
- `scripts/kiosk-event-tracker.js`: existing tracker bridge that can route through `kioskDataLayer`.
- `scripts/realtime-event-server.js`: first-party collector with validation, quarantine, JSONL storage, SSE, aggregates, and export APIs.
- `scripts/test-first-party-analytics.js`: verification script.
- `contracts/kiosk-event-contract.json`: accepted event names and payload contract.
- `contracts/kiosk-touchpoint-event-schema.json`: normalized event schema.
- `contracts/kiosk-touchpoint-map.json`: journey touchpoint map.
- `contracts/dashboard-data-map.json`: dashboard KPI-to-source mapping.
- `docs/first_party_analytics_onboarding.md`: onboarding guide.

## Rules

- Keep the dashboard live-only. Do not add mock events, random KPI loops, sample event arrays, or fake fallback values.
- Use `unknown` only when the source genuinely cannot know a required field.
- Never store raw mobile numbers, OTPs, auth tokens, raw cart IDs, raw order IDs, or raw payment transaction IDs.
- Prefer hashed join keys: `cart_id_hash`, `order_id_hash`, `payment_session_id_hash`, `payment_order_id_hash`, and `transaction_id_hash`.
- Keep `event_id` stable per emitted event so the collector can deduplicate.

## Verification

From the plugin root:

```sh
node scripts/test-first-party-analytics.js
```

Start the collector:

```sh
node scripts/realtime-event-server.js
```

The dashboard should read:

- `GET /analytics/stream`
- `GET /analytics/summary`
- `GET /analytics/aggregates`

and events should be ingested through:

- `POST /analytics/kiosk-events`
