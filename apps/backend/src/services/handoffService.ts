import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export class HandoffService {
  static async getEscalations(organizationId: string) {
    return prisma.lead.findMany({
      where: {
        organizationId,
        OR: [
          { status: "HANDOFF_REQUIRED" },
          { conversations: { some: { isEscalated: true } } }
        ]
      },
      orderBy: { updatedAt: "desc" },
      include: {
        conversations: {
          include: { messages: { orderBy: { createdAt: "asc" } } }
        },
        callSessions: { orderBy: { createdAt: "desc" } },
        appointments: true
      }
    });
  }

  static async getLeadDossier(organizationId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: {
        conversations: {
          include: { messages: { orderBy: { createdAt: "asc" } } }
        },
        callSessions: { orderBy: { createdAt: "desc" } },
        appointments: true,
        followUpTasks: true
      }
    });

    if (!lead) throw new Error("Lead not found");

    const escalatedConv = lead.conversations.find(c => c.isEscalated);
    const bant = lead.bantScorecard ? JSON.parse(lead.bantScorecard) : null;

    return {
      lead,
      qualificationScorecard: bant,
      escalationReason: escalatedConv?.escalationReason || "High Intent / Complex Technical Requirements",
      escalatedAt: escalatedConv?.escalatedAt || lead.updatedAt,
      conversations: lead.conversations,
      callSessions: lead.callSessions,
      recommendedNextAction: "Review custom compliance/procurement requirements and schedule an Account Executive discovery call."
    };
  }

  static async resolveEscalation(
    organizationId: string,
    leadId: string,
    resolution: "CONVERTED" | "QUALIFIED" | "RETURN_TO_AI" | "CLOSED_LOST"
  ) {
    const newStatus = resolution === "RETURN_TO_AI" ? "IN_CONVERSATION" : resolution;

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: newStatus }
    });

    await prisma.conversation.updateMany({
      where: { leadId, organizationId },
      data: {
        isEscalated: false,
        isAiActive: resolution === "RETURN_TO_AI"
      }
    });

    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "HANDOFF",
        action: "HANDOFF_RESOLVED",
        detailsJson: JSON.stringify({ leadId, resolution })
      }
    });

    logger.info(`Escalation for lead ${leadId} resolved with status ${resolution}`);
    return { success: true, leadId, resolution };
  }
}