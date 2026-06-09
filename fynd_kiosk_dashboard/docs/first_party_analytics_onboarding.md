# First-Party Kiosk Analytics Onboarding

This dashboard now uses a first-party GA4/GTM-like analytics layer. Google GA4/GTM is not the primary collector. The canonical kiosk source is `https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790`; the kiosk, backend wrappers, scanner bridge, payment callbacks, OMS, and device/ops sources should send real events to the internal collector.

## Runtime Flow

1. Kiosk frontend initializes `window.kioskDataLayer = window.kioskDataLayer || []`.
2. App code or DOM attributes push journey events into the data layer.
3. `boilerplate/kiosk-tag-manager.js` enriches the event with session, screen, journey, source URL, and configured kiosk context.
4. The runtime strips blocked raw PII fields before sending.
5. The collector validates, quarantines unsafe/invalid events, deduplicates by `event_id`, writes JSONL tables, and broadcasts updates through SSE.
6. The dashboard reads only `GET /analytics/stream`, `GET /analytics/summary`, and `GET /analytics/aggregates`.

## Tracking Tool Feed

Treat the collector as the tracking tool ingestion endpoint. The production path is:

```txt
FashionFactory self-checkout -> kioskDataLayer -> KioskTagManager -> /analytics/kiosk-events -> dashboard/export APIs -> optional GA4/Mixpanel/AWS mirror
```

MCP/browser tools are useful for inspection and QA only. They can open the self-checkout URL, verify DOM attributes, observe network requests, and confirm dashboard state, but they do not create production analytics traffic. Real-time data starts when the FashionFactory checkout frontend and server-side sources emit accepted events to the collector.

For production, the collector must be reachable over HTTPS from `https://fashionfactory.jiocommerce.io`:

```txt
KIOSK_ANALYTICS_COLLECTOR_URL=https://your-collector.example.com/analytics/kiosk-events
```

Keep `127.0.0.1` only for local QA. Real kiosks cannot post to a developer machine's localhost.

## Frontend Install

Preferred kiosk include:

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

The adapter configures the FashionFactory source URL, company, application, and `_ds=2790` context before the plugin installs. The plugin creates `window.kioskDataLayer`, loads `kiosk-tag-manager.js` from the same plugin folder, installs the tag manager, wraps `fetch`, emits `kiosk_app_bootstrap_started`, emits the configured first screen view, emits store/device context readiness events, and captures clicks from `data-kiosk-*` attributes.

In a React or React Native self-checkout entrypoint, call the adapter helpers from real handlers:

```js
FashionFactorySelfCheckoutAnalytics.trackClick("tap_get_started", {
  event_name: "tap_get_started",
  screen_name: "welcome",
  journey_stage: "welcome"
});

FashionFactorySelfCheckoutAnalytics.trackScanner("scan_success", {
  screen_name: "scan_home",
  barcode_hash,
  article
});
```

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
- `GET /analytics/destinations`: configured GA4, Mixpanel, and Amplify destination status.

## Optional Destinations: GA4, Mixpanel, Amplify

The collector remains the first-party source of truth. Optional destinations mirror accepted, validated events after they are stored locally. A vendor outage must not block dashboard ingestion.

GA4 Measurement Protocol is suitable for kiosks and POS-style devices, but it must be manually programmed and should include `session_id` for session attribution. Set:

```sh
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=your_measurement_protocol_secret
```

Mixpanel Track API accepts an event name and properties payload. Set:

```sh
MIXPANEL_TOKEN=your_mixpanel_project_token
MIXPANEL_ENDPOINT=https://api.mixpanel.com/track
```

Amplify Analytics requires AWS resources such as Pinpoint or Kinesis/Firehose. Use it when the kiosk app already has AWS Amplify configuration. In Amplify JS v6, Pinpoint events are recorded with `record` from `aws-amplify/analytics`; Kinesis/Firehose use their own analytics subpaths. Keep raw PII out of attributes and send only the same hashed references used by the collector.

For production real-time ingestion, expose the collector over HTTPS and bind it publicly:

```sh
HOST=0.0.0.0 \
PORT=8787 \
GA4_MEASUREMENT_ID=G-XXXXXXXXXX \
GA4_API_SECRET=... \
MIXPANEL_TOKEN=... \
node boilerplate/realtime-event-server.js
```

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
