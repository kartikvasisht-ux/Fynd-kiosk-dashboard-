import { Router } from "express";
import { config } from "./config.js";
import {
  firstPartyExport,
  firstPartySummary,
  firstPartyStatus,
  ingestFirstPartyEvent,
  subscribeFirstPartyStream
} from "./firstPartyStore.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode: "first-party",
    propertyName: config.source.propertyName,
    measurementId: config.source.measurementId,
    streamId: config.source.streamId,
    streamUrl: config.source.streamUrl,
    sourceUrl: config.source.sourceUrl,
    dataSource: config.source.dataSource,
    timezone: config.source.timezone,
    currency: config.source.currency,
    collector: "/api/first-party/events",
    sdk: "/sdk/ff-analytics-layer.js"
  });
});

router.post("/first-party/events", async (req, res, next) => {
  try {
    const result = await ingestFirstPartyEvent(req.body, req);
    res.status(result.duplicate ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/webhooks/fashionfactory", async (req, res, next) => {
  try {
    const result = await ingestFirstPartyEvent(req.body, req);
    res.status(result.duplicate ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/webhooks/fashionfactory/events", async (req, res, next) => {
  try {
    const result = await ingestFirstPartyEvent(req.body, req);
    res.status(result.duplicate ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/analytics/kiosk-events", async (req, res, next) => {
  try {
    const result = await ingestFirstPartyEvent(req.body, req);
    res.status(result.duplicate ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/first-party/summary", async (req, res, next) => {
  try {
    res.json(await firstPartySummary(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/summary", async (req, res, next) => {
  try {
    res.json(await firstPartySummary(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/first-party/export", async (req, res, next) => {
  try {
    res.json(await firstPartyExport(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/export", async (req, res, next) => {
  try {
    res.json(await firstPartyExport(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/first-party/status", async (req, res, next) => {
  try {
    res.json(await firstPartyStatus(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/first-party/stream", async (req, res, next) => {
  try {
    await firstPartySummary(req.query);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    subscribeFirstPartyStream(res, req.query);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics/stream", async (req, res, next) => {
  try {
    await firstPartySummary(req.query);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    subscribeFirstPartyStream(res, req.query);
  } catch (error) {
    next(error);
  }
});
