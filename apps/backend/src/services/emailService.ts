import nodemailer, { Transporter } from "nodemailer";
import { logger } from "../lib/logger.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  leadId?: string;
  organizationId?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  isSimulated: boolean;
  error?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static etherealAccount: any = null;

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
      }
    });

    logger.info(`Ethereal test SMTP created: ${this.etherealAccount.user}`);
    return this.transporter;
  }

  static async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    try {
      const transporter = await this.getTransporter();
      const fromAddress = process.env.SMTP_FROM || (this.etherealAccount ? `"AI SDR" <${this.etherealAccount.user}>` : `"AI SDR" <sdr@company.com>`);

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

      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: plainContent,
        html: htmlContent
      });

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
        isSimulated: false
      };
    } catch (err: any) {
      logger.error("Failed to send email via SMTP:", err);
      return {
        success: false,
        isSimulated: false,
        error: err.message
      };
    }
  }
}