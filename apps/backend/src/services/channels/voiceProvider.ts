import { IChannelProvider, ChannelProviderStatus, ChannelSendOptions, ChannelSendResult } from "./channelTypes.js";
import { logger } from "../../lib/logger.js";

export class VoiceChannelProvider implements IChannelProvider {
  readonly channel = "PHONE";

  getStatus(): ChannelProviderStatus {
    return "SANDBOX";
  }

  async send(options: ChannelSendOptions): Promise<ChannelSendResult> {
    const callSid = `call_sim_${Date.now()}`;
    logger.info(`[VoiceChannelProvider][SANDBOX] Voice call session registered for ${options.to} [CallSid: ${callSid}]`);

    return {
      success: true,
      channel: "PHONE",
      providerStatus: "SANDBOX",
      externalMessageId: callSid,
      notes: "Browser-native Voice Studio session with Neural TTS and hardware microphone simulation (Zero carrier cost)."
    };
  }
}
