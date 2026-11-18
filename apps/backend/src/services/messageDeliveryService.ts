import { Message } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { broadcastToOrganization } from "../lib/wsBroadcaster.js";
import { ChannelManager } from "./channels/channelManager.js";
import { ChannelSendOptions, ChannelSendResult } from "./channels/channelTypes.js";

export async function deliverStoredMessage(message: Message, channel: string, options: ChannelSendOptions) {
  let result: ChannelSendResult;
  try {
    if (!options.to) throw new Error("Recipient has no contact address");
    result = await ChannelManager.dispatch(channel, options);
  } catch (error) {
    result = { success: false, channel, providerStatus: "NOT_IMPLEMENTED", error: (error as Error).message };
  }
  const args = message.toolCallArgs ? JSON.parse(message.toolCallArgs) : {};
  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      status: result.success ? "SENT" : "DELIVERY_FAILED",
      toolCallArgs: JSON.stringify({ ...args, externalMessageId: result.externalMessageId, deliveryError: result.error })
    }
  });
  Object.assign(message, updated);
  broadcastToOrganization(options.organizationId, {
    type: "CONVERSATION_UPDATED",
    payload: { conversationId: message.conversationId, leadId: options.leadId }
  });
  return result;
}
