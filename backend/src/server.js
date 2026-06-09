import cors from "cors";
import express from "express";
import morgan from "morgan";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { router } from "./routes.js";

const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(dirname, config.frontendDistDir);

app.set("trust proxy", 1);

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === config.frontendOrigin || config.firstParty.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use("/sdk", express.static(path.resolve(dirname, "../public"), {
  maxAge: "5m",
  immutable: false
}));

function apiInfo() {
  return {
    name: "Fashion Factory First-Party Analytics API",
    mode: "first-party",
    streamId: config.source.streamId,
    streamUrl: config.source.streamUrl,
    timezone: config.source.timezone,
    dashboard: config.serveFrontend ? "/" : config.frontendOrigin,
    endpoints: [
      "/api/first-party/events",
      "/api/webhooks/fashionfactory",
      "/api/analytics/kiosk-events",
      "/api/first-party/summary",
      "/api/analytics/summary",
      "/api/first-party/status",
      "/api/first-party/stream",
      "/api/first-party/export",
      "/sdk/ff-analytics-layer.js",
      "/sdk/fashionfactory-source-bridge.js"
    ]
  };
}

app.get("/", (req, res, next) => {
  if (config.serveFrontend) {
    next();
    return;
  }
  res.json(apiInfo());
});

app.get("/api", (_req, res) => {
  res.json(apiInfo());
});

app.use("/api", router);

if (config.serveFrontend) {
  try {
    await access(frontendDistPath);
    app.use(express.static(frontendDistPath, {
      maxAge: "5m",
      immutable: false
    }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/sdk/")) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDistPath, "index.html"));
    });
  } catch {
    console.warn(`Frontend dist not found at ${frontendDistPath}; API-only mode remains active.`);
  }
}

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

app.use((error, _req, res, _next) => {
  const status = error.statusCode || error.response?.status || 500;
  const details = error.response?.data?.error?.message || error.message || "Unknown error";
  const code = error.code || error.response?.data?.error?.status || "FIRST_PARTY_ERROR";
  const isFirstPartyError = String(code).startsWith("FIRST_PARTY");
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: isFirstPartyError
      ? "First-party analytics request failed"
      : "Analytics request failed",
    code,
    details
  });
});

app.listen(config.port, () => {
  console.log(`First-party analytics API listening on http://127.0.0.1:${config.port}`);
});
