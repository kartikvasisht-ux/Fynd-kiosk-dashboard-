# Fynd Kiosk customer journey and real-time analytics spec

Date captured: 2026-05-19  
Journey URL: `https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790`  
Barcode used: `8905888014083`  
Store observed: `FASHION FACTORY-MALAD-UMANG TOWERS`  
Company ID observed: `59`  
Application ID observed: `688a0fc42f61c5197c8bbfc5`

This document is the working implementation spec for turning the kiosk customer journey into a GA4-style real-time analytics layer and dashboard data feed.

## Capture boundary

The journey was captured from attract screen through payment-method selection. The flow was intentionally stopped before clicking `Jio Partner Pay` so no payment intent or real charge was initiated.

Sensitive values such as mobile number, user ID, auth tokens, and cart IDs must be masked in logs, analytics events, and dashboards. Use placeholders such as `<mobile_hash>`, `<user_id_hash>`, and `<cart_id_hash>`.

## SDK / platform notes

The Fynd Platform REST API documentation states that Platform APIs support:

- Company-level access using `company_id`.
- Application-level access using both `company_id` and `application_id`.
- Official client libraries for JavaScript, Java, Kotlin, Swift, and Python.
- Client credentials authentication through `/oauth/token`, where requests use a basic auth header made from `client_id:client_secret`.
- Authenticated Platform API calls using `Authorization: Bearer <access_token>`.

Relevant docs:

- `https://partners.jiocommerce.io/help/docs/sdk/latest/platform/client-libraries#introduction`
- `https://platform.jiocommerce.io/company/59/home`

The platform company URL redirected to login in this capture, so admin-side settings, client creation, and dashboards require authenticated platform access.

## Happy path journey

| Step | Screen | User action | Result | Key APIs observed |
|---|---|---|---|---|
| 0 | Attract screen | Open kiosk URL with `_ds=2790` | Welcome page loads | app info, app config, seller details, installation data, feature flags, platform config, seller config, legal docs, store details, stock location, session check |
| 1 | Welcome | Tap `Tap to Get Started` | Mobile entry opens | `GET /selfcheckout/forms/selfcheckout/fields` returned 400, Sentry envelope sent |
| 2 | Mobile / OTP | Existing session was available in current browser context | Scan homepage became available | OTP send and verify were present in network log from session state |
| 3 | Scan homepage | Click manual barcode entry | Manual barcode modal opens | No new business API required for modal open |
| 4 | Manual barcode | Enter `8905888014083`, click Continue | Product added and cart opens | `POST /cart/addItems`, `PUT /cart/updateCartUser`, `GET /cart/platformGetCart`, packaging material collection, vouchers |
| 5 | Cart | Click `Proceed To Checkout` | Payment-method screen opens | cart refetch, address lookup, payment options, payment aggregator key |
| 6 | Payment methods | Stop before clicking payment method | Safe capture boundary | Payment method visible: `Jio Partner Pay` |

## API map by step

### Step 0: Attract / bootstrap

Purpose: load kiosk shell, company/app config, store context, feature flags, seller config, legal data, and anonymous session state.

Observed requests:

- `GET /ext/fynd-n-go/api/v1/app-info` -> 200
- `GET /ext/fynd-n-go/api/v1/company/59/application/<application_id>/config/app_config` -> 200
- `GET /ext/fynd-n-go/api/v1/company/59/application/<application_id>/company-profile/seller-details` -> 200
- `GET /ext/fynd-n-go/api/v1/59/<application_id>/installation-data` -> 200
- `GET /api/service/application/configuration/v1.0/feature` -> 200
- `GET /api/service/application/user/platform/v1.0/config` -> 200
- `GET /ext/fynd-n-go/api/v1/59/<application_id>/selfcheckout/seller-config` -> 200
- `GET /api/service/application/content/v1.0/legal` -> 200
- `GET /api/service/application/configuration/v1.0/ordering-store/stores/2790` -> 200
- `GET /api/service/application/catalog/v1.0/in-stock/locations/?q=F1UE` -> 200
- `GET /api/service/application/user/authentication/v1.0/session` -> 401 before login

Operational observations:

- Console logged `Sentry Initialized`.
- Console logged `No device found!` and `No App Version found!`.
- Welcome footer displayed `Device ID: not found | Store ID not found` in the Playwright context, although the store name loaded later.

Analytics events:

- `kiosk_app_bootstrap_started`
- `kiosk_config_loaded`
- `store_context_loaded`
- `session_check_failed`
- `device_context_missing`

### Step 1: Tap to start / mobile entry

Observed requests:

- `GET /ext/fynd-n-go/api/v1/selfcheckout/forms/selfcheckout/fields` -> 400
- `POST https://o71740.ingest.us.sentry.io/.../envelope` -> 200

Operational observations:

- Mobile number page still loaded despite form schema API returning 400.
- This is a real failure signal for the dashboard and should feed the `App errors` / `Journey config errors` metric.

Analytics events:

- `tap_get_started`
- `mobile_entry_view`
- `journey_form_schema_failed`
- `sentry_error_sent`

### Step 2: Auth / OTP

Observed in session network:

- `POST /api/service/application/user/authentication/v1.0/login/otp?platform=<application_id>` -> 200
- `POST /ext/fynd-n-go/api/v1/company/59/application/<application_id>/self-checkout/verify-otp` -> 200

Implementation note:

- Do not store raw mobile numbers.
- Use a salted hash for `user_id_hash` / `mobile_hash`.
- Capture OTP failures as analytics events but never capture OTP values.

Analytics events:

- `mobile_number_submit`
- `otp_send_success`
- `otp_verify_success`
- `otp_verify_failure`
- `otp_resend`

### Step 3: Scan / manual barcode

Screen state:

- Heading: `Scan the barcode until you hear the beep`
- CTA: `Let's Start Scanning`
- Manual option: `Having trouble scanning? Enter product barcode`
- Modal copy: `Enter 12 digit product number...`

Observed issue:

- The supplied barcode is a 13-digit EAN (`8905888014083`), but the modal says `12 digit`.

Analytics events:

- `scan_home_view`
- `scan_start_clicked`
- `manual_barcode_open`
- `manual_barcode_submit`
- `manual_barcode_validation_error`

### Step 4: Add to cart

Observed requests:

- `POST /ext/fynd-n-go/api/v1/company/59/application/<application_id>/cart/addItems` -> 200
- `PUT /ext/fynd-n-go/api/v1/company/59/application/<application_id>/cart/updateCartUser?id=<cart_id>` -> 200
- `GET /ext/fynd-n-go/api/v1/company/59/application/<application_id>/cart/platformGetCart?id=<cart_id>` -> 200
- `GET /api/service/application/catalog/v1.0/collections/packaging-material/items/?page_no=1&page_size=100&page_type=number&q=` -> 200
- `GET /ext/fynd-n-go/api/v1/company/59/application/<application_id>/cart/vouchers?userId=<user_id>` -> 200

Cart UI observed:

- Items count: `Items (1)`
- Promotion: `FLAT 299`
- Savings: `You saved Rs. 3,700.00 on this Item`
- Add carry bag
- Staff handoff prompt for unavailable size/color
- Offers and promotions
- Unlock coupon
- GST invoice option
- Price summary
- Proceed to checkout amount: `Rs. 299.00`

Analytics events:

- `cart_add_started`
- `cart_add_success`
- `cart_view`
- `packaging_options_loaded`
- `voucher_options_loaded`
- `gst_invoice_toggle`
- `checkout_start`

### Step 5: Checkout / payment-method selection

Observed requests:

- `GET /ext/fynd-n-go/api/v1/company/59/application/<application_id>/cart/platformGetCart?id=<cart_id>` -> 200
- `GET /ext/fynd-n-go/api/v1/company/59/application/<application_id>/cart/getAddresses?mobileNo=<masked>&tags=sng&userId=<masked>&user_id=<masked>` -> 200
- `GET /api/service/application/payment/v1.0/payment/options?amount=299&cart_id=<cart_id>&checkout_mode=self` -> 200
- `GET /api/service/application/payment/v1.0/config/aggregators/key` -> 200

Payment UI observed:

- Heading: `Choose How You'd Like to Pay`
- Security copy: `All transactions are encrypted and safe`
- Visible payment option: `Jio Partner Pay`

Analytics events:

- `payment_methods_view`
- `payment_options_loaded`
- `payment_aggregator_key_loaded`
- `payment_method_visible`

Do not trigger `payment_init` unless the customer explicitly chooses a payment method.

## Where the journey can break

| Break point | Cause | User impact | Dashboard metric |
|---|---|---|---|
| App bootstrap | Config/app-info/seller-config failure | Kiosk cannot load | Bootstrap failure rate |
| Store context | Store ID/device ID missing | Wrong/no store attribution | Store context missing count |
| Session check | 401 before login | Expected anonymous state, noisy if not handled | Anonymous session rate |
| Form schema | `forms/selfcheckout/fields` returns 400 | Login form may degrade | Journey config error count |
| OTP send | Provider/API failure | Customer cannot log in | OTP send failure rate |
| OTP verify | Wrong/expired OTP | Customer stuck on auth | OTP verify failure rate |
| Scanner | Barcode not read | Customer needs manual entry | Scan failure rate |
| Manual barcode | Bad input/copy mismatch | Product not found or confusion | Manual barcode error rate |
| Cart add | Product/OOS/cart API failure | Scan-to-cart break | Add-to-cart failure rate |
| Cart update user | User-cart association fails | Downstream checkout risk | Cart association failure |
| Voucher/package load | Add-on APIs fail | Lower UX quality, potential checkout delay | Cart enrichment failure |
| Address lookup | Address API fails | Checkout cannot proceed | Address lookup failure rate |
| Payment options | Payment options API fails | No payment method visible | Payment options failure rate |
| Aggregator key | Gateway config fails | Payment cannot start | Payment config failure rate |
| Payment init | Gateway rejects/timeout | Payment drop-off | Payment init failure rate |
| Order creation | OMS/order API failure | Paid but no confirmed order risk | Order creation failure |
| OMS confirm | Store does not confirm in SLA | Operational delay | Pending over SLA |

## Dashboard data model

The dashboard should be powered by five streams/tables:

1. `kiosk_events`
   - Frontend analytics events with GA4-like naming.
   - Required for funnel, session duration, scan behavior, support clicks, and journey failures.

2. `orders`
   - Order status, OMS timestamps, payment attempts, cancellations, returns.
   - Required for revenue, SLA, cancellation, return, and OMS latency.

3. `payments`
   - Payment option view, init, success, failure, failure reason, gateway.
   - Required for payment success rate and failure Pareto.

4. `devices`
   - Heartbeat, app version, scanner state, online/offline/degraded status.
   - Required for uptime, app crash rate, device health, network heatmap.

5. `catalog_inventory`
   - Product, brand, price, inventory, OOS state at store/time.
   - Required for product conversion, OOS scan rate, product not found.

## Minimum event properties

Every kiosk event should include:

- `event_name`
- `event_id`
- `occurred_at`
- `session_id`
- `screen_name`
- `company_id`
- `application_id`
- `store_id`
- `store_name`
- `device_session_id`
- `kiosk_id`
- `app_version`
- `user_id_hash`
- `cart_id_hash`
- `order_id_hash`
- `barcode_hash`
- `product_id`
- `brand_id`
- `amount`
- `payment_mode`
- `failure_reason`
- `api_endpoint`
- `api_status`
- `api_duration_ms`
- `source`

## Privacy rules

- Never store OTP values.
- Never store raw mobile numbers.
- Hash user IDs, mobile numbers, cart IDs, and order IDs before they enter analytics storage.
- Use endpoint templates instead of full URLs when query strings carry PII.
- Keep raw network logs in restricted engineering storage only, not the management dashboard.

## Dashboard remap

Command tab:

- Add `journey health` and `payment options loaded` to leadership health summary.
- Use real sales/order data today.
- Show session/funnel metrics as `instrumentation pending` until kiosk events are shipped.

Strategy tab:

- Treat scan, manual barcode, cart add, and brand/product joins as the core product loop.
- Add product-not-found and OOS scan metrics once catalog/inventory joins are live.

Operational tab:

- Promote config errors, device context missing, Sentry errors, payment options failure, and OMS SLA to top operational alerts.
- Keep `Jio Partner Pay` as the observed payment method until more gateways are confirmed.

## Implementation sequence

1. Ship frontend `trackKioskEvent` helper in kiosk app.
2. Track bootstrap, auth, scan, cart, checkout, payment, support, timeout, and crash events.
3. Land events into a warehouse table or event collector.
4. Join with Fynd order/payment/cart APIs and platform data.
5. Add MDM/heartbeat and Sentry webhooks for operational telemetry.
6. Keep dashboard KPI sections empty until real API summaries or live events are connected.
