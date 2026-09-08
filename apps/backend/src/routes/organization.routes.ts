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

// Phase 1: Email Integration (Ethereal Sandbox only)
organizationRouter.get("/email-settings", async (req, res, next) => {
  try {
    const { EmailService } = await import("../services/emailService.js");
    const emailSettings = await EmailService.getSenderInfo();
    res.json({ success: true, emailSettings });
  } catch (err) {
    next(err);
  }
});

organizationRouter.post("/test-email-connection", async (req, res, next) => {
  try {
    const { EmailService } = await import("../services/emailService.js");
    const result = await EmailService.verifyConnection();
    res.json({ success: result.success, message: result.message });
  } catch (err) {
    next(err);
  }
});

organizationRouter.post("/send-test-email", async (req, res, next) => {
  try {
    const { EmailService } = await import("../services/emailService.js");
    const recipient = req.body.to || "prospect-test@sandbox.nexus-sdr.internal";
    const result = await EmailService.sendEmail({
      to: recipient,
      subject: "Nexus SDR - Ethereal Sandbox Test Email",
      text: `Hello,\n\nThis is a verified test email sent from the Nexus SDR Ethereal Sandbox environment.\n\nSender: Alex Rivers (AI SDR)\nProvider: Ethereal Sandbox (SMTP)\nMode: SANDBOX (Zero Cost)\nTimestamp: ${new Date().toISOString()}\n\nNo real external inboxes were contacted.`,
      senderName: "Alex Rivers",
      organizationId: req.organizationId
    });

    res.json({
      success: result.success,
      previewUrl: result.previewUrl || null,
      messageId: result.messageId,
      message: result.success
        ? "Test email sent successfully via Ethereal Sandbox"
        : (result.error || "Failed to send test email")
    });
  } catch (err) {
    next(err);
  }
});