/*
  Fynd Kiosk GA4-style event tracker boilerplate.

  Drop this into the kiosk frontend or adapt it inside the app telemetry layer.
  It deliberately avoids raw PII: mobile, user, cart, and order values should be
  hashed before being passed into trackKioskEvent.
*/

const KIOSK_EVENT_NAMES = Object.freeze({
  SESSION_START: "session_start",
  SESSION_END: "session_end",
  WELCOME_SCREEN_VIEW: "welcome_screen_view",
  APP_BOOTSTRAP_STARTED: "kiosk_app_bootstrap_started",
  CONFIG_LOADED: "kiosk_config_loaded",
  STORE_CONTEXT_LOADED: "store_context_loaded",
  DEVICE_CONTEXT_MISSING: "device_context_missing",
  SESSION_CHECK_FAILED: "session_check_failed",
  TAP_GET_STARTED: "tap_get_started",
  MOBILE_ENTRY_VIEW: "mobile_entry_view",
  JOURNEY_FORM_SCHEMA_FAILED: "journey_form_schema_failed",
  MOBILE_NUMBER_KEYPAD_INPUT: "mobile_number_keypad_input",
  MOBILE_NUMBER_SUBMIT: "mobile_number_submit",
  OTP_SEND_SUCCESS: "otp_send_success",
  OTP_SEND_FAILURE: "otp_send_failure",
  OTP_RESEND: "otp_resend",
  OTP_VERIFY_SUCCESS: "otp_verify_success",
  OTP_VERIFY_FAILURE: "otp_verify_failure",
  SCAN_HOME_VIEW: "scan_home_view",
  SCAN_START_CLICKED: "scan_start_clicked",
  MANUAL_BARCODE_OPEN: "manual_barcode_open",
  MANUAL_BARCODE_SUBMIT: "manual_barcode_submit",
  MANUAL_BARCODE_VALIDATION_ERROR: "manual_barcode_validation_error",
  SCAN_ATTEMPT: "scan_attempt",
  SCAN_SUCCESS: "scan_success",
  SCAN_FAILURE: "scan_failure",
  ITEM_RESOLVED: "item_resolved",
  ITEM_RESOLVED_FAILURE: "item_resolved_failure",
  PRODUCT_NOT_FOUND: "product_not_found",
  OOS_SCAN: "oos_scan",
  CART_ADD_STARTED: "cart_add_started",
  CART_ADD_SUCCESS: "cart_add_success",
  CART_ADD_FAILURE: "cart_add_failure",
  CART_USER_UPDATED: "cart_user_updated",
  CART_VIEW: "cart_view",
  CART_QUANTITY_CHANGED: "cart_quantity_changed",
  CART_ITEM_REMOVED: "cart_item_removed",
  COUPON_APPLY_CLICKED: "coupon_apply_clicked",
  COUPON_APPLIED: "coupon_applied",
  COUPON_REMOVED: "coupon_removed",
  PACKAGING_OPTIONS_LOADED: "packaging_options_loaded",
  VOUCHER_OPTIONS_LOADED: "voucher_options_loaded",
  SUPPORT_CLICK: "support_click",
  GST_INVOICE_TOGGLE: "gst_invoice_toggle",
  CHECKOUT_START: "checkout_start",
  CHECKOUT_ADDRESS_LOOKUP: "checkout_address_lookup",
  PAYMENT_METHODS_VIEW: "payment_methods_view",
  PAYMENT_OPTIONS_LOADED: "payment_options_loaded",
  PAYMENT_OPTIONS_FAILED: "payment_options_failed",
  PAYMENT_AGGREGATOR_KEY_LOADED: "payment_aggregator_key_loaded",
  PAYMENT_METHOD_SELECTED: "payment_method_selected",
  PAYMENT_INIT: "payment_init",
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAILURE: "payment_failure",
  PAYMENT_TIMEOUT: "payment_timeout",
  PAYMENT_CANCELLED: "payment_cancelled",
  PAYMENT_RETRY_CLICKED: "payment_retry_clicked",
  ORDER_CREATED: "order_created",
  ORDER_CREATION_FAILED: "order_creation_failed",
  ORDER_COMPLETE: "order_complete",
  ORDER_STATUS_VIEW: "order_status_view",
  JOURNEY_COMPLETE: "journey_complete",
  SESSION_TIMEOUT: "session_timeout",
  APP_CRASH: "app_crash"
});

const REQUIRED_CONTEXT_FIELDS = [
  "session_id",
  "company_id",
  "application_id",
  "store_id",
  "screen_name"
];

function createEventId() {
  if (globalThis.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  createEventId.sequence = (createEventId.sequence || 0) + 1;
  return `evt_${Date.now()}_${createEventId.sequence}`;
}

function sanitizeEventPayload(payload) {
  const blocked = [
    "mobile",
    "mobileNo",
    "phone",
    "otp",
    "raw_user_id",
    "raw_cart_id",
    "raw_order_id",
    "token",
    "authorization"
  ];

  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (value === undefined || value === null || value === "") return false;
      return !blocked.includes(key);
    })
  );
}

function validateContext(context) {
  return REQUIRED_CONTEXT_FIELDS.filter((field) => !context[field]);
}

async function trackKioskEvent(eventName, properties = {}, context = {}) {
  const missing = validateContext(context);
  const payload = sanitizeEventPayload({
    event_id: createEventId(),
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    source: "kiosk_frontend",
    ...context,
    ...properties
  });

  if (missing.length) {
    payload.context_missing = missing.join(",");
  }

  if (globalThis.kioskDataLayer && !properties.skip_data_layer) {
    globalThis.kioskDataLayer.push({ event: eventName, ...payload });
    return payload;
  }

  if (globalThis.navigator && navigator.sendBeacon) {
    const body = JSON.stringify(payload);
    const sent = navigator.sendBeacon("/analytics/kiosk-events", body);
    if (sent) return payload;
  }

  await fetch("/analytics/kiosk-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify(payload)
  });

  return payload;
}

function createKioskContext(base = {}) {
  return {
    company_id: base.company_id,
    application_id: base.application_id,
    store_id: base.store_id,
    store_name: base.store_name,
    device_session_id: base.device_session_id,
    app_version: base.app_version,
    kiosk_id: base.kiosk_id,
    session_id: base.session_id,
    user_id_hash: base.user_id_hash,
    cart_id_hash: base.cart_id_hash,
    order_id_hash: base.order_id_hash,
    screen_name: base.screen_name
  };
}

export {
  KIOSK_EVENT_NAMES,
  createKioskContext,
  sanitizeEventPayload,
  trackKioskEvent
};
