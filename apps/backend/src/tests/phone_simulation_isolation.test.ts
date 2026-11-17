import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma.js";
import { aiService } from "../services/ai/aiService.js";
import { PhoneService } from "../services/phoneService.js";
import { ToolExecutor } from "../services/toolExecutor.js";
import { WhisperService } from "../services/whisperService.js";

const organizationId = randomUUID();

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: organizationId } });
});

it("saves a demo transcript without applying simulated outreach, opt-outs, or qualification scores", async () => {
  const organization = await prisma.organization.create({
    data: {
      id: organizationId,
      name: "Phone Studio test",
      industry: "SALON",
      products: "Bridal makeup and hair styling",
      pricingInfo: "Hair styling starts at ₹800",
      sdrProfiles: { create: {} },
      leads: {
        create: { firstName: "Demo", lastName: "Lead", email: "demo@example.com", companyName: "Example" }
      }
    },
    include: { leads: true }
  });
  const lead = organization.leads[0];
  const tool = vi.spyOn(ToolExecutor, "executeTool");
  vi.spyOn(WhisperService, "updateLiveWhisperAssist").mockResolvedValue(null as never);
  const respond = vi.spyOn(aiService, "respondToVoiceMessage").mockResolvedValue({
    content: "Understood.",
    toolDecision: { toolName: "send_email", arguments: { lead_id: lead.id } },
    latencyMs: 10,
    tokensUsed: 10,
    provider: "test"
  });
  vi.spyOn(aiService, "summarizeCall").mockResolvedValue({ summary: "Demo ended", qualificationScore: 90 });

  try {
    const { session } = await PhoneService.initiateCall(organizationId, lead.id, "INBOUND", true);
    expect(session.callSid).toMatch(/^demo_/);
    await PhoneService.processCallTurn(organizationId, session.callSid, "Please stop contacting me");
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        personaTitle: "salon receptionist",
        products: "Bridal makeup and hair styling",
        pricingInfo: "Hair styling starts at ₹800",
        customInstructions: expect.stringContaining("Which service or occasion")
      }),
      expect.anything(),
      expect.any(Array),
      "Please stop contacting me"
    );
    expect(tool).not.toHaveBeenCalled();
    const result = await PhoneService.completeCall(organizationId, session.callSid, 0);
    expect(result.session).toMatchObject({ status: "COMPLETED", durationSeconds: 0, aiSummary: "Demo ended" });
    expect(result.session.transcriptJson).toContain("Please stop contacting me");
    const savedLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(savedLead).toMatchObject({ isOptedOut: false, status: "NEW", intentScore: 0 });
  } finally {
    vi.restoreAllMocks();
  }
});
