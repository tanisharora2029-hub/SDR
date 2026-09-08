import crypto from "crypto";
import { logger } from "../lib/logger.js";

export interface ResendSendOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  senderName?: string;
  leadId?: string;
  organizationId?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

export interface ResendSendResult {
  success: boolean;
  messageId?: string;
  provider: "RESEND";
  isSimulated: boolean;
  error?: string;
  statusCode?: number;
}

export class ResendService {
  private static readonly API_URL = "https://api.resend.com/emails";

  /**
   * Check if Resend is configured without logging or exposing the key
   */
  static isConfigured(apiKeyOverride?: string): boolean {
    const key = apiKeyOverride || process.env.RESEND_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Return metadata for the Resend provider without exposing secret key
   */
  static getSenderInfo(): {
    provider: string;
    mode: string;
    status: string;
    senderName: string;
    senderEmail: string;
    isConfigured: boolean;
  } {
    const configured = this.isConfigured();
    const senderEmail = process.env.RESEND_FROM_EMAIL || "Alex Rivers <onboarding@resend.dev>";
    return {
      provider: "Resend",
      mode: "LIVE",
      status: configured ? "Connected/Ready" : "API Key Not Configured",
      senderName: "Alex Rivers",
      senderEmail,
      isConfigured: configured
    };
  }

  /**
   * Verify Resend API connectivity and authentication
   */
  static async verifyConnection(apiKeyOverride?: string): Promise<{ success: boolean; message: string; statusCode?: number }> {
    const key = apiKeyOverride || process.env.RESEND_API_KEY;
    if (!key || key.trim().length === 0) {
      return {
        success: false,
        message: "RESEND_API_KEY environment variable is not configured.",
        statusCode: 400
      };
    }

    try {
      // Validate key against Resend API domains endpoint
      const res = await fetch("https://api.resend.com/domains", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${key.trim()}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        return {
          success: true,
          message: "Resend API connection verified successfully (Ready for live delivery)",
          statusCode: res.status
        };
      }

      const errData: any = await res.json().catch(() => ({}));
      const errMsg = errData.message || res.statusText || "Authentication failed";
      return {
        success: false,
        message: `Resend authentication failed (${res.status}): ${errMsg}`,
        statusCode: res.status
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Resend connection error: ${err.message || "Network error"}`,
        statusCode: 500
      };
    }
  }

  /**
   * Send live outbound email via Resend API with CAN-SPAM opt-out footer and threading headers
   */
  static async sendEmail(options: ResendSendOptions, apiKeyOverride?: string): Promise<ResendSendResult> {
    const key = apiKeyOverride || process.env.RESEND_API_KEY;
    if (!key || key.trim().length === 0) {
      logger.warn("[ResendService] Attempted to send email but RESEND_API_KEY is not configured.");
      return {
        success: false,
        provider: "RESEND",
        isSimulated: false,
        error: "RESEND_API_KEY is not configured in environment.",
        statusCode: 400
      };
    }

    const fromAddress = process.env.RESEND_FROM_EMAIL || "Alex Rivers <onboarding@resend.dev>";

    // Add CAN-SPAM / GDPR compliant opt-out footer
    const optOutText = "\n\n---\nTo unsubscribe from these communications, reply STOP.";
    const optOutHtml = `
      <br/><br/>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="font-size:12px;color:#6b7280;line-height:1.5;">
        You received this email because our sales representative reached out regarding potential collaboration.<br/>
        If you prefer not to receive future emails, reply <strong>STOP</strong> to unsubscribe.
      </p>
    `;

    const plainContent = (options.text || options.html?.replace(/<[^>]*>?/gm, "") || "") + optOutText;
    const htmlContent = (options.html || `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#111827;">${plainContent.replace(/\n/g, "<br/>")}</div>`) + optOutHtml;

    // RFC 2822 / 5322 Threading Headers
    const outboundHeaders: Record<string, string> = { ...(options.headers || {}) };
    if (options.inReplyTo) {
      outboundHeaders["In-Reply-To"] = options.inReplyTo;
    }
    if (options.references) {
      outboundHeaders["References"] = options.references;
    }

    const payload: any = {
      from: fromAddress,
      to: [options.to],
      subject: options.subject,
      text: plainContent,
      html: htmlContent
    };

    if (Object.keys(outboundHeaders).length > 0) {
      payload.headers = outboundHeaders;
    }
    if (options.replyTo) {
      payload.reply_to = options.replyTo;
    }

    try {
      logger.info(`[ResendService] Sending live email to ${options.to} via Resend API...`);
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data: any = await response.json();
        logger.info(`[ResendService] Live email successfully dispatched via Resend. Message ID: ${data.id}`);
        return {
          success: true,
          messageId: data.id,
          provider: "RESEND",
          isSimulated: false
        };
      }

      const errJson: any = await response.json().catch(() => ({}));
      const errorMsg = errJson.message || response.statusText || "Resend API error";
      logger.warn(`[ResendService] Resend API error (${response.status}): ${errorMsg}`);
      return {
        success: false,
        provider: "RESEND",
        isSimulated: false,
        error: errorMsg,
        statusCode: response.status
      };
    } catch (err: any) {
      logger.error(`[ResendService] Network error sending via Resend: ${err.message}`);
      return {
        success: false,
        provider: "RESEND",
        isSimulated: false,
        error: err.message || "Failed to reach Resend API",
        statusCode: 500
      };
    }
  }

  /**
   * Fetch full content of an inbound received email by emailId
   */
  static async getReceivedEmail(emailId: string, apiKeyOverride?: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      from: string;
      to: string[];
      subject: string;
      text?: string;
      html?: string;
      messageId?: string;
      headers?: Record<string, any>;
      createdAt?: string;
    };
    error?: string;
  }> {
    const key = apiKeyOverride || process.env.RESEND_API_KEY;
    if (!key || key.trim().length === 0) {
      return { success: false, error: "RESEND_API_KEY is not configured" };
    }

    try {
      // First try receiving endpoint, then fallback to standard emails endpoint
      let res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${key.trim()}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        res = await fetch(`https://api.resend.com/emails/${emailId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${key.trim()}`,
            "Content-Type": "application/json"
          }
        });
      }

      if (res.ok) {
        const data: any = await res.json();
        return {
          success: true,
          data: {
            id: data.id || emailId,
            from: data.from || "",
            to: Array.isArray(data.to) ? data.to : [data.to || ""],
            subject: data.subject || "",
            text: data.text || "",
            html: data.html || "",
            messageId: data.message_id || data.messageId || data.headers?.["message-id"],
            headers: data.headers || {},
            createdAt: data.created_at || new Date().toISOString()
          }
        };
      }

      const errJson: any = await res.json().catch(() => ({}));
      return { success: false, error: errJson.message || `Failed to fetch email (${res.status})` };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error fetching received email" };
    }
  }

  /**
   * Verify Svix webhook signature for Resend inbound webhooks using Node.js crypto
   */
  static verifyWebhookSignature(
    rawBody: string | Buffer,
    headers: Record<string, any>,
    secretOverride?: string
  ): { valid: boolean; error?: string } {
    const secret = secretOverride || process.env.RESEND_WEBHOOK_SECRET;

    // If no webhook secret is configured in environment, allow with notice (dev/testing mode)
    if (!secret || secret.trim().length === 0) {
      return { valid: true };
    }

    const svixId = headers["svix-id"] || headers["webhook-id"];
    const svixTimestamp = headers["svix-timestamp"] || headers["webhook-timestamp"];
    const svixSignature = headers["svix-signature"] || headers["webhook-signature"];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return { valid: false, error: "Missing Svix webhook signature headers" };
    }

    // Check timestamp freshness (within 5 minutes to prevent replay attacks)
    const timestampSec = parseInt(svixTimestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (isNaN(timestampSec) || Math.abs(nowSec - timestampSec) > 300) {
      return { valid: false, error: "Webhook signature timestamp expired or invalid" };
    }

    try {
      const cleanSecret = secret.trim().startsWith("whsec_") ? secret.trim().slice(6) : secret.trim();
      const secretBytes = Buffer.from(cleanSecret, "base64");
      const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
      const signedPayload = `${svixId}.${svixTimestamp}.${bodyStr}`;

      const expectedHmac = crypto
        .createHmac("sha256", secretBytes)
        .update(signedPayload)
        .digest("base64");

      // Signatures in header can be multiple: "v1,signature1 v1,signature2"
      const passedSignatures = String(svixSignature).split(" ").map((s: string) => {
        const parts = s.split(",");
        return parts.length === 2 ? parts[1] : parts[0];
      });

      const matched = passedSignatures.some((sig: string) => {
        const expectedBuf = Buffer.from(expectedHmac);
        const actualBuf = Buffer.from(sig);
        return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
      });

      if (!matched) {
        return { valid: false, error: "Signature mismatch" };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Signature verification error: ${err.message}` };
    }
  }
}
