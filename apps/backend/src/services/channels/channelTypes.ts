export type ChannelProviderStatus = "REAL" | "SANDBOX" | "MOCK" | "NOT_IMPLEMENTED";

export interface ChannelSendOptions {
  to: string;
  content: string;
  subject?: string;
  senderName: string;
  senderEmail?: string;
  from?: string;
  leadId?: string;
  organizationId: string;
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  forceProvider?: "ETHEREAL" | "RESEND";
  isSimulator?: boolean;
}

export interface ChannelSendResult {
  success: boolean;
  channel: string;
  providerStatus: ChannelProviderStatus;
  externalMessageId?: string;
  previewUrl?: string;
  notes?: string;
  error?: string;
}

export interface IChannelProvider {
  readonly channel: string;
  getStatus(): ChannelProviderStatus;
  send(options: ChannelSendOptions): Promise<ChannelSendResult>;
}
