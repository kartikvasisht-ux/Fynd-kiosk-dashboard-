# First-Party Kiosk Analytics Onboarding

This dashboard now uses a first-party GA4/GTM-like analytics layer. Google GA4/GTM is not the primary collector. The kiosk, backend wrappers, scanner bridge, payment callbacks, OMS, and device/ops sources should send real events to the internal collector.

## Runtime Flow

1. Kiosk frontend initializes `window.kioskDataLayer = window.kioskDataLayer || []`.
2. App code or DOM attributes push journey events into the data layer.
3. `boilerplate/kiosk-tag-manager.js` enriches the event with session, screen, journey, source URL, and configured kiosk context.
4. The runtime strips blocked raw PII fields before sending.
5. The collector validates, quarantines unsafe/invalid events, deduplicates by `event_id`, writes JSONL tables, and broadcasts updates through SSE.
6. The dashboard reads only `GET /analytics/stream`, `GET /analytics/summary`, and `GET /analytics/aggregates`.

## Frontend Install

Preferred kiosk include:

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

This file creates `window.kioskDataLayer`, loads `kiosk-tag-manager.js` from the same plugin folder, installs the tag manager, wraps `fetch`, emits `kiosk_app_bootstrap_started`, emits the configured first screen view, and captures clicks from `data-kiosk-*` attributes.

Use direct calls when the app controls the interaction:

```js
kioskDataLayer.push({
  event: "cart_add_success",
  event_type: "cart",
  screen_name: "cart",
  journey_stage: "cart",
  status: "success",
  session_id,
  cart_reference: { cart_id_hash, line_item_id, quantity },
  product_id,
  brand_id,
  amount,
  currency: "INR",
  source_url: "/cart/addItems"
});
```

Use DOM attributes where direct app code is not practical:

```html
<button
  data-kiosk-action="payment_retry"
  data-kiosk-event="payment_retry_clicked"
  data-kiosk-screen="payment_methods"
  data-kiosk-stage="payment">
  Retry
</button>
```

## Required Collector Fields

Every accepted event must include:

- `session_id`
- `event_name`
- `event_type`
- `timestamp`
- `screen_name`
- `status`
- `source_url`

Whenever known, also include:

- `company_id`
- `application_id`
- `store_id`
- `kiosk_id` or `device_session_id`

Use `unknown` only when the source genuinely cannot know the value.

## Blocked Raw Fields

These fields must not enter analytics storage:

- `mobile`
- `mobileNo`
- `phone`
- `otp`
- `raw_user_id`
- `raw_cart_id`
- `raw_order_id`
- `raw_transaction_id`
- `token`
- `authorization`
- `auth_token`
- `access_token`
- `refresh_token`

The browser runtime strips these before collection. The server quarantines any payload that still contains them.

## Storage Tables

The collector writes append-only JSONL tables in `.analytics-store` by default:

- `kiosk_events.jsonl`
- `kiosk_sessions.jsonl`
- `kiosk_api_events.jsonl`
- `kiosk_sales_join_keys.jsonl`
- `kiosk_quarantine.jsonl`

Override the storage directory with:

```sh
ANALYTICS_DATA_DIR=/path/to/store node boilerplate/realtime-event-server.js
```

## API Outputs

- `POST /analytics/kiosk-events`: accepted/quarantined touchpoint ingestion.
- `GET /analytics/stream`: SSE stream for live dashboard updates.
- `GET /analytics/summary`: live counters, recent events, and aggregates.
- `GET /analytics/aggregates`: funnel, conversion, payment, API, device, and store rollups.
- `GET /analytics/export`: export-ready event/session/API/sales-join table shape.

## Sales Join Fields

Sales and payment matching should use:

- `company_id`
- `application_id`
- `store_id`
- `session_id`
- `cart_id_hash`
- `order_id_hash`
- `payment_session_id_hash`
- `payment_order_id_hash`
- `transaction_id_hash`
- `article`
- `barcode_hash`
- `product_id`
- `brand_id`
- `line_item_id`
- `quantity`
- `amount`
- `currency`
- `status`
- `timestamp`

## Verification

Run:

```sh
node boilerplate/test-first-party-analytics.js
```

The test validates the event contract, client PII stripping, server PII quarantine, duplicate `event_id` handling, JSONL persistence, aggregate APIs, export shape, and sales join rows.
