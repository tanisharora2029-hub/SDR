import { IChannelProvider, ChannelProviderStatus, ChannelSendOptions, ChannelSendResult } from "./channelTypes.js";
import { EmailChannelProvider } from "./emailProvider.js";
import { SmsChannelProvider } from "./smsProvider.js";
import { WhatsAppChannelProvider } from "./whatsappProvider.js";
import { VoiceChannelProvider } from "./voiceProvider.js";
import { EmailService } from "../emailService.js";
import { ResendService } from "../resendService.js";

export class ChannelManager {
  private static providers: Map<string, IChannelProvider> = new Map<string, IChannelProvider>([
    ["EMAIL", new EmailChannelProvider()],
    ["SMS", new SmsChannelProvider()],
    ["WHATSAPP", new WhatsAppChannelProvider()],
    ["PHONE", new VoiceChannelProvider()]
  ]);

  static getProvider(channel: string): IChannelProvider | undefined {
    return this.providers.get(channel.toUpperCase());
  }

  static getChannelStatuses(): Record<string, { status: ChannelProviderStatus; label: string; description: string }> {
    const isResendActive = EmailService.getActiveProvider() === "RESEND" && ResendService.isConfigured();

    return {
      EMAIL: {
        status: isResendActive ? "REAL" : "SANDBOX",
        label: isResendActive ? "Email (Resend LIVE API)" : "Email (Ethereal Sandbox / SMTP)",
        description: isResendActive
          ? "Live outbound email delivery via Resend REST API to real prospect inboxes."
          : "Zero-cost Ethereal test SMTP inbox with preview links. Live delivery can be enabled via Resend API."
      },
      SMS: {
        status: "MOCK",
        label: "SMS (Mock Carrier Dispatch)",
        description: "Simulated carrier dispatch and delivery receipts. Twilio / Sinch API ready for production connection."
      },
      WHATSAPP: {
        status: "MOCK",
        label: "WhatsApp (Mock Meta Cloud API)",
        description: "Simulated WhatsApp Business Cloud API with 24-hour conversational window. Meta WhatsApp API ready."
      },
      VOICE: {
        status: "SANDBOX",
        label: "Voice Telephony (Browser Studio Test Mode)",
        description: "Interactive browser audio engine with real-time mic VAD, neural TTS, and barge-in at zero PSTN carrier cost."
      }
    };
  }

  static async dispatch(channel: string, options: ChannelSendOptions): Promise<ChannelSendResult> {
    const provider = this.getProvider(channel);
    if (!provider) {
      return {
        success: false,
        channel,
        providerStatus: "NOT_IMPLEMENTED",
        error: `Channel "${channel}" is not implemented.`
      };
    }
    return provider.send(options);
  }
}
