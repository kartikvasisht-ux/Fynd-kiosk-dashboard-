# Fynd Kiosk analytics dashboard

Open `index.html` directly in a browser, or serve the folder locally for Playwright inspection.

This is a standalone live-only dashboard built from the exported Fynd Kiosk context. It includes:

- Command, Strategy, and Operational dashboard tabs.
- Global filters for date, city, brand, payment mode, device status, and store. Dimension filters unlock only after those dimensions arrive in live events.
- KPI cards, trend, funnel, leakage, store, brand, OMS, payment, and operational sections that render only real collector data.
- Empty states for missing feeds instead of mock values or simulated events.
- Data-readiness indicators showing which production inputs are currently present.

Additional implementation assets:

- `../plugins/kiosk-analytics/` — reusable Codex plugin bundle containing the analytics runtime, collector, schemas, docs, workflow, assets, and tests.
- `docs/kiosk_journey_api_spec.md` — journey, API, break-point, SDK, and dashboard data mapping spec.
- `docs/kiosk_touchpoint_map.md` — complete touchpoint map for session, screen, click, scan, cart, checkout, payment, order, and sales joins.
- `docs/realtime_data_flow.md` — real-time event flow architecture and cadence.
- `docs/live_only_realtime_plan.md` — no-sample-data production integration rules and acceptance checks.
- `docs/first_party_analytics_onboarding.md` — first-party dataLayer, collector, storage, aggregate, and sales-join onboarding guide.
- `docs/ruflo_integration.md` — Ruflo orchestration, workflow, browser QA, and observability bridge notes.
- `boilerplate/kiosk-event-tracker.js` — GA4-style frontend event tracking helper.
- `boilerplate/kiosk-data-layer-plugin.js` — kiosk-side one-script include that creates `window.kioskDataLayer`, installs tracking, wraps `fetch`, and emits bootstrap/screen events.
- `boilerplate/kiosk-tag-manager.js` — first-party GA4/GTM-like dataLayer runtime for kiosk touchpoints.
- `boilerplate/kiosk-event-contract.json` — event payload JSON schema.
- `boilerplate/kiosk-touchpoint-event-schema.json` — normalized touchpoint event schema.
- `boilerplate/kiosk-touchpoint-map.json` — machine-readable touchpoint map.
- `boilerplate/dashboard-data-map.json` — dashboard KPI-to-source mapping.
- `boilerplate/realtime-event-server.js` — first-party collector, validator, quarantine store, JSONL tables, aggregate APIs, and SSE stream.
- `boilerplate/test-first-party-analytics.js` — contract, PII, dedupe, persistence, aggregate, and export verification script.
- `boilerplate/ruflo-observability-exporter.js` — exports the live collector summary as a Ruflo-style observability snapshot.
- `ruflo/live-dashboard-ops.workflow.json` — Ruflo workflow template for live-only dashboard QA and operations checks.

Notes:

- This version does not render mock data.
- The dashboard connects to `GET /analytics/stream`, `GET /analytics/summary`, and `GET /analytics/aggregates` from the collector at `http://127.0.0.1:8787` by default.
- Start the collector with `node boilerplate/realtime-event-server.js`, then send real kiosk, payment, OMS, device, or backend events to `POST /analytics/kiosk-events`.
- Accepted events are stored in `.analytics-store` as append-only JSONL tables unless `ANALYTICS_DATA_DIR` is set.
- To point the page at another collector, open `index.html?collector=https://your-collector.example.com`.
- Ruflo is integrated as an optional orchestration/observability layer only. It must not generate analytics values for the dashboard.
- Flutter is not installed in this environment, so this prototype is HTML/CSS/JS. It can be ported into the user's Flutter project once the actual Flutter source folder is shared.
- Sensitive values captured from live API URLs must be masked before storing analytics or sharing specs.
