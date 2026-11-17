import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { UpdateOrganizationSchema } from "@ai-sdr/shared";
import { getWorkspaceConfiguration, saveWorkspaceConfiguration } from "../services/workspaceConfigurationService.js";

export const organizationRouter = Router();
organizationRouter.use(authMiddleware);

organizationRouter.get("/", async (req, res, next) => {
  try {
    const organizationId = req.organizationId!;
    const [organization, configuration] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      getWorkspaceConfiguration(organizationId)
    ]);
    res.json({ success: true, organization, configuration });
  } catch (err) {
    next(err);
  }
});

organizationRouter.put("/", validateBody(UpdateOrganizationSchema), async (req, res, next) => {
  try {
    const organizationId = req.organizationId!;
    const { configuration, ...business } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: organizationId },
        data: business
      });
      if (configuration) await saveWorkspaceConfiguration(tx, organizationId, configuration);
      return organization;
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
    if (process.env.NODE_ENV === "production" && provider === "ETHEREAL") {
      return res.status(400).json({
        success: false,
        message: "Ethereal Sandbox is strictly disabled in production. Resend is the sole live email provider."
      });
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
    const recipient = req.body.to || "prospect-test@sandbox.nexsdr.in";

    const isResend = targetProvider === "RESEND" || process.env.NODE_ENV === "production";
    const isMockRecipient = /@(example\.(com|org|net)|test\.(com|org|net)|sandbox\.nexsdr\.in|simulator\.test|ethereal\.email)$/i.test(recipient);

    if (isResend && isMockRecipient) {
      return res.status(400).json({
        success: false,
        provider: "RESEND",
        message: "Live Resend delivery cannot be sent to sandbox mock domains. Please enter a real recipient email address (e.g. your personal/work inbox) to test live delivery."
      });
    }

    const subject = isResend
      ? "NexSDR - Live Test Email via Resend"
      : "NexSDR - Sandbox Test Email via Ethereal";
    const text = isResend
      ? `Hello,\n\nThis is a verified live test email sent via Resend from NexSDR.\n\nSender: Alex Rivers (AI SDR)\nSender Email: alex@nexsdr.in\nProvider: Resend (LIVE API)\nTimestamp: ${new Date().toISOString()}\n\nNexSDR Autonomous Outreach Engine.`
      : `Hello,\n\nThis is a verified test email sent from the NexSDR Ethereal Sandbox environment.\n\nSender: Alex Rivers (AI SDR)\nSender Email: alex@nexsdr.in\nProvider: Ethereal Sandbox (SMTP)\nMode: SANDBOX (Zero Cost)\nTimestamp: ${new Date().toISOString()}\n\nNo real external inboxes were contacted.`;

    const result = await EmailService.sendEmail({
      to: recipient,
      subject,
      text,
      senderName: "Alex Rivers",
      senderEmail: "alex@nexsdr.in",
      organizationId: req.organizationId,
      forceProvider: targetProvider
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        provider: result.provider || targetProvider,
        message: result.error || "Failed to send test email"
      });
    }

    res.json({
      success: true,
      previewUrl: result.previewUrl || null,
      messageId: result.messageId,
      provider: result.provider,
      fallbackUsed: false,
      message: result.provider === "RESEND"
        ? `Live test email dispatched successfully via Resend API (ID: ${result.messageId})`
        : `Test email sent successfully via Ethereal Sandbox.`
    });
  } catch (err) {
    next(err);
  }
});

organizationRouter.get("/domain-dns", async (_req, res, next) => {
  try {
    const isResendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
    res.json({
      success: true,
      domain: "nexsdr.in",
      canonicalUrl: "https://nexsdr.in",
      outbound: {
        status: isResendConfigured ? "PENDING_REGISTRAR" : "API_KEY_REQUIRED",
        spf: {
          type: "TXT",
          name: "@",
          value: "v=spf1 include:resend.com ~all",
          status: "PENDING_REGISTRAR"
        },
        dkim: {
          type: "TXT",
          name: "resend._domainkey",
          value: "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...",
          status: "PENDING_REGISTRAR"
        }
      },
      inbound: {
        status: "PENDING_REGISTRAR",
        mx: {
          type: "MX",
          name: "@",
          priority: 10,
          value: "feedback-smtp.us-east-1.amazonses.com",
          status: "PENDING_REGISTRAR"
        },
        webhookEndpoint: "https://sdr-backend-6o2x.onrender.com/api/webhooks/resend/inbound",
        webhookStatus: process.env.RESEND_WEBHOOK_SECRET ? "CONFIGURED" : "READY_FOR_SECRET"
      },
      notes: "DNS records must be manually added to your registrar for nexsdr.in (Cloudflare, GoDaddy, Namecheap, etc.). Outbound delivery is active via Resend; inbound receiving requires MX record routing to Resend."
    });
  } catch (err) {
    next(err);
  }
});
