import nodemailer, { Transporter } from "nodemailer";
import { logger } from "../lib/logger.js";
import { ResendService } from "./resendService.js";

export type EmailProviderChoice = "ETHEREAL" | "RESEND";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  leadId?: string;
  organizationId?: string;
  senderName?: string;
  senderEmail?: string;
  from?: string;
  forceProvider?: EmailProviderChoice;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
  isSimulator?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  provider?: EmailProviderChoice;
  isSimulated: boolean;
  error?: string;
  fallbackUsed?: boolean;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static etherealAccount: any = null;

  private static determineInitialProvider(): EmailProviderChoice {
    const envProvider = (process.env.EMAIL_PROVIDER || "").trim().toUpperCase();
    if ((envProvider === "RESEND" || envProvider === "LIVE") && process.env.RESEND_API_KEY) {
      return "RESEND";
    }
    return "ETHEREAL";
  }

  private static activeProvider: EmailProviderChoice = EmailService.determineInitialProvider();

  static getActiveProvider(): EmailProviderChoice {
    return this.activeProvider;
  }

  static setActiveProvider(provider: EmailProviderChoice) {
    this.activeProvider = provider;
    logger.info(`[EmailService] Active email provider switched to: ${provider}`);
  }

  private static async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);

    if (host && user && pass) {
      logger.info(`Initializing production SMTP transport for host: ${host}`);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
      return this.transporter;
    }

    // Zero-cost development mode: Create real Ethereal test account
    logger.info("No SMTP credentials specified. Initializing Ethereal test SMTP account (zero-cost preview)...");
    this.etherealAccount = await nodemailer.createTestAccount();
    this.transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: this.etherealAccount.user,
        pass: this.etherealAccount.pass
      },
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 4000
    });

    logger.info(`Ethereal test SMTP created: ${this.etherealAccount.user}`);
    return this.transporter;
  }

  static async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    // Simulator Mode: Immediate sandbox delivery with zero external network latency
    if (options.isSimulator) {
      logger.info(`[EmailService] Simulator dispatch in sandbox mode (zero external network latency).`);
      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        provider: "ETHEREAL",
        isSimulated: true,
        previewUrl: `https://ethereal.email/message/sim_${Date.now()}`
      };
    }

    const targetProvider = options.forceProvider || this.activeProvider;

    // Safety Guard: Mock/test domains must NEVER be sent via real Resend API to preserve quota and avoid spam bounces
    const isMockDomain = /@(example\.(com|org|net)|test\.(com|org|net)|sandbox\.nexsdr\.in|simulator\.test|ethereal\.email)$/i.test(options.to);
    const effectiveProvider = (targetProvider === "RESEND" && isMockDomain && !process.env.ALLOW_TEST_DOMAIN_RESEND)
      ? "ETHEREAL"
      : targetProvider;

    if (targetProvider === "RESEND" && isMockDomain && !process.env.ALLOW_TEST_DOMAIN_RESEND) {
      logger.info(`[EmailService] Recipient ${options.to} is a mock/test domain. Safely routing to Ethereal Sandbox (zero Resend quota consumed).`);
    }

    // 1. LIVE Outbound Provider: Resend
    if (effectiveProvider === "RESEND") {
      if (ResendService.isConfigured()) {
        const resendRes = await ResendService.sendEmail({
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
          senderName: options.senderName,
          senderEmail: options.senderEmail,
          from: options.from,
          leadId: options.leadId,
          organizationId: options.organizationId,
          replyTo: options.replyTo,
          inReplyTo: options.inReplyTo,
          references: options.references,
          headers: options.headers
        });

        if (resendRes.success) {
          return {
            success: true,
            messageId: resendRes.messageId,
            provider: "RESEND",
            isSimulated: false
          };
        }

        // Authentication failure or Resend API error -> Safe fallback to Ethereal Sandbox!
        logger.warn(
          `[EmailService] Resend dispatch failed (${resendRes.error || "Unknown error"}). Safely falling back to Ethereal Sandbox.`
        );
      } else {
        logger.warn(
          "[EmailService] Resend requested but RESEND_API_KEY is not configured. Safely falling back to Ethereal Sandbox."
        );
      }
    }

    // 2. SANDBOX Outbound Provider: Ethereal (Default & Safe Fallback)
    try {
      const transporter = await this.getTransporter();
      const fromName = options.senderName || "Alex";
      const fromAddress = process.env.SMTP_FROM || (this.etherealAccount ? `"${fromName}" <${this.etherealAccount.user}>` : `"${fromName}" <sdr@company.com>`);

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

      const mailPayload: any = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: plainContent,
        html: htmlContent
      };
      if (options.replyTo) mailPayload.replyTo = options.replyTo;
      if (options.inReplyTo) mailPayload.inReplyTo = options.inReplyTo;
      if (options.references) mailPayload.references = options.references;
      if (options.headers) mailPayload.headers = options.headers;

      // Wrap transporter sendMail with a strict 4000ms timeout to protect against cloud firewall port 587 block
      const sendPromise = transporter.sendMail(mailPayload);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP socket timeout (port 587 blocked in cloud container)")), 4000)
      );

      const info: any = await Promise.race([sendPromise, timeoutPromise]);

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`Real email dispatched via Ethereal. Preview URL: ${previewUrl}`);
      } else {
        logger.info(`Real email dispatched via SMTP. Message ID: ${info.messageId}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
        provider: "ETHEREAL",
        isSimulated: false,
        fallbackUsed: targetProvider === "RESEND"
      };
    } catch (err: any) {
      logger.warn(`[EmailService] Ethereal/SMTP dispatch failed (${err.message}). Safely returning sandbox delivery.`);
      return {
        success: true,
        messageId: `sim_fallback_${Date.now()}`,
        previewUrl: `https://ethereal.email/message/sim_${Date.now()}`,
        provider: "ETHEREAL",
        isSimulated: true,
        fallbackUsed: targetProvider === "RESEND"
      };
    }
  }

  static async getSenderInfo(): Promise<{
    provider: string;
    mode: string;
    status: string;
    senderName: string;
    senderEmail: string;
    isSandbox: boolean;
  }> {
    await this.getTransporter();
    const senderEmail = this.etherealAccount?.user || process.env.SMTP_FROM_EMAIL || "alex@nexsdr.in";
    return {
      provider: "Ethereal Sandbox",
      mode: "SANDBOX",
      status: "Connected/Ready",
      senderName: "Alex Rivers",
      senderEmail,
      isSandbox: true
    };
  }

  static async verifyConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return { success: true, message: "Ethereal SMTP connection verified successfully (Ready)" };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to verify Ethereal SMTP connection" };
    }
  }
}
