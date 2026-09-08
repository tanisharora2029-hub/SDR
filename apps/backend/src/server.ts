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

// Enable CORS and JSON body parsing with raw body capture for webhook signature verification
const corsOrigin = process.env.CORS_ORIGIN;
const allowedOrigins = corsOrigin
  ? corsOrigin.includes(",")
    ? corsOrigin.split(",").map((o) => o.trim())
    : corsOrigin.trim()
  : "*";

app.use(
  cors({
    origin: allowedOrigins,
    credentials: allowedOrigins !== "*",
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
    service: "NexusSDR Core API",
    version: "1.0.0",
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

// WebSocket Server for Real-Time Phone Voice Studio
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  logger.info("WebSocket client connected to Voice Studio channel");

  ws.on("message", (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG" }));
      }
    } catch (e) {
      // ignore
    }
  });

  ws.on("close", () => {
    logger.info("WebSocket client disconnected");
  });
});

const PORT = parseInt(process.env.PORT || "5000", 10);
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  logger.info(`NexusSDR Server running on http://${HOST}:${PORT} [${process.env.NODE_ENV || "development"}]`);
});

export { app, server };