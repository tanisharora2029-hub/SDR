import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.js";
import { ChannelManager } from "../services/channels/channelManager.js";
import { deliverStoredMessage } from "../services/messageDeliveryService.js";
import { FollowUpEngine } from "../services/followUpEngine.js";
import { LeadService } from "../services/leadService.js";

afterEach(() => vi.restoreAllMocks());
describe("Delivery accounting", () => {
  it.each([false, true])("persists the transport outcome and provider threading ID: %s", async (success) => {
    const message: any = { id: "message", conversationId: "conv", status: "PENDING", toolCallArgs: null };
    vi.spyOn(ChannelManager, "dispatch").mockResolvedValue({ success, channel: "EMAIL", providerStatus: "REAL", externalMessageId: success ? "resend-id" : undefined, error: success ? undefined : "Rejected" });
    const update = vi.spyOn(prisma.message, "update").mockImplementation(async (args: any) => ({ ...message, ...args.data }));
    await deliverStoredMessage(message, "EMAIL", { to: "customer@example.com", content: "Hello", senderName: "Alex", organizationId: "org" });
    expect(message.status).toBe(success ? "SENT" : "DELIVERY_FAILED");
    const metadata = JSON.parse((update.mock.calls[0][0].data as any).toolCallArgs);
    expect(metadata.externalMessageId).toBe(success ? "resend-id" : undefined);
    expect(metadata.deliveryError).toBe(success ? undefined : "Rejected");
  });
  it("does not execute or advance a follow-up when delivery fails", async () => {
    vi.spyOn(prisma.followUpTask, "findMany").mockResolvedValue([{ id: "task", leadId: "lead", stepNumber: 1, lead: { status: "NEW", isOptedOut: false } }] as any);
    vi.spyOn(LeadService, "triggerAiOutreach").mockResolvedValue({ deliverySuccess: false, deliveryError: "Rejected" } as any);
    const update = vi.spyOn(prisma.followUpTask, "updateMany");
    const next = vi.spyOn(prisma.followUpRule, "findFirst");
    const result = await FollowUpEngine.runPendingTasks("org");
    expect(result.executedCount).toBe(0);
    expect(result.results[0].status).toBe("FAILED");
    expect(update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
