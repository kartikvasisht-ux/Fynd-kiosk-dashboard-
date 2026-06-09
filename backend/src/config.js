import "dotenv/config";

const sourceUrl = process.env.FIRST_PARTY_SOURCE_URL || "https://fashionfactory.jiocommerce.io/ext/fynd-n-go/app/selfcheckout/?_ds=2790";
const streamUrl = process.env.FIRST_PARTY_STREAM_URL || "https://fashionfactory.jiocommerce.io";

export const config = {
  port: Number(process.env.PORT || 9090),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  serveFrontend: process.env.SERVE_FRONTEND === "true",
  frontendDistDir: process.env.FRONTEND_DIST_DIR || "../../frontend/dist",
  firstParty: {
    storageDir: process.env.FIRST_PARTY_ANALYTICS_DIR || process.env.DATA_DIR || ".first-party-analytics",
    sourceUrl,
    allowedOrigins: (process.env.FIRST_PARTY_ALLOWED_ORIGINS || `http://127.0.0.1:5173,http://localhost:5173,${streamUrl}`)
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  },
  source: {
    propertyId: process.env.FIRST_PARTY_PROPERTY_ID || "538449109",
    propertyName: process.env.FIRST_PARTY_SOURCE_NAME || "Fashion Factory (Companion App Prod)",
    measurementId: process.env.FIRST_PARTY_MEASUREMENT_ID || "G-MYZM2V20D9",
    streamId: process.env.FIRST_PARTY_STREAM_ID || "14914518095",
    streamUrl,
    sourceUrl,
    dataSource: process.env.FIRST_PARTY_DS || "2790",
    timezone: process.env.FIRST_PARTY_TIMEZONE || "Asia/Kolkata",
    currency: process.env.FIRST_PARTY_CURRENCY || "INR"
  },
  deployment: {
    pilotStoresLive: Number(process.env.FIRST_PARTY_PILOT_STORES_LIVE || 2),
    pilotStoresTotal: Number(process.env.FIRST_PARTY_PILOT_STORES_TOTAL || 2),
    kiosksInstalled: Number(process.env.FIRST_PARTY_KIOSKS_INSTALLED || 2)
  }
};
