import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { errorHandler } from "./middleware/errorHandler.js";
import { authLimiter, apiLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./lib/logger.js";

import { authRouter } from "./routes/auth.routes.js";
import { organizationRouter } from "./routes/organization.routes.js";
import { sdrRouter } from "./routes/sdr.routes.js";
import { leadRouter } from "./routes/lead.routes.js";
import { conversationRouter } from "./routes/conversation.routes.js";
import { callRouter } from "./routes/call.routes.js";
import { followUpRouter } from "./routes/followUp.routes.js";
import { handoffRouter } from "./routes/handoff.routes.js";
import { appointmentRouter } from "./routes/appointment.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { webhookRouter } from "./routes/webhook.routes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Production allowed origins for NexSDR
export const PRODUCTION_CORS_ORIGINS = [
  "https://nexsdr.in",
  "https://www.nexsdr.in",
  "https://ai-sdr-frontend-n07e.onrender.com"
];

// Helper to parse allowed origins from CORS_ORIGIN (accepts comma-separated list)
export const parseCorsOrigins = (
  rawOrigin?: string,
  isProduction: boolean = process.env.NODE_ENV === "production"
): string[] => {
  if (rawOrigin && rawOrigin.trim()) {
    const parsed = rawOrigin
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }

  // Fallback defaults
  return isProduction
    ? [...PRODUCTION_CORS_ORIGINS]
    : [...PRODUCTION_CORS_ORIGINS, "http://localhost:3000", "http://127.0.0.1:3000"];
};

const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

// General rate limiter for all API endpoints except health
app.use("/api", apiLimiter);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "NexSDR Core API",
    version: "1.0.0",
    domain: "https://nexsdr.in",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/organization", organizationRouter);
app.use("/api/sdr", sdrRouter);
app.use("/api/leads", leadRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/calls", callRouter);
app.use("/api/follow-ups", followUpRouter);
app.use("/api/handoff", handoffRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/webhooks", webhookRouter);

// Global Error Handler
app.use(errorHandler);

// WebSocket Server for Real-Time Phone Voice Studio & Omnichannel Inbox Events
import { wsBroadcaster, broadcastToOrganization } from "./lib/wsBroadcaster.js";
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  logger.info("WebSocket client connected to real-time channel");
  wsBroadcaster.registerClient(ws);
});

const PORT = parseInt(process.env.PORT || "5000", 10);
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  logger.info(`NexSDR Server running on http://${HOST}:${PORT} [${process.env.NODE_ENV || "development"}]`);
});

export { app, server, broadcastToOrganization };