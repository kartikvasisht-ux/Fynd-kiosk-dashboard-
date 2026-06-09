# Fashion Factory First-Party Analytics Dashboard

Owned analytics dashboard for `https://fashionfactory.jiocommerce.io`.

This app does not depend on any third-party analytics collector, tag manager, or MCP plugin for data flow. It uses our own browser data layer, collector, JSONL event store, SSE stream, and dashboard.

```txt
FashionFactory site -> ffDataLayer -> /api/first-party/events -> JSONL store + SSE -> dashboard
```

## Stack

- Frontend: React, Tailwind CSS, Vite
- Backend: Node.js, Express
- Owned layer: browser SDK, collector API, JSONL event store, SSE stream
- Stream ID label: `14914518095`
- Stream URL: `https://fashionfactory.jiocommerce.io`
- Source journey: `https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790`
- Currency: `INR`

## Structure

```txt
frontend/
backend/
.env.example
README.md
```

## Setup

Backend:

```sh
cd backend
cp .env.example .env
npm install
npm run dev
```

Frontend:

```sh
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

## Backend API

- `POST /api/first-party/events`
- `POST /api/webhooks/fashionfactory`
- `POST /api/analytics/kiosk-events`
- `GET /api/first-party/summary`
- `GET /api/analytics/summary`
- `GET /api/first-party/stream`
- `GET /api/first-party/export`
- `GET /api/first-party/status`
- `GET /sdk/ff-analytics-layer.js`
- `GET /sdk/fashionfactory-source-bridge.js`

Events are stored durably in the append-only event file configured by `FIRST_PARTY_ANALYTICS_DIR`.

## Data-Layer Injection

For local QA:

```html
<script
  src="http://127.0.0.1:9090/sdk/ff-analytics-layer.js"
  data-collector-url="http://127.0.0.1:9090/api/first-party/events"
  data-source-url="https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790"
  data-company-id="59"
  data-application-id=""
  data-store-id=""
  data-kiosk-id=""
  data-ds="2790"
  data-stream-id="14914518095"
  data-stream-url="https://fashionfactory.jiocommerce.io">
</script>
```

For temporary source-session tracking before native app instrumentation is merged:

```html
<script
  src="https://your-api.example.com/sdk/fashionfactory-source-bridge.js"
  data-collector-url="https://your-api.example.com/api/first-party/events"
  data-source-url="https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790"
  data-company-id="59"
  data-ds="2790"
  data-stream-id="14914518095"
  data-stream-url="https://fashionfactory.jiocommerce.io">
</script>
```

For production, host the backend on HTTPS and use that collector URL:

```html
<script
  src="https://your-api.example.com/sdk/ff-analytics-layer.js"
  data-collector-url="https://your-api.example.com/api/first-party/events"
  data-source-url="https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790"
  data-company-id="59"
  data-application-id=""
  data-store-id=""
  data-kiosk-id=""
  data-ds="2790"
  data-stream-id="14914518095"
  data-stream-url="https://fashionfactory.jiocommerce.io">
</script>
```

Then push real events from app handlers:

```js
ffDataLayer.push({
  event: "checkout_start",
  event_type: "checkout",
  screen_name: "cart",
  journey_stage: "checkout",
  status: "started"
});
```

Or add attributes for automatic click capture:

```html
<button data-ff-action="payment_retry" data-ff-event="payment_retry_clicked" data-ff-screen="payment" data-ff-stage="payment">
  Retry
</button>
```

Blocked raw PII fields such as mobile, OTP, tokens, raw order IDs, and raw payment IDs are stripped by the SDK and by the collector.

## Dashboard

The dashboard updates from `/api/first-party/summary` and `/api/first-party/stream` only. With no real events, it shows waiting and empty states. It does not generate mock events, random metrics, or placeholder KPIs.

## Planning Document Coverage

The dashboard includes the planning document sections as live-only tabs:

- Executive Overview
- Kiosk Usage Analytics
- User Registration & Customer Analytics
- Customer Journey & Funnel Analytics
- Order & Revenue Analytics
- Payment Analytics
- Brand Health Analytics
- OMS & Operational Analytics
- Product & Cart Analytics
- Error & Support Analytics
- Device & Store Health Analytics

Global filters cover date range, brand, store, city, region, company ID, kiosk ID, session ID, order hash, cart hash, user hash, and app ID.
