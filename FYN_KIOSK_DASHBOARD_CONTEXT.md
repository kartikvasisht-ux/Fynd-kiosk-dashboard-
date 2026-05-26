# Fynd Kiosk Dashboard Context

This note summarizes the shared conversation export so Codex can work on the dashboard without losing the earlier product, data, and journey context.

## Project Goal

Build a polished internal analytics dashboard for Fynd Kiosk / FYND & GO self-checkout. The dashboard should convert kiosk interaction, order, payment, store, device, and support signals into actionable views for leadership, product/brand teams, and operations/store teams.

The user now mentions a Flutter dashboard implementation. The conversation export mostly describes earlier React/artifact prototypes and specs. The actual Flutter source folder/repo has not been provided in this workspace yet.

## Primary Dashboard Structure

Use three main decision-level tabs:

1. Command
   - Audience: leadership / business owners.
   - Purpose: answer whether the kiosk network is viable, profitable, and healthy.
   - KPIs: total revenue, revenue per kiosk, MoM order growth, conversion rate, kiosk utility rate, payment success rate, incremental lift, network uptime.
   - Visuals: revenue trend, conversion funnel, revenue leakage, RAG status by store, return rate trend.

2. Strategy
   - Audience: product, category, and brand teams.
   - Purpose: answer where the funnel leaks and which brands/products create value.
   - KPIs: stage drop-off, checkout velocity, brand conversion, brand velocity, scan-to-cart rate, product conversion, returning user rate, multi-brand cart rate.
   - Visuals: funnel with drop-offs, brand table, brand share of wallet, product behavior matrix, cohort table, OOS scan rate, session segmentation.

3. Operational
   - Audience: store managers and ops teams.
   - Purpose: answer whether stores, OMS, payments, devices, and support flows are breaking.
   - KPIs: OMS place-to-confirm time, pending orders over SLA, SLA breach count, device uptime, payment failure rate, app crash rate, friction index, cancellation rate by store.
   - Visuals: live OMS latency tracker, payment failure Pareto, store RAG health, scanner error rate, network error heatmap, peak-hour staffing heatmap, first-response resolution time, support click trail.

## Global Dashboard Behavior

- Persistent global filters across tabs: date range, brand, store, city/region, payment mode, device status.
- KPI cards should show period-over-period delta and formula/info tooltip.
- Tables should support sorting.
- RAG colors should be consistent: green healthy, amber warning, red critical.
- Avoid hiding data-readiness gaps. If a metric is not connected yet, show it cleanly as not connected rather than faking production data.

## Current Data Reality

Known data already available:

- Sales / revenue.
- Order status.

Missing or needs collection:

- Session and funnel events.
- Payment lifecycle events and failure reasons.
- Device telemetry and kiosk heartbeat.
- Scanner errors.
- App crashes.
- Catalog/inventory state at store level.
- User identity/cohort data.
- Store floor baseline AOV for incremental lift.

Recommended sources:

- Kiosk frontend instrumentation for session, screen, scan, funnel, support, timeout, and manual barcode events.
- Fynd/FYND & GO APIs or webhooks for cart, order, brand, product, and payment-linked events where available.
- Payment gateway webhooks for payment init/success/failure and failure reasons.
- Sentry webhooks for app error/crash rate. Sentry was observed firing real errors.
- MDM or app heartbeat endpoint for kiosk/device uptime, status, app version, scanner health, and network status.
- OMS/order system for order lifecycle, SLA breach, cancellation, return, confirmation latency.
- Catalog/inventory/ERP for OOS scan rate, product-not-found, inventory sync gaps.
- POS/store sales for floor AOV baseline.

## Captured Real Kiosk Journey

Captured target URL:

`https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790`

Observed store context:

- Store: Fashion Factory Malad Umang Towers.
- Store/session parameter: `2790`.
- Device display showed "Device ID: not found | 2790", suggesting the URL carried session/store context but not a registered physical device ID.
- Application ID observed: `688a0fc42f61c5197c8bbfc5`.

Journey steps observed:

1. Landing / attract screen
   - CTA: "Tap to Get Started".
   - APIs included app info, app config, seller details, installation data, feature flags, platform config, self-checkout seller config, legal docs, store details, in-stock location query, and session check.
   - Session check returned 401 before login, expected for anonymous user.

2. Mobile number entry
   - On-screen numeric keypad was required; direct JS/keyboard entry did not update React state reliably.
   - `forms/selfcheckout/fields` returned 400 and triggered Sentry reporting.

3. OTP send
   - OTP send used standard application login OTP endpoint.
   - OTP is 4 digits.
   - Resend timer is around 60 seconds.

4. OTP verify
   - Verify uses FYND & GO extension route: `/self-checkout/verify-otp`.
   - Failed OTP returned 400 and showed a red toast while keeping user on OTP page.
   - Resend OTP used a different mobile send endpoint.
   - Successful verify moved from `/welcomepage` to `/homepage`.

5. Scan / manual barcode entry
   - Homepage after login showed "Let's Start Scanning".
   - Manual link: "Having trouble scanning? Enter product barcode".
   - Modal helper says "Enter 12 digit product number", but a 13-digit EAN barcode was accepted. This is a UX copy bug.

6. Add to cart
   - Test barcode went directly from manual entry to cart.
   - Core APIs: `POST /cart/addItems`, `POST /cart/updateCartUser`, `GET /cart/platformGetCart`, `GET /cart/vouchers`.
   - `cart/addItems` took about 3.3 seconds in the observed session, which is slow for a physical kiosk flow.
   - Product observed: Giordano sunglasses, color grey, free size, MRP around Rs. 3,999, selling price around Rs. 299.
   - Cart UI included item count, clear all, carry bag add-on, staff handoff for unavailable size, offers/coupons, GST invoice option, price summary, and checkout CTA.

7. Checkout / payment selection
   - Route moved from `/cart` to `/cart/payment`.
   - APIs observed: payment aggregator key config, cart add address, cart refetch.
   - Payment screen showed a single payment method: "Jio Partner Pay".
   - Capture stopped before clicking payment to avoid creating a real charge.

## Observed Bugs / Risks

- `forms/selfcheckout/fields` returns 400 during the login journey.
- Repeated `/selfcheckout/undefined` or `/selfcheckout/cart/undefined` calls suggest missing variables in telemetry/navigation events.
- Manual barcode modal asks for 12 digits but accepts/needs 13-digit EAN in the tested case.
- `cart/addItems` latency around 3.3 seconds needs performance review.
- Single payment method means payment analytics may depend heavily on Jio Partner Pay's failure taxonomy.
- Do not trigger real payment flows without explicit user confirmation.

## GA4-Style Event Taxonomy To Implement

Minimum frontend events:

- `kiosk_session_start`
- `screen_view`
- `tap_get_started`
- `mobile_number_submit`
- `otp_send_success`
- `otp_send_failure`
- `otp_resend`
- `otp_verify_success`
- `otp_verify_failure`
- `scan_screen_view`
- `manual_barcode_open`
- `manual_barcode_submit`
- `scan_attempt`
- `scan_success`
- `scan_failure`
- `product_not_found`
- `oos_scan`
- `cart_add_success`
- `cart_add_failure`
- `cart_view`
- `support_click`
- `checkout_start`
- `payment_methods_view`
- `payment_init`
- `payment_success`
- `payment_failure`
- `order_complete`
- `session_timeout`
- `app_crash`

Useful common properties:

- `timestamp`
- `session_id`
- `kiosk_id`
- `device_session_id`
- `store_id`
- `store_name`
- `city`
- `region`
- `user_id_hash`
- `brand_id`
- `product_id`
- `barcode`
- `cart_id`
- `order_id`
- `payment_mode`
- `failure_reason`
- `amount`
- `app_version`
- `network_status`
- `screen_name`
- `duration_ms`

## Backend Data Model Direction

Core shapes from previous spec:

- `KioskEvent`: event stream for session/funnel/support/technical events.
- `Order`: order lifecycle, status, timestamps, item list, payment attempts.
- `Store`: store metadata, city/region, floor AOV, SLA threshold.
- `Device`: kiosk status, heartbeat, uptime, scanner errors, app version.
- `User`: hashed identity/cohort fields for returning user and retention analytics.

## Existing Prototype Decisions

Earlier React artifact decisions:

- Single-file React prototype with mock data.
- Tailwind CSS, Recharts, lucide-react.
- Later changed to standalone mode with no backend calls by default.
- `API_BASE` defaulted to null so the dashboard uses fallback mock data and shows no failed backend banner.
- Future backend can be enabled via a configured API URL, previously described as `window.__KIOSK_DASHBOARD_API`.

For the Flutter version:

- Preserve the same information architecture and KPI definitions unless the user asks to redesign.
- First inspect `pubspec.yaml`, `lib/`, routing, state management, chart libraries, and mock/real data layer before editing.
- Map the Command/Strategy/Operational tabs into existing Flutter navigation and design patterns.
- Keep mock fallback data until real API contracts are available.

## Next Step For Codex

Ask the user for the actual Flutter project path, zip, or GitHub repo. The current Codex workspace contains the exported conversations only, not the Flutter source code.

When the Flutter source is available:

1. Inspect project structure and dependencies.
2. Identify dashboard entry screen, routing, state management, and data models.
3. Compare current UI/KPIs against this context.
4. Implement the smallest safe set of changes requested by the user.
5. Run Flutter analyzer/tests/build if available.
6. Start the app or provide exact run instructions if emulator/device setup is not available.
