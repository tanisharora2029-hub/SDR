import { Router, Request, Response } from "express";
import { logger } from "../lib/logger.js";
import { ResendService } from "../services/resendService.js";
import { WebhookService } from "../services/webhookService.js";
import { verifyToken } from "../lib/jwt.js";

export const webhookRouter = Router();

/**
 * Production Inbound Webhook Endpoint for Resend
 * Path: POST /api/webhooks/resend/inbound
 */
webhookRouter.post("/resend/inbound", async (req: Request, res: Response) => {
  try {
    // 1. Signature Verification (Svix)
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
    const signatureCheck = ResendService.verifyWebhookSignature(rawBody, req.headers);

    if (!signatureCheck.valid) {
      logger.warn(`[InboundWebhook] Webhook signature verification failed: ${signatureCheck.error}`);
      return res.status(400).json({
        success: false,
        error: "Invalid webhook signature"
      });
    }

    // 2. Event Type Filtering: Resend sends events like email.received, email.sent, email.delivered
    const eventType = req.body?.type;
    if (eventType && eventType !== "email.received" && eventType !== "inbound.email") {
      logger.info(`[InboundWebhook] Received non-inbound Resend event type: ${eventType}. Acknowledged without action.`);
      return res.status(200).json({
        success: true,
        received: true,
        message: `Ignored event type: ${eventType}`
      });
    }

    // 3. Payload Parsing & Normalization
    const parsed = await WebhookService.parseResendPayload(req.body);
    if (!parsed) {
      logger.warn("[InboundWebhook] Failed to parse inbound email from payload (Missing sender or malformed body).");
      return res.status(400).json({
        success: false,
        error: "Malformed inbound email payload: unable to extract valid sender address."
      });
    }

    // 4. Inbound Email Processing (Idempotency, Lead Matching, AI SDR, Threading)
    const result = await WebhookService.processInboundEmail(parsed);

    return res.status(200).json({
      success: true,
      processed: true,
      duplicate: result.duplicate || false,
      matched: result.matched,
      leadId: result.leadId || null,
      action: result.action || null,
      message: result.message
    });
  } catch (err: any) {
    logger.error(`[InboundWebhook] Internal server error handling inbound email: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "Internal server error processing inbound email"
    });
  }
});

/**
 * Safe Test & Verification Endpoint for Inbound Webhooks
 * Path: POST /api/webhooks/resend/inbound/test
 */
webhookRouter.post("/resend/inbound/test", async (req: Request, res: Response) => {
  try {
    // In production, require authenticated user belonging to an organization
    if (process.env.NODE_ENV === "production") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Authentication required to use the test webhook endpoint in production."
        });
      }
      try {
        const decoded = verifyToken(authHeader.split(" ")[1]);
        (req as any).user = decoded;
        (req as any).organizationId = decoded.organizationId;
      } catch {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Invalid or expired token."
        });
      }
    }

    const { payload, secretOverride, organizationId } = req.body;
    const testData = payload || req.body;

    // Run signature verification check if secret provided
    if (secretOverride) {
      const rawBody = JSON.stringify(testData);
      const signatureCheck = ResendService.verifyWebhookSignature(rawBody, req.headers, secretOverride);
      if (!signatureCheck.valid) {
        return res.status(400).json({
          success: false,
          error: `Test signature verification failed: ${signatureCheck.error}`
        });
      }
    }

    const parsed = await WebhookService.parseResendPayload(testData);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: "Test payload malformed: unable to extract valid sender email."
      });
    }

    const targetOrgId = (req as any).organizationId || organizationId;
    const result = await WebhookService.processInboundEmail(parsed, targetOrgId);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error(`[InboundWebhook Test] Error during test execution: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error"
    });
  }
});

/**
 * Inbound Webhook Configuration Status & Setup Guide
 * Path: GET /api/webhooks/resend/inbound/status
 */
webhookRouter.get("/resend/inbound/status", (req: Request, res: Response) => {
  const isResendConfigured = ResendService.isConfigured();
  const hasWebhookSecret = Boolean(process.env.RESEND_WEBHOOK_SECRET && process.env.RESEND_WEBHOOK_SECRET.trim().length > 0);

  res.json({
    success: true,
    status: isResendConfigured ? "Ready" : "Not Configured",
    webhookPath: "/api/webhooks/resend/inbound",
    isResendConfigured,
    hasWebhookSecret,
    requirements: {
      mxRecordConfigured: "Requires verified domain with MX record pointing to Resend inbound mailserver",
      webhookUrlConfigured: "Add webhook URL to Resend Dashboard -> Webhooks -> Add Webhook",
      eventType: "email.received"
    }
  });
});
