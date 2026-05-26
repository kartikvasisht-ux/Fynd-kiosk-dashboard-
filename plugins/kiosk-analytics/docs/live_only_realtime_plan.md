# Live-only dashboard plan

This dashboard must never show business numbers that were typed into the frontend, randomized in the browser, or inferred without a real source event.

## Non-negotiable rule

- If a metric has no live source, show a waiting or empty state.
- If an event does not contain a dimension, do not invent it.
- If an API does not return a value, do not backfill a default value.
- Test events can be used for engineering verification, but they must not be presented as production performance.

## Required production feeds

| Feed | Purpose | Minimum fields |
|---|---|---|
| Kiosk frontend events | Journey, scan, cart, support, session health | `event_id`, `event_name`, `occurred_at`, `session_id`, `screen_name`, `store_id`, `source` |
| Payment events/webhooks | Payment success, failure, value, reason | `event_name`, `amount`, `payment_mode`, `failure_reason`, `order_id_hash`, `store_id` |
| OMS events | Order placement, confirmation, cancellation, SLA | `event_name`, `order_id_hash`, `order_placed_at`, `order_confirmed_at`, `oms_elapsed_ms`, `store_id` |
| Device/MDM heartbeat | Uptime, kiosk health, offline stores | `event_name`, `kiosk_id`, `device_status`, `store_id`, `app_version` |
| Catalog/inventory events | OOS, product-not-found, product conversion | `event_name`, `product_id`, `brand_id`, `store_id`, `barcode_hash` |

## Implementation path

1. Instrument the kiosk app with `boilerplate/kiosk-event-tracker.js`.
2. Send all events to `POST /analytics/kiosk-events`.
3. Use `GET /analytics/stream` for the dashboard latest-events panel.
4. Add aggregate APIs for revenue, conversion, payment success, uptime, OMS SLA, and brand/product rollups.
5. Keep every dashboard section in empty state until its real feed is available.
6. Add monitoring for event silence by store, kiosk, and source.

## Dashboard mapping

| Section | Live source |
|---|---|
| Command KPIs | Collector summary, order/payment events, session events |
| Revenue trend | `payment_success` or `order_complete` events with `amount` |
| Funnel | Bootstrap, auth, scan, cart, payment, order events |
| Store status | Live events with `store_id` or `store_name` |
| Strategy KPIs | Scan, barcode, cart, product, brand, repeat user events |
| Operational KPIs | API status, context gaps, payment failures, OMS, device heartbeat |

## Acceptance criteria

- Search the dashboard code for `Math.random`, static KPI arrays, and sample event arrays. None should drive rendered dashboard data.
- Open the dashboard with the collector stopped. It should show offline/waiting states, not fake performance.
- Start the collector with no events. It should show connected/waiting states and zero collector counters only.
- Send a real event from the kiosk app. The event should appear in the stream and update only the metrics it can truthfully support.
