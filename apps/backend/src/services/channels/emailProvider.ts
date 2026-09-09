import { IChannelProvider, ChannelProviderStatus, ChannelSendOptions, ChannelSendResult } from "./channelTypes.js";
import { EmailService } from "../emailService.js";
import { ResendService } from "../resendService.js";
import { logger } from "../../lib/logger.js";

export class EmailChannelProvider implements IChannelProvider {
  readonly channel = "EMAIL";

  getStatus(): ChannelProviderStatus {
    if (EmailService.getActiveProvider() === "RESEND" && ResendService.isConfigured()) {
      return "REAL";
    }
    return "SANDBOX";
  }

  async send(options: ChannelSendOptions): Promise<ChannelSendResult> {
    const status = this.getStatus();
    const activeProvider = EmailService.getActiveProvider();
    logger.info(`[EmailChannelProvider] Dispatching email to ${options.to} via mode: ${status} (Active: ${activeProvider})`);

    try {
      const res = await EmailService.sendEmail({
        to: options.to,
        subject: options.subject || `Message from ${options.senderName}`,
        text: options.content,
        leadId: options.leadId,
        organizationId: options.organizationId,
        senderName: options.senderName,
        senderEmail: options.senderEmail,
        from: options.from,
        replyTo: options.replyTo,
        inReplyTo: options.inReplyTo,
        references: options.references,
        headers: options.headers,
        forceProvider: options.forceProvider,
        isSimulator: options.isSimulator
      });

      const usedStatus: ChannelProviderStatus = res.provider === "RESEND" ? "REAL" : "SANDBOX";

      return {
        success: res.success,
        channel: "EMAIL",
        providerStatus: usedStatus,
        externalMessageId: res.messageId,
        previewUrl: res.previewUrl || undefined,
        notes: res.provider === "RESEND"
          ? `Delivered via Resend LIVE API (ID: ${res.messageId})`
          : (res.isSimulated || res.provider === "SIMULATOR"
              ? `Delivered internally via simulator (ID: ${res.messageId})`
              : `Delivered via Ethereal Sandbox. Preview link: ${res.previewUrl}`),
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
