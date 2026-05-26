# Fynd Kiosk touchpoint map

Date updated: 2026-05-20  
Primary kiosk URL: `https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790`  
Platform docs: `https://partners.jiocommerce.io/help/docs/sdk/latest/platform/client-libraries#introduction`  
Company console: `https://platform.jiocommerce.io/company/59/home`

## Capture boundary

The live inspection reached welcome and mobile-entry screens on 2026-05-20. Auth, scan, cart, checkout, and payment mapping also uses the previously inspected safe flow from 2026-05-19, where the journey stopped before clicking `Jio Partner Pay`. Payment initiation, payment completion, and order creation are therefore marked `unknown` unless an API/screen was directly observed.

Do not store raw mobile number, OTP, auth token, cart ID, order ID, transaction ID, or barcode in analytics. Use salted hashes or masked endpoint templates.

## Normalized event schema

Machine-readable schema: `boilerplate/kiosk-touchpoint-event-schema.json`

Required fields:

| Field | Meaning |
|---|---|
| `session_id` | Stable kiosk visit/session ID created at `session_start`. |
| `event_name` | Normalized snake_case event name. |
| `event_type` | One of `session`, `screen_view`, `click`, `input`, `scan`, `api`, `cart`, `checkout`, `payment`, `order`, `system`, `error`. |
| `timestamp` | Client event time in ISO 8601. |
| `screen_name` | Current screen such as `welcome`, `mobile_entry`, `scan_home`, `cart`, `payment`. |
| `action_name` | Button/input action such as `continue`, `back`, `retry`, `cancel`, `remove_item`. |
| `article` / `barcode_hash` | Product article/SKU/barcode references. Prefer hash for barcode. |
| `cart_reference` | `cart_id_hash`, `line_item_id`, quantity. |
| `order_reference` | `order_id_hash`, shipment/bag refs. |
| `payment_reference` | `payment_session_id_hash`, transaction/payment order refs, mode, aggregator. |
| `status` | `started`, `viewed`, `clicked`, `submitted`, `success`, `failure`, `timeout`, `cancelled`, `closed`, `unknown`. |
| `source_url` | Screen URL or masked endpoint template. |

## Touchpoint map

Full machine-readable map: `boilerplate/kiosk-touchpoint-map.json`

| touchpoint_name | event_type | source_url | journey_stage | status | confidence | notes | recommended_action |
|---|---|---|---|---|---|---|---|
| Session start | session | `/ext/fynd-n-go/app/selfcheckout/?_ds=2790` | bootstrap | started | high | Kiosk URL opens with store query `_ds=2790`. | Generate `session_id` before first API call. |
| Welcome screen view | screen_view | `/ext/fynd-n-go/app/selfcheckout/?_ds=2790` | welcome | viewed | high | Welcome screen and store name visible. | Track store/device context on page load. |
| Device context missing | system | browser console | bootstrap | failure | high | Console logged `No device found`; footer showed Device ID not found. | Emit `device_context_missing` with missing fields. |
| Configuration loaded | api | `/config/app_config`, seller config, feature, legal, store, stock location APIs | bootstrap | success | high | Bootstrap APIs loaded. | Track each endpoint template, status, duration. |
| Anonymous session check | api | `/api/service/application/user/authentication/v1.0/session` | bootstrap | failure | high | Returned 401 before login. | Classify as anonymous state before auth, not sales failure. |
| Tap to get started | click | welcome screen | welcome | clicked | high | CTA visible and clicked; center click was blocked by device-info overlay. | Track click and fix overlay hit area. |
| Mobile entry screen view | screen_view | `/selfcheckout/welcomepage` | auth | viewed | high | Mobile screen visible after CTA. | Track screen view. |
| Form schema load failure | api | `/ext/fynd-n-go/api/v1/selfcheckout/forms/selfcheckout/fields` | auth | failure | high | Returned 400 and sent Sentry envelope. | Send to ops as journey config error. |
| Mobile keypad input | input | `/selfcheckout/welcomepage` | auth | submitted | high | Numeric keypad, Clear, Backspace visible. | Track validation state; never raw mobile. |
| Mobile number submit | click | `/login/otp?platform={application_id}` | auth | unknown | medium | Requires real mobile; not executed this session. | Track click, `mobile_hash`, API status. |
| OTP send result | api | `/login/otp?platform={application_id}` | auth | unknown | medium | Needs real mobile/OTP journey. | Capture only status and latency. |
| OTP verify result | api | `/self-checkout/verify-otp` | auth | unknown | medium | Endpoint observed previously; not executed this session. | Track `user_id_hash` on success. |
| Scan home screen view | screen_view | scan route unknown | scan | unknown | medium | Observed in earlier authenticated capture. | Track after OTP success. |
| Start scanning click | click | scan route unknown | scan | unknown | medium | Bundle contains `Let's Start Scanning`. | Track scanner availability. |
| Barcode/article scan | scan | scanner/device integration | scan | started | medium | Physical scanner could not be triggered in browser. | Emit from scanner integration with `barcode_hash`. |
| Scan success/failure | scan | scanner/product/cart layer | scan | unknown | medium | Need separate read success from item resolution. | Track `scan_success`, `scan_failure`, `failure_reason`. |
| Manual barcode open | click | scan screen | scan | clicked | medium | Manual entry link observed in bundle/previous flow. | Track modal open and manual-entry reason. |
| Manual barcode submit | input | manual barcode modal | scan | submitted | medium | Previous barcode `8905888014083`; modal copy says 12 digit while EAN is 13 digit. | Fix copy/validation mismatch; hash barcode. |
| Item resolved/matched | api | `/cart/addItems` or `/catalog/products` | scan | success | medium | Product reached cart, but product-resolution API was not isolated. | Add explicit `item_resolved_success/failure`. |
| Add item to cart | cart | `/cart/addItems` | cart | success | high | Returned 200 in earlier flow. | Track item, quantity, cart, value. |
| Cart user association | api | `/cart/updateCartUser?id={cart_id}` | cart | success | high | Returned 200 in earlier flow. | Track masked user/cart refs. |
| Cart view | screen_view | `/cart/platformGetCart?id={cart_id}` | cart | viewed | high | Cart showed item, offers, coupon, GST, price summary. | Capture cart totals and item count from cart response. |
| Quantity change | cart | `/cart/updateCart` or cart detail endpoint | cart | unknown | medium | Quantity logic exists in bundle; not exercised. | Track old/new quantity and status. |
| Remove item | cart | `/cart/updateCart` or `/cart/deleteCart` | cart | unknown | medium | Remove paths exist in bundle; not exercised. | Track click and API result separately. |
| Voucher options loaded | api | `/cart/vouchers?userId={user_id}` | cart | success | high | Returned 200 earlier. | Mask user/cart values. |
| Apply/remove coupon | cart | `/cart/applyCoupon`, `/cart/removeCoupon` | cart | unknown | medium | Coupon endpoints exist; not used in capture. | Track coupon hash, discount, rejection reason. |
| GST invoice toggle | click | cart screen | cart | unknown | medium | GST option visible. | Track toggle state only; never raw GSTIN. |
| Proceed to checkout | checkout | `/cart/platformCheckoutCartV2` or `/service/application/cart/v2.0/checkout` | checkout | started | high | Proceed CTA observed and used earlier. | Track cart total, items, checkout mode. |
| Address lookup | api | `/cart/getAddresses?mobileNo={masked}&userId={masked}` | checkout | success | high | Returned 200 earlier. | Mask mobile/user query values. |
| Payment methods screen view | screen_view | `/cart/payment` | payment | viewed | high | Payment screen observed earlier; heading exists in bundle. | Track visible methods array. |
| Payment options loaded | api | `/payment/v1.0/payment/options?amount={amount}&cart_id={cart_id}&checkout_mode=self` | payment | success | high | Returned 200 earlier. | Track method count, amount, status, latency. |
| Payment aggregator key loaded | api | `/payment/v1.0/config/aggregators/key` | payment | success | high | Returned 200 earlier. | Track status only; never log key payload. |
| Payment method selected | click | `/cart/selectPaymentMode` or cart payment API | payment | unknown | medium | Stopped before clicking payment method. | Track selected mode before `payment_init`. |
| Payment initiation | payment | `/payment-orders/`, `/create-order/link`, payment session endpoints | payment | unknown | medium | Bundle has payment order/link/gateway surfaces; not triggered. | Track payment session ref, gateway, amount. |
| Payment cancelled | payment | payment screen | payment | cancelled | medium | Bundle includes cancel/back-to-cart copy. | Track cancel, back, close separately. |
| Payment retry | click | payment failure screen | payment | clicked | medium | Bundle includes retry payment copy. | Track retry count per payment session. |
| Payment success/failure/timeout | payment | `/payment/confirm/polling` | payment | unknown | medium | Success/failure/timeout assets and polling endpoints found; not triggered. | Capture gateway code, failure reason, timeout duration. |
| Order creation | order | `/service/application/order/v1.0/orders` or `/cart/order-status` | order | unknown | medium | Order endpoints exist; not reached because payment not initiated. | Join `order_id_hash` to sales order ID after payment success. |
| Order status/result screen | screen_view | `/cart/order-status?success=true&status=complete&order_id={order_id}&cart_id={cart_id}` | order | unknown | medium | Order status/details routes exist in bundle. | Track masked order/cart refs. |
| Journey completion | session | `/cart/order-details/{order_id}?status=complete&success=true` | completion | unknown | medium | Completion route found; not reached in safe capture. | Emit after order_created and success screen render. |
| Session end | session | client lifecycle / timeout / completion | completion | unknown | medium | No explicit end event observed. | Emit on completion, timeout, cancel, clear-cart, unload fallback. |

## Covered touchpoints summary

- Bootstrap: app info, app config, seller details, installation data, feature flags, platform config, legal docs, store details, stock location, session check.
- Auth: tap start, mobile entry view, form schema failure, mobile keypad controls, OTP send/verify mapping.
- Scan: scan home, scan start, scanner attempt, scan result, manual barcode open/submit, item resolution.
- Cart: add item, update cart user, cart view, quantity/remove, coupons/vouchers, GST toggle.
- Checkout: proceed to checkout, address lookup, cart checkout APIs.
- Payment: payment methods view, payment options, aggregator key, method selection, payment init, retry/cancel, success/failure/timeout.
- Order/completion: order creation, order status view, completion, session end.

## Gaps in click/session tracking

| Gap | Impact | Recommended fix |
|---|---|---|
| No explicit `session_start` / `session_end` observed | Cannot calculate clean session duration or abandonment reason. | Generate session ID at first page load; end on completion, timeout, clear cart, cancel, unload. |
| Device ID missing | Store/device attribution can break. | Emit `device_context_missing`; fix kiosk device registration. |
| Welcome CTA overlay intercepts center clicks | Click analytics may show retries/friction; user may experience dead tap. | Fix z-index/pointer-events for device info footer. |
| Form schema endpoint returns 400 | Auth form is degraded/noisy. | Fix form schema or downgrade expected 400 handling. |
| Scan read and item resolution are not separated | Cannot distinguish scanner issue vs catalog/OOS issue. | Emit `scan_attempt`, `scan_success`, `item_resolved`, `cart_add_success` separately. |
| Manual barcode copy says 12 digit but EAN is 13 digit | User confusion and false validation errors. | Align copy and validation rules. |
| Payment selection/init/success/order were not safely executed | Payment and order conversion remain unknown. | Instrument these events in production; validate with test gateway/order sandbox. |
| Raw query params include mobile/user/cart IDs | PII risk in logs/specs. | Store endpoint templates and hashed refs only. |

## Missing, duplicate, or mismatched events

| Type | Finding | Recommended action |
|---|---|---|
| Missing | `session_start`, `session_end`, `journey_complete` not directly observable. | Add explicit lifecycle events in frontend tracker. |
| Missing | `screen_view` events are not visible as analytics calls. | Emit one screen view per route/screen render. |
| Missing | Back, retry, cancel, close clicks are present in UI/bundle but not observed as analytics events. | Add normalized click events for all navigation/friction actions. |
| Missing | Payment timeout/failure reasons are unknown. | Capture gateway codes and normalized failure taxonomy. |
| Duplicate risk | Console shows repeated extension/config actions. | Deduplicate by `event_id` and event semantic key. |
| Mismatch | Device context missing while store 2790 is present. | Separate `store_context_loaded` from `device_context_missing`. |
| Mismatch | Manual barcode copy says 12 digit; supplied EAN is 13 digit. | Update copy and validation. |
| Mismatch | Anonymous session 401 logs as console error. | Classify as expected pre-login state unless it happens post-login. |

## Exact sales fields needed for later matching

Use these fields to join touchpoint events with sales/order/payment data:

| Sales field | Why it is needed |
|---|---|
| `company_id` | Company partition. Observed company is `59`. |
| `application_id` | Application partition. Observed app ID is `688a0fc42f61c5197c8bbfc5`. |
| `store_id` / `store_code` / `store_name` | Store-level sales and journey attribution. |
| `kiosk_id` / `device_session_id` | Device uptime, scanner, and in-store attribution. |
| `session_id` | Funnel, abandonment, and duration join key. |
| `user_id_hash` / `mobile_hash` | Repeat user and auth funnel, without raw PII. |
| `cart_id_hash` | Primary bridge from scan/cart events to checkout/payment/order. |
| `order_id` / `order_id_hash` | Primary sales order join. Store raw only in restricted sales warehouse; use hash in analytics. |
| `shipment_id` / `bag_id` hashes | OMS and item fulfillment status. |
| `payment_session_id_hash` / `payment_order_id_hash` / `transaction_id_hash` | Payment attempt to order/sales reconciliation. |
| `payment_mode` / `aggregator_name` | Payment method performance and failure Pareto. |
| `order_status` / `payment_status` / `shipment_status` | Conversion, failure, cancellation, and SLA state. |
| `order_created_at` / `paid_at` / `confirmed_at` / `cancelled_at` | Funnel timing, OMS SLA, latency, cancellation windows. |
| `gross_amount` / `net_amount` / `discount_amount` / `tax_amount` / `shipping_or_bag_fee` | Revenue, AOV, promo, and GST reporting. |
| `currency` | Revenue normalization. |
| `line_item_id` / `sku` / `article` / `barcode_hash` / `product_id` | Scan-to-cart and product conversion joins. |
| `brand_id` / `brand_name` / `category_id` | Brand/product strategy reporting. |
| `quantity` / `unit_price` / `mrp` / `selling_price` | Item quantity and price waterfall. |
| `coupon_code_hash` / `promotion_id` | Coupon performance without leaking codes. |
| `failure_reason` / `gateway_error_code` / `api_status` | Breakpoint and payment failure analysis. |

## API object/event mapping

| Journey area | Relevant API/object family |
|---|---|
| Auth/session | Application user authentication session, login OTP, verify OTP. |
| Store/app bootstrap | Application configuration, feature flags, legal, ordering-store, stock location. |
| Product/scan | Catalog products, stock-status, in-stock locations, product/serviceability. |
| Cart | Cart detail, add items, update cart, delete cart, coupons, vouchers, shipments. |
| Checkout | Cart checkout v1/v2, address, select-address, payment selection. |
| Payment | Payment options, aggregator config, payment orders, payment link, confirm polling. |
| Order/sales | Application order create/get/status/invoice/shipments APIs. |
