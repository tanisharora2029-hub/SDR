import { describe, expect, it, vi } from "vitest";
import { readCustomerReply } from "../services/ai/customerMessage.js";
import { EmailService } from "../services/emailService.js";
import { ResendService } from "../services/resendService.js";

describe("Customer email boundary", () => {
  it("blocks direct Resend delivery without making a network request", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    try {
      const result = await ResendService.sendEmail({ to: "customer@example.com", subject: "Hello", text: 'Hello [Your Name]' });
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(422);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it("extracts a complete reply without exposing model metadata", () => {
    expect(readCustomerReply(JSON.stringify({
      intent: "outreach", action: "", reply: "Hi Deepak,\nHow can we help?",
      reason: "Internal reasoning"
    }))).toBe("Hi Deepak,\nHow can we help?");
  });
  it("rejects truncated JSON and unfinished signatures", () => {
    expect(() => readCustomerReply('{"reply":"Hi Deepak","tool_arguments":{"body":"Hi')).toThrow();
    expect(() => readCustomerReply("Regards, [Your Name]")).toThrow();
  });
  it("blocks unsafe email before calling Resend", async () => {
    const send = vi.spyOn(ResendService, "sendEmail");
    try {
      const result = await EmailService.sendEmail({
        to: "customer@example.com", subject: "Hello",
        text: '{"intent": "outreach", "reply": "Hello"',
        forceProvider: "RESEND"
      });
      expect(result.success).toBe(false);
      expect(send).not.toHaveBeenCalled();
    } finally { send.mockRestore(); }
  });
});
