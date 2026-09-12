import { ChannelManager } from "./channels/channelManager.js";
import { prisma } from "../lib/prisma.js";
import { aiService } from "./ai/aiService.js";
import { ToolExecutor } from "./toolExecutor.js";
import { SdrContext, LeadContext } from "./ai/types.js";
import { logger } from "../lib/logger.js";
import { broadcastToOrganization } from "../lib/wsBroadcaster.js";

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
    const lead = await prisma.lead.findFirst({
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
    if (!lead) return null;

    const isDnc = Boolean(lead.isOptedOut || lead.status === "OPTED_OUT");
    if (isDnc && lead.conversations) {
      lead.conversations = lead.conversations.map((c) => ({
        ...c,
        isAiActive: false
      }));
    }
    return lead;
  }

  static async createLead(organizationId: string, data: any) {
    const normalizedEmail = (data.email || "").toLowerCase().trim();
    return prisma.lead.create({
      data: {
        organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: normalizedEmail,
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
      const normalizedEmail = item.email.toLowerCase().trim();
      await prisma.lead.upsert({
        where: { organizationId_email: { organizationId, email: normalizedEmail } },
        create: {
          organizationId,
          firstName: item.firstName,
          lastName: item.lastName || "",
          email: normalizedEmail,
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
      companyDescription: (org as any).companyDescription,
      products: (org as any).products,
      pricingInfo: (org as any).pricingInfo,
      complianceInfo: (org as any).complianceInfo,
      competitors: (org as any).competitors,
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

    let aiResult;
    try {
      aiResult = await aiService.generateOutreach(sdrContext, leadContext);
    } catch (err: any) {
      logger.error(`AI outreach generation failed for lead ${leadId}: ${err.message}`);
      throw new Error(`Unable to generate outreach: ${err.message}`);
    }

    // Extract body and subject with non-empty guarantees
    let emailSubject = `Introducing ${org.name}`;
    let emailBody = "";

    if (aiResult.toolDecision?.arguments) {
      emailSubject = aiResult.toolDecision.arguments.subject || emailSubject;
      emailBody = aiResult.toolDecision.arguments.body || aiResult.toolDecision.arguments.content || aiResult.toolDecision.arguments.text || "";
    }
    if (!emailBody && aiResult.content) {
      emailBody = aiResult.content;
    }
    if (!emailBody) {
      emailBody = `Hi ${lead.firstName || "there"},\n\nI wanted to introduce ${org.name}. Given your team's focus at ${lead.companyName}, I would love to explore how our autonomous capabilities can streamline your operational workflows.\n\nBest regards,\n${sdr.personaName}\n${sdr.title} | ${org.name}`;
    }

    // Find or create conversation
    let conv = await prisma.conversation.findFirst({
      where: { leadId, organizationId, channel: "EMAIL" }
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: { organizationId, leadId, channel: "EMAIL", subject: emailSubject }
      });
    }

    // Persist message record
    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        senderRole: "AI",
        senderId: sdr.id,
        recipientId: lead.id,
        content: emailBody,
        senderName: sdr.personaName,
        status: "SENT",
        aiReasoning: `Generated by ${aiResult.provider} in ${aiResult.latencyMs}ms`
      }
    });

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() }
    }).catch(() => {});

    broadcastToOrganization(organizationId, {
      type: "MESSAGE_CREATED",
      payload: { conversationId: conv.id, message }
    });
    broadcastToOrganization(organizationId, {
      type: "CONVERSATION_UPDATED",
      payload: { conversationId: conv.id, leadId }
    });

    // Real dispatch via ChannelManager / EmailService
    let deliverySuccess = true;
    let deliveryError: string | null = null;
    let deliveryProvider: string = "RESEND";

    try {
      const dispatchRes: any = await ChannelManager.dispatch("EMAIL", {
        to: lead.email,
        content: emailBody,
        subject: emailSubject,
        senderName: sdr.personaName,
        senderEmail: (sdr as any).email || "alex@nexsdr.in",
        replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
        leadId: lead.id,
        organizationId
      });

      if (dispatchRes?.externalMessageId || dispatchRes?.messageId) {
        deliveryProvider = dispatchRes.provider || (dispatchRes.providerStatus === "REAL" ? "RESEND" : "SIMULATOR");
        await prisma.message.update({
          where: { id: message.id },
          data: {
            toolCallArgs: JSON.stringify({ externalMessageId: dispatchRes.externalMessageId || dispatchRes.messageId, provider: deliveryProvider })
          }
        }).catch(() => {});
      }
    } catch (dispatchErr: any) {
      deliverySuccess = false;
      deliveryError = dispatchErr.message || "Email dispatch failed";
      logger.warn(`Outreach email dispatch failed for lead ${lead.id}: ${deliveryError}`);
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "DELIVERY_FAILED", aiReasoning: `Dispatch failed: ${deliveryError}` }
      }).catch(() => {});
    }

    // Record activity log for cold outreach
    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "OUTREACH",
        action: deliverySuccess ? "AI_OUTREACH_SENT" : "AI_OUTREACH_DISPATCH_FAILED",
        detailsJson: JSON.stringify({
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName}`.trim(),
          companyName: lead.companyName,
          channel: "EMAIL",
          deliverySuccess,
          deliveryError
        })
      }
    }).catch(() => {});

    if (deliverySuccess) {
      await prisma.lead.updateMany({
        where: { id: leadId, organizationId },
        data: { status: "CONTACTED" }
      });
    }

    return {
      aiResult,
      message,
      subject: emailSubject,
      body: emailBody,
      outreachGenerated: true,
      deliverySuccess,
      deliveryError,
      provider: deliveryProvider
    };
  }

  static async deleteLead(organizationId: string, leadId: string) {
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, organizationId }
    });
    if (!existing) {
      throw new Error("Lead not found or unauthorized");
    }

    // Atomic cascade deletion across all child relations
    await prisma.$transaction([
      prisma.message.deleteMany({
        where: {
          conversation: {
            leadId,
            organizationId
          }
        }
      }),
      prisma.conversation.deleteMany({
        where: { leadId, organizationId }
      }),
      prisma.callSession.deleteMany({
        where: { leadId, organizationId }
      }),
      prisma.followUpTask.deleteMany({
        where: { leadId, organizationId }
      }),
      prisma.appointment.deleteMany({
        where: { leadId, organizationId }
      }),
      prisma.lead.delete({
        where: { id: leadId }
      })
    ]);

    broadcastToOrganization(organizationId, {
      type: "LEAD_DELETED",
      payload: { leadId }
    });

    logger.info(`Lead ${leadId} (${existing.email}) deleted cleanly with full cascade.`);
    return { success: true, message: "Lead deleted successfully", leadId };
  }
}