export type ChannelProviderStatus = "REAL" | "SANDBOX" | "MOCK" | "NOT_IMPLEMENTED";

export interface ChannelSendOptions {
  to: string;
  content: string;
  subject?: string;
  senderName: string;
  leadId?: string;
  organizationId: string;
  metadata?: Record<string, any>;
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
