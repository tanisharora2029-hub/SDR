import { ChannelManager } from "./channels/channelManager.js";
import { prisma } from "../lib/prisma.js";
import { aiService } from "./ai/aiService.js";
import { ToolExecutor } from "./toolExecutor.js";
import { SdrContext, LeadContext } from "./ai/types.js";
import { logger } from "../lib/logger.js";

export class LeadService {
  static async getLeads(organizationId: string, status?: string) {
    return prisma.lead.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {})
      },
      orderBy: { updatedAt: "desc" },
      include: {
        appointments: true,
        followUpTasks: { where: { status: "SCHEDULED" } },
        _count: { select: { conversations: true, callSessions: true } }
      }
    });
  }

  static async getLeadById(organizationId: string, id: string) {
    return prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        conversations: {
          include: { messages: { orderBy: { createdAt: "asc" } } }
        },
        callSessions: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { scheduledAt: "desc" } },
        followUpTasks: { orderBy: { scheduledFor: "asc" } }
      }
    });
  }

  static async createLead(organizationId: string, data: any) {
    return prisma.lead.create({
      data: {
        organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        industry: data.industry,
        location: data.location,
        source: data.source || "MANUAL",
        notes: data.notes || null,
        tags: data.tags || null,
        customData: data.customData ? JSON.stringify(data.customData) : null
      }
    });
  }

  static async importLeadsCsv(organizationId: string, leads: any[]) {
    let imported = 0;
    for (const item of leads) {
      if (!item.email || !item.firstName || !item.companyName) continue;
      await prisma.lead.upsert({
        where: { organizationId_email: { organizationId, email: item.email } },
        create: {
          organizationId,
          firstName: item.firstName,
          lastName: item.lastName || "",
          email: item.email,
          phone: item.phone || null,
          companyName: item.companyName,
          jobTitle: item.jobTitle || null,
          industry: item.industry || null,
          location: item.location || null
        },
        update: {
          companyName: item.companyName,
          jobTitle: item.jobTitle || undefined
        }
      });
      imported++;
    }
    return { imported };
  }

  static async triggerAiOutreach(organizationId: string, leadId: string) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const sdr = await prisma.sdrProfile.findFirst({ where: { organizationId } });
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });

    if (!org || !sdr || !lead) {
      throw new Error("Missing organization, SDR profile, or lead");
    }

    if (lead.isOptedOut || lead.status === "OPTED_OUT") {
      throw new Error("Lead has opted out of communication");
    }

    const sdrContext: SdrContext = {
      organizationName: org.name,
      industry: org.industry,
      valueProposition: org.valueProposition,
      targetCustomerIcp: org.targetCustomerIcp,
      knowledgeBase: org.knowledgeBase,
      objectionRules: org.objectionRules,
      personaName: sdr.personaName,
      personaTitle: sdr.title,
      tone: sdr.tone,
      qualificationFramework: sdr.qualificationFramework,
      customInstructions: sdr.customInstructions
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

    const aiResult = await aiService.generateOutreach(sdrContext, leadContext);

    // If AI decided a tool call (send_email)
    if (aiResult.toolDecision) {
      const toolRes = await ToolExecutor.executeTool(organizationId, aiResult.toolDecision);
      return { aiResult, toolExecution: toolRes };
    }

    // Otherwise, create draft message
    let conv = await prisma.conversation.findFirst({
      where: { leadId, organizationId, channel: "EMAIL" }
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: { organizationId, leadId, channel: "EMAIL", subject: `Introducing ${org.name}` }
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        senderRole: "AI",
        senderId: sdr.id,
        recipientId: lead.id,
        content: aiResult.content,
        senderName: sdr.personaName,
        status: "SENT",
        aiReasoning: `Generated by ${aiResult.provider} in ${aiResult.latencyMs}ms`
      }
    });

    // Dispatch via channel abstraction
    await ChannelManager.dispatch("EMAIL", {
      to: lead.email,
      content: aiResult.content,
      subject: `Introducing ${org.name}`,
      senderName: sdr.personaName,
      senderEmail: (sdr as any).email || "alex@nexsdr.in",
      replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
      leadId: lead.id,
      organizationId
    }).catch((err) => logger.warn(`Outreach email dispatch failed: ${err.message}`));

    // Record activity log for cold outreach
    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "OUTREACH",
        action: "AI_OUTREACH_SENT",
        detailsJson: JSON.stringify({
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName}`.trim(),
          companyName: lead.companyName,
          channel: "EMAIL"
        })
      }
    });

    await prisma.lead.updateMany({
      where: { id: leadId, organizationId },
      data: { status: "CONTACTED" }
    });

    return { aiResult, message };
  }
}