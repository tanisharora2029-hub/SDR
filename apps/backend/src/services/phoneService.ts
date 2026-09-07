import { prisma } from "../lib/prisma.js";
import { aiService } from "./ai/aiService.js";
import { ToolExecutor } from "./toolExecutor.js";
import { WhisperService } from "./whisperService.js";
import { SdrContext, LeadContext, ConversationTurn } from "./ai/types.js";
import { logger } from "../lib/logger.js";

export class PhoneService {
  static async initiateCall(organizationId: string, leadId: string, direction: "OUTBOUND" | "INBOUND" = "OUTBOUND") {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const sdr = await prisma.sdrProfile.findFirst({ where: { organizationId } });
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });

    if (!org || !sdr || !lead) throw new Error("Missing organization, SDR, or lead");

    const callSid = `call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Initial greeting from SDR
    const initialGreeting = direction === "OUTBOUND"
      ? `Hello ${lead.firstName}, this is ${sdr.personaName} calling from ${org.name}. I hope I didn't catch you at a bad time!`
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

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const sdr = await prisma.sdrProfile.findFirst({ where: { organizationId } });
    const lead = session.lead;

    if (!org || !sdr || !lead) throw new Error("Context missing for call turn");

    const transcript: Array<{ speaker: string; text: string; timestamp: number }> = JSON.parse(
      session.transcriptJson || "[]"
    );

    // 1. Append lead's spoken utterance
    transcript.push({ speaker: "lead", text: leadUtterance, timestamp: Date.now() });

    const sdrContext: SdrContext = {
      organizationName: org.name,
      industry: org.industry,
      valueProposition: org.valueProposition,
      targetCustomerIcp: org.targetCustomerIcp,
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
- Ask exactly ONE clear question at a time to keep conversational turns fast and responsive.`
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

    // Enforce concise spoken length (1-2 crisp sentences under 30 words total)
    const words = cleanSpeech.split(/\s+/).filter(Boolean);
    if (words.length > 28) {
      const sentences = cleanSpeech.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        let concise = sentences[0].trim();
        if (sentences.length > 1) {
          const combined = `${concise} ${sentences[1].trim()}`;
          if (combined.split(/\s+/).length <= 28) {
            concise = combined;
          }
        }
        cleanSpeech = concise;
      } else {
        cleanSpeech = words.slice(0, 25).join(" ") + ".";
      }
    }

    // If tool was decided during call (e.g. calendar booking or handoff)
    let toolResult = null;
    if (aiResponse.toolDecision) {
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
        durationSeconds: durationSeconds || 45,
        aiSummary: analysis.summary,
        qualificationScore: analysis.qualificationScore
      }
    });

    // Update lead intent score based on call outcome
    await prisma.lead.update({
      where: { id: session.leadId },
      data: {
        intentScore: Math.max(session.lead.intentScore, analysis.qualificationScore)
      }
    });

    return { session: updated, analysis };
  }
}