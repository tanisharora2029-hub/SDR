import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { ResendService } from "./resendService.js";
import { ConversationService } from "./conversationService.js";

export interface NormalizedInboundEmail {
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  externalMessageId: string;
  timestamp: string;
  replyTo?: string;
  rawHeaders?: Record<string, any>;
}

export class WebhookService {
  /**
   * Helper: Extract and normalize email address from RFC format: "Name <user@domain.com>" or "user@domain.com"
   */
  static normalizeEmail(rawInput: string): string {
    if (!rawInput) return "";
    const match = rawInput.match(/<([^>]+)>/);
    const email = match ? match[1] : rawInput;
    return email.trim().toLowerCase();
  }

  /**
   * Helper: Extract display name from "Name <user@domain.com>"
   */
  static extractSenderName(rawInput: string): string {
    if (!rawInput) return "";
    const match = rawInput.match(/^([^<]+)<[^>]+>$/);
    if (match) {
      return match[1].replace(/["']/g, "").trim();
    }
    return "";
  }

  /**
   * Parse Resend webhook payload into normalized inbound email object
   */
  static async parseResendPayload(payload: any): Promise<NormalizedInboundEmail | null> {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    // Standard Resend webhook event structure: { type: "email.received", data: { ... } }
    // Or direct data object (used in some test harnesses / direct API requests)
    const data = payload.data || payload;

    const fromRaw = data.from || (typeof data.sender === "string" ? data.sender : "");
    const senderEmail = this.normalizeEmail(fromRaw);
    if (!senderEmail) {
      return null;
    }

    const senderName = this.extractSenderName(fromRaw);
    const toRaw = Array.isArray(data.to) ? data.to[0] : (data.to || (Array.isArray(data.received_for) ? data.received_for[0] : ""));
    const recipientEmail = this.normalizeEmail(toRaw);

    const subject = data.subject || "No Subject";
    const externalMessageId = data.message_id || data.messageId || data.email_id || data.id || `resend_${Date.now()}`;
    const timestamp = data.created_at || payload.created_at || new Date().toISOString();
    const replyTo = data.reply_to || undefined;

    let bodyText = data.text || "";
    let bodyHtml = data.html || "";

    // If body is not inlined in the webhook (standard Resend email.received payload), fetch full content via Resend API
    const emailId = data.email_id || data.id;
    if ((!bodyText || bodyText.trim().length === 0) && emailId && ResendService.isConfigured()) {
      logger.info(`[WebhookService] Fetching full inbound email body from Resend API for email_id: ${emailId}`);
      const fetched = await ResendService.getReceivedEmail(emailId);
      if (fetched.success && fetched.data) {
        bodyText = fetched.data.text || "";
        bodyHtml = fetched.data.html || "";
      } else {
        logger.warn(`[WebhookService] Could not retrieve full email body for ${emailId}: ${fetched.error}`);
      }
    }

    // Fallback: If only HTML is present, strip HTML tags for plain text
    if (!bodyText && bodyHtml) {
      bodyText = bodyHtml.replace(/<[^>]*>?/gm, "").trim();
    }

    return {
      senderEmail,
      senderName,
      recipientEmail,
      subject,
      bodyText: bodyText.trim(),
      bodyHtml,
      externalMessageId,
      timestamp,
      replyTo,
      rawHeaders: data.headers
    };
  }

  /**
   * Process an inbound email through lead matching, idempotency, storage, and AI SDR reply
   */
  static async processInboundEmail(
    inbound: NormalizedInboundEmail,
    organizationIdOverride?: string
  ): Promise<{
    success: boolean;
    duplicate?: boolean;
    matched: boolean;
    leadId?: string;
    action?: string;
    message: string;
    conversationResult?: any;
  }> {
    const { senderEmail, subject, bodyText, externalMessageId, replyTo } = inbound;
    logger.info(`[WebhookService] Processing inbound email from: ${senderEmail} (Subject: "${subject}", ID: ${externalMessageId})`);

    // 1. Idempotency Check: Prevent duplicate processing of the same external email event
    const existingLog = await prisma.activityLog.findFirst({
      where: {
        category: "INBOUND_EMAIL",
        action: "INBOUND_EMAIL_PROCESSED",
        detailsJson: { contains: externalMessageId }
      }
    });

    if (existingLog) {
      logger.info(`[WebhookService] Duplicate email event detected for Message ID: ${externalMessageId}. Safely ignoring.`);
      return {
        success: true,
        duplicate: true,
        matched: true,
        message: "Duplicate inbound email event safely ignored (Idempotent)"
      };
    }

    // 2. Inbound Email -> Lead Matching (case-insensitive by normalized email)
    const matchingLeads = await prisma.lead.findMany({
      where: {
        email: { equals: senderEmail },
        ...(organizationIdOverride ? { organizationId: organizationIdOverride } : {})
      },
      include: { organization: true }
    });

    // If no matching lead found in database
    if (matchingLeads.length === 0) {
      logger.warn(`[WebhookService] No lead found matching sender email: ${senderEmail}. Storing unmatched inbound event.`);

      // Find default or first active organization to attach the log
      const defaultOrg = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
      const orgId = organizationIdOverride || defaultOrg?.id || "unassigned";

      if (defaultOrg) {
        await prisma.activityLog.create({
          data: {
            organizationId: orgId,
            category: "INBOUND_EMAIL",
            action: "UNMATCHED_INBOUND_EMAIL",
            detailsJson: JSON.stringify({
              senderEmail,
              recipientEmail: inbound.recipientEmail,
              subject,
              externalMessageId,
              receivedAt: inbound.timestamp
            })
          }
        });
      }

      return {
        success: true,
        duplicate: false,
        matched: false,
        message: `Inbound email safely recorded, but sender '${senderEmail}' does not match any existing lead in Nexus SDR.`
      };
    }

    const matchedLead = matchingLeads[0];
    const organizationId = matchedLead.organizationId;
    logger.info(`[WebhookService] Matched inbound email to Lead: ${matchedLead.firstName} ${matchedLead.lastName} (${matchedLead.id}) in Org: ${organizationId}`);

    // Record idempotency token in ActivityLog
    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "INBOUND_EMAIL",
        action: "INBOUND_EMAIL_PROCESSED",
        detailsJson: JSON.stringify({
          leadId: matchedLead.id,
          externalMessageId,
          senderEmail,
          subject,
          timestamp: inbound.timestamp
        })
      }
    });

    // 3. Ingest into Conversation with proper LEAD role, REAL_INBOUND status, and threading
    const replyContent = bodyText || subject || "Empty reply message";
    const result = await ConversationService.ingestLeadReply(
      organizationId,
      matchedLead.id,
      "EMAIL",
      replyContent,
      {
        subject,
        externalMessageId,
        isRealInbound: true,
        replyTo: replyTo || senderEmail,
        inReplyTo: externalMessageId,
        references: externalMessageId
      }
    );

    return {
      success: true,
      duplicate: false,
      matched: true,
      leadId: matchedLead.id,
      action: result.optedOut ? "LEAD_OPTED_OUT" : (result.aiResponded === false ? "HUMAN_TAKEOVER_ACTIVE" : "AI_RESPONDED"),
      message: result.optedOut
        ? "Lead processed STOP / unsubscribe request successfully."
        : (result.aiResponded === false
            ? "Lead reply stored in Omnichannel Inbox. Human takeover active; AI auto-reply suppressed."
            : "Inbound email processed and autonomous AI SDR response dispatched."),
      conversationResult: result
    };
  }
}
