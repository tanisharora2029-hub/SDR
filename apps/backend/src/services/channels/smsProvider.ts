import { IChannelProvider, ChannelProviderStatus, ChannelSendOptions, ChannelSendResult } from "./channelTypes.js";
import { logger } from "../../lib/logger.js";

export class SmsChannelProvider implements IChannelProvider {
  readonly channel = "SMS";

  getStatus(): ChannelProviderStatus {
    return "MOCK";
  }

  async send(options: ChannelSendOptions): Promise<ChannelSendResult> {
    const msgId = `sms_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    logger.info(`[SmsChannelProvider][MOCK] Simulated SMS to ${options.to} from "${options.senderName}": "${options.content.slice(0, 60)}..." [MsgId: ${msgId}]`);

    return {
      success: true,
      channel: "SMS",
      providerStatus: "MOCK",
      externalMessageId: msgId,
      notes: `Mock SMS carrier dispatch simulation to ${options.to}. In production, integrate Twilio or Sinch SMS API.`
    };
  }
}
