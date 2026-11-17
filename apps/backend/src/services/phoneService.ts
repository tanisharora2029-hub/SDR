import { prisma } from "../lib/prisma.js";
import { aiService } from "./ai/aiService.js";
import { ToolExecutor } from "./toolExecutor.js";
import { WhisperService } from "./whisperService.js";
import { SdrContext, LeadContext, ConversationTurn } from "./ai/types.js";
import { logger } from "../lib/logger.js";
import { randomUUID } from "node:crypto";

const SIMULATION_PREFIX = "demo_";

export class PhoneService {
  static async initiateCall(
    organizationId: string,
    leadId: string,
    direction: "OUTBOUND" | "INBOUND" = "OUTBOUND",
    simulation = false
  ) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const sdr = await prisma.sdrProfile.findFirst({ where: { organizationId } });
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });

    if (!org || !sdr || !lead) throw new Error("Missing organization, SDR, or lead");

    const callSid = `${simulation ? SIMULATION_PREFIX : "call_"}${randomUUID()}`;

    // Initial greeting from SDR with neutral fallback
    const hasLeadFirstName = Boolean(lead.firstName && lead.firstName.trim() && lead.firstName.toLowerCase() !== "unknown");
    const greetingTarget = hasLeadFirstName ? ` ${lead.firstName}` : "";
    const initialGreeting = direction === "OUTBOUND"
      ? `Hello${greetingTarget}, this is ${sdr.personaName} calling from ${org.name}. I hope I didn't catch you at a bad time!`
      : `Thank you for calling ${org.name}! My name is ${sdr.personaName}. How can I assist you today?`;

    const session = await prisma.callSession.create({
      data: {
        organizationId,
        leadId,
        callSid,
        direction,
        status: "IN_PROGRESS",
        transcriptJson: JSON.stringify([
          { speaker: "sdr", text: initialGreeting, timestamp: Date.now() }
        ])
      }
    });

    // Record usage
    await prisma.usageRecord.create({
      data: { organizationId, metricType: "AI_CALL_INITIATED", quantity: 1 }
    });

    return { session, greeting: initialGreeting };
  }

  static async processCallTurn(organizationId: string, callSid: string, leadUtterance: string) {
    const session = await prisma.callSession.findUnique({
      where: { callSid },
      include: { lead: true }
    });

    if (!session || session.organizationId !== organizationId) {
      throw new Error("Call session not found or unauthorized");
    }
    const simulation = session.callSid.startsWith(SIMULATION_PREFIX);

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const sdr = await prisma.sdrProfile.findFirst({ where: { organizationId } });
    const lead = session.lead;

    if (!org || !sdr || !lead) throw new Error("Context missing for call turn");

    const transcript: Array<{ speaker: string; text: string; timestamp: number }> = JSON.parse(
      session.transcriptJson || "[]"
    );

    // 1. Append lead's spoken utterance
    transcript.push({ speaker: "lead", text: leadUtterance, timestamp: Date.now() });

    // Live STOP / DNC opt-out safety check
    if (!simulation && /\b(stop|unsubscribe|do not call|don't call|remove me|opt out)\b/i.test(leadUtterance)) {
      await prisma.lead.updateMany({
        where: { id: lead.id, organizationId },
        data: { isOptedOut: true, status: "OPTED_OUT" }
      });
      await prisma.followUpTask.updateMany({
        where: { leadId: lead.id, organizationId, status: "SCHEDULED" },
        data: { status: "CANCELLED" }
      });
      await prisma.conversation.updateMany({
        where: { leadId: lead.id, organizationId },
        data: { isAiActive: false }
      });
      const dncSpeech = "Understood. I have updated our records and added you to our do not call list. Have a great day.";
      transcript.push({ speaker: "sdr", text: dncSpeech, timestamp: Date.now() });
      await prisma.callSession.update({
        where: { callSid },
        data: { transcriptJson: JSON.stringify(transcript), status: "COMPLETED" }
      });
      return {
        callSid,
        sdrSpeech: dncSpeech,
        toolExecution: null,
        latencyMs: 0,
        whisperDossier: null,
        transcript
      };
    }

    const sdrContext: SdrContext = {
      organizationName: org.name,
      industry: org.industry,
      valueProposition: org.valueProposition,
      targetCustomerIcp: org.targetCustomerIcp,
      companyDescription: (org as any).companyDescription,
      products: (org as any).products,
      pricingInfo: (org as any).pricingInfo,
      complianceInfo: (org as any).complianceInfo,
      competitors: (org as any).competitors,
      knowledgeBase: org.knowledgeBase,
      objectionRules: org.objectionRules,
      personaName: sdr.personaName,
      personaTitle: sdr.title,
      tone: "Natural spoken conversation, crisp phone dialogue, consultative",
      qualificationFramework: sdr.qualificationFramework,
      customInstructions: `CRITICAL VOICE CALL RULES:
- Reply in 1 to 2 short, crisp spoken sentences (strictly under 25 words total).
- Use natural spoken language appropriate for a live telephone call.
- NEVER use markdown, bullet points, numbered lists, asterisks, bolding, or headers.
- NEVER output raw JSON, internal tool syntax, or function names in your spoken reply.
- NEVER generate long paragraphs.
- Ask at most ONE clear question at a time to keep conversational turns fast and responsive.
${simulation ? "- This is a browser simulation. Do not claim that a booking, call, opt-out, email or other real-world action has occurred. You may capture a preference for staff review. Respect the user's request to end the conversation." : ""}`
    };

    const leadContext: LeadContext = {
      leadId: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      companyName: lead.companyName,
      jobTitle: lead.jobTitle,
      industry: lead.industry,
      status: lead.status,
      intentScore: lead.intentScore
    };

    const turns: ConversationTurn[] = transcript.map(t => ({
      speaker: t.speaker as any,
      channel: "PHONE",
      content: t.text,
      timestamp: new Date(t.timestamp).toISOString()
    }));

    // Update live Whisper Mode telemetry dossier for real-time human assistance
    const whisperDossier = await WhisperService.updateLiveWhisperAssist(
      organizationId,
      callSid,
      leadUtterance,
      transcript
    );

    // If human representative took over, AI MUST NEVER speak
    if (WhisperService.isTakeoverActive(callSid)) {
      await prisma.callSession.update({
        where: { callSid },
        data: { transcriptJson: JSON.stringify(transcript) }
      });
      return {
        callSid,
        sdrSpeech: "",
        isHumanTakeover: true,
        whisperDossier,
        toolExecution: null,
        latencyMs: 0,
        transcript
      };
    }

    // 2. Generate SDR voice response using Online Provider by default (zero GPU)
    const aiResponse = await aiService.respondToVoiceMessage(sdrContext, leadContext, turns, leadUtterance);

    // Sanitize spoken speech for live audio telephony (Bug 4)
    let cleanSpeech = (aiResponse.content || "")
      .replace(/[*_#`~]/g, "") // remove markdown symbols
      .replace(/^\s*[-•]\s*/gm, "") // remove list bullets
      .replace(/\s+/g, " ")
      .trim();

    // Context safety & de-hallucination guards
    const leadCompUnknown = !lead.companyName || lead.companyName.toLowerCase() === "unknown";
    const leadNameUnknown = !lead.firstName || lead.firstName.toLowerCase() === "unknown";
    if (leadCompUnknown) {
      cleanSpeech = cleanSpeech.replace(/\b(?:at\s+)?technew\b/gi, "").replace(/\s{2,}/g, " ").trim();
      cleanSpeech = cleanSpeech.replace(/\b(?:at\s+)?CloudFlow\s*AI\b/gi, "").replace(/\s{2,}/g, " ").trim();
    }
    if (leadNameUnknown) {
      cleanSpeech = cleanSpeech.replace(/\b(?:hi|hello|hey|thanks for getting back to me,?)\s+tanish\b/gi, "Hello,").trim();
    }
    cleanSpeech = cleanSpeech.replace(/\bCloudFlow\s*AI\b/gi, org.name || "NexSDR");

    // Remove duplicate company prefix boilerplate in spoken voice
    cleanSpeech = cleanSpeech.replace(/^At\s+([A-Za-z0-9_-]+),\s+\1\b/i, "At $1, we");
    cleanSpeech = cleanSpeech.replace(/^At\s+([A-Za-z0-9_-]+),\s+at\s+\1\b/i, "At $1, we");

    // In multi-turn voice calls, strip opening company intro if ongoing turn
    if (transcript.length > 2) {
      cleanSpeech = cleanSpeech.replace(/^At\s+[A-Za-z0-9_-]+,\s+(?:we\s+)?/i, "").trim();
      if (cleanSpeech.length > 0) {
        cleanSpeech = cleanSpeech.charAt(0).toUpperCase() + cleanSpeech.slice(1);
      }
    }

    // Enforce concise spoken length (1-2 crisp sentences under 35 words total)
    const words = cleanSpeech.split(/\s+/).filter(Boolean);
    if (words.length > 35) {
      const sentences = cleanSpeech.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        let concise = sentences[0].trim();
        if (sentences.length > 1) {
          const combined = `${concise} ${sentences[1].trim()}`;
          if (combined.split(/\s+/).length <= 35) {
            concise = combined;
          }
        }
        cleanSpeech = concise;
      } else {
        cleanSpeech = words.slice(0, 30).join(" ") + ".";
      }
    }

    // If tool was decided during call (e.g. calendar booking or handoff)
    let toolResult = null;
    if (aiResponse.toolDecision && !simulation) {
      toolResult = await ToolExecutor.executeTool(organizationId, aiResponse.toolDecision);
    }

    transcript.push({ speaker: "sdr", text: cleanSpeech, timestamp: Date.now() });

    await prisma.callSession.update({
      where: { callSid },
      data: {
        transcriptJson: JSON.stringify(transcript)
      }
    });

    return {
      callSid,
      sdrSpeech: cleanSpeech,
      toolExecution: toolResult,
      latencyMs: aiResponse.latencyMs,
      whisperDossier,
      transcript
    };
  }

  static async completeCall(organizationId: string, callSid: string, durationSeconds: number) {
    const session = await prisma.callSession.findUnique({
      where: { callSid },
      include: { lead: true }
    });

    if (!session || session.organizationId !== organizationId) {
      throw new Error("Call session not found or unauthorized");
    }

    const transcript: Array<{ speaker: string; text: string }> = JSON.parse(
      session.transcriptJson || "[]"
    );

    const leadContext: LeadContext = {
      leadId: session.lead.id,
      firstName: session.lead.firstName,
      lastName: session.lead.lastName,
      email: session.lead.email,
      companyName: session.lead.companyName,
      status: session.lead.status,
      intentScore: session.lead.intentScore
    };

    const analysis = await aiService.summarizeCall(transcript, leadContext);

    const updated = await prisma.callSession.update({
      where: { callSid },
      data: {
        status: "COMPLETED",
        durationSeconds: durationSeconds ?? 0,
        aiSummary: analysis.summary,
        qualificationScore: analysis.qualificationScore
      }
    });

    if (!session.callSid.startsWith(SIMULATION_PREFIX)) {
      await prisma.lead.update({
        where: { id: session.leadId },
        data: {
          intentScore: Math.max(session.lead.intentScore, analysis.qualificationScore)
        }
      });
    }

    return { session: updated, analysis };
  }
}
