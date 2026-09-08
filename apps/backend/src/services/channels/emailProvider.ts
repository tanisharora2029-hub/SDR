import { IChannelProvider, ChannelProviderStatus, ChannelSendOptions, ChannelSendResult } from "./channelTypes.js";
import { EmailService } from "../emailService.js";
import { logger } from "../../lib/logger.js";

export class EmailChannelProvider implements IChannelProvider {
  readonly channel = "EMAIL";

  getStatus(): ChannelProviderStatus {
    const isProductionSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    return isProductionSmtp ? "REAL" : "SANDBOX";
  }

  async send(options: ChannelSendOptions): Promise<ChannelSendResult> {
    const status = this.getStatus();
    logger.info(`[EmailChannelProvider] Dispatching email to ${options.to} via mode: ${status}`);

    try {
      const res = await EmailService.sendEmail({
        to: options.to,
        subject: options.subject || `Message from ${options.senderName}`,
        text: options.content,
        leadId: options.leadId,
        organizationId: options.organizationId
      });

      return {
        success: res.success,
        channel: "EMAIL",
        providerStatus: status,
        externalMessageId: res.messageId,
        previewUrl: res.previewUrl || undefined,
        notes: status === "SANDBOX"
          ? (res.previewUrl ? `Ethereal preview link: ${res.previewUrl}` : "Ethereal sandbox SMTP")
          : "Production SMTP transport",
        error: res.error
      };
    } catch (err: any) {
      logger.error("[EmailChannelProvider] Failed to send email:", err);
      return {
        success: false,
        channel: "EMAIL",
        providerStatus: status,
        error: err.message
      };
    }
  }
}
