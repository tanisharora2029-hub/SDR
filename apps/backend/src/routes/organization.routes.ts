import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { UpdateOrganizationSchema } from "@ai-sdr/shared";

export const organizationRouter = Router();
organizationRouter.use(authMiddleware);

organizationRouter.get("/", async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! }
    });
    res.json({ success: true, organization: org });
  } catch (err) {
    next(err);
  }
});

organizationRouter.put("/", validateBody(UpdateOrganizationSchema), async (req, res, next) => {
  try {
    const updated = await prisma.organization.update({
      where: { id: req.organizationId! },
      data: req.body
    });
    res.json({ success: true, organization: updated });
  } catch (err) {
    next(err);
  }
});

// Email Integration Endpoints (Ethereal Sandbox & Resend LIVE)
organizationRouter.get("/email-settings", async (req, res, next) => {
  try {
    const { EmailService } = await import("../services/emailService.js");
    const { ResendService } = await import("../services/resendService.js");
    const activeProvider = EmailService.getActiveProvider();
    const etherealInfo = await EmailService.getSenderInfo();
    const resendInfo = ResendService.getSenderInfo();

    res.json({
      success: true,
      activeProvider,
      providers: {
        ethereal: etherealInfo,
        resend: resendInfo
      }
    });
  } catch (err) {
    next(err);
  }
});

organizationRouter.post("/select-email-provider", async (req, res, next) => {
  try {
    const { provider } = req.body;
    if (provider !== "RESEND" && provider !== "ETHEREAL") {
      return res.status(400).json({ success: false, message: "Provider must be RESEND or ETHEREAL" });
    }
    const { EmailService } = await import("../services/emailService.js");
    EmailService.setActiveProvider(provider);
    res.json({
      success: true,
      activeProvider: provider,
      message: `Active email provider switched to ${provider === "RESEND" ? "Resend (LIVE)" : "Ethereal Sandbox (SANDBOX)"}`
    });
  } catch (err) {
    next(err);
  }
});

organizationRouter.post("/test-email-connection", async (req, res, next) => {
  try {
    const { EmailService } = await import("../services/emailService.js");
    const { ResendService } = await import("../services/resendService.js");
    const targetProvider = req.body.provider || EmailService.getActiveProvider();

    if (targetProvider === "RESEND") {
      const result = await ResendService.verifyConnection();
      return res.json({ success: result.success, message: result.message, provider: "RESEND" });
    } else {
      const result = await EmailService.verifyConnection();
      return res.json({ success: result.success, message: result.message, provider: "ETHEREAL" });
    }
  } catch (err) {
    next(err);
  }
});

organizationRouter.post("/send-test-email", async (req, res, next) => {
  try {
    const { EmailService } = await import("../services/emailService.js");
    const targetProvider = req.body.provider || EmailService.getActiveProvider();
    const recipient = req.body.to || "prospect-test@sandbox.nexus-sdr.internal";

    const isResend = targetProvider === "RESEND";
    const subject = isResend
      ? "Nexus SDR - Live Test Email via Resend"
      : "Nexus SDR - Sandbox Test Email via Ethereal";
    const text = isResend
      ? `Hello,\n\nThis is a verified live test email sent via Resend from Nexus SDR.\n\nSender: Alex Rivers (AI SDR)\nProvider: Resend (LIVE API)\nTimestamp: ${new Date().toISOString()}\n\nNexus SDR Autonomous Outreach Engine.`
      : `Hello,\n\nThis is a verified test email sent from the Nexus SDR Ethereal Sandbox environment.\n\nSender: Alex Rivers (AI SDR)\nProvider: Ethereal Sandbox (SMTP)\nMode: SANDBOX (Zero Cost)\nTimestamp: ${new Date().toISOString()}\n\nNo real external inboxes were contacted.`;

    const result = await EmailService.sendEmail({
      to: recipient,
      subject,
      text,
      senderName: "Alex Rivers",
      organizationId: req.organizationId,
      forceProvider: targetProvider
    });

    res.json({
      success: result.success,
      previewUrl: result.previewUrl || null,
      messageId: result.messageId,
      provider: result.provider,
      fallbackUsed: result.fallbackUsed || false,
      message: result.success
        ? (result.provider === "RESEND"
            ? `Live test email dispatched successfully via Resend API (ID: ${result.messageId})`
            : (result.fallbackUsed
                ? `Resend dispatch failed; safely delivered via Ethereal Sandbox fallback.`
                : `Test email sent successfully via Ethereal Sandbox.`))
        : (result.error || "Failed to send test email")
    });
  } catch (err) {
    next(err);
  }
});
