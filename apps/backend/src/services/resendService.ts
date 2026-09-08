import { logger } from "../lib/logger.js";

export interface ResendSendOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  senderName?: string;
  leadId?: string;
  organizationId?: string;
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
   * Send live outbound email via Resend API with CAN-SPAM opt-out footer
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

    try {
      logger.info(`[ResendService] Sending live email to ${options.to} via Resend API...`);
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [options.to],
          subject: options.subject,
          text: plainContent,
          html: htmlContent
        })
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
}
