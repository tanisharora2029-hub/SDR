import { IChannelProvider, ChannelProviderStatus, ChannelSendOptions, ChannelSendResult } from "./channelTypes.js";
import { logger } from "../../lib/logger.js";

export class WhatsAppChannelProvider implements IChannelProvider {
  readonly channel = "WHATSAPP";

  getStatus(): ChannelProviderStatus {
    return "MOCK";
  }

  async send(options: ChannelSendOptions): Promise<ChannelSendResult> {
    const wamid = `wamid_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    logger.info(`[WhatsAppChannelProvider][MOCK] Simulated WhatsApp message to ${options.to} from "${options.senderName}": "${options.content.slice(0, 60)}..." [WAMID: ${wamid}]`);

    return {
      success: true,
      channel: "WHATSAPP",
      providerStatus: "MOCK",
      externalMessageId: wamid,
      notes: `Mock WhatsApp Business API dispatch simulation to ${options.to}. In production, integrate Meta Cloud API.`
    };
  }
}
