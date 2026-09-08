import { prisma } from "../lib/prisma.js";

export class AnalyticsService {
  static async getOverview(organizationId: string) {
    const [
      totalLeads,
      contactedCount,
      inConversationCount,
      qualifiedCount,
      handoffCount,
      appointmentsBooked,
      emailMessages,
      calls
    ] = await Promise.all([
      prisma.lead.count({ where: { organizationId } }),
      prisma.lead.count({ where: { organizationId, status: { in: ["CONTACTED", "IN_CONVERSATION", "QUALIFIED", "CONVERTED", "HANDOFF_REQUIRED"] } } }),
      prisma.lead.count({ where: { organizationId, status: "IN_CONVERSATION" } }),
      prisma.lead.count({ where: { organizationId, status: { in: ["QUALIFIED", "CONVERTED"] } } }),
      prisma.lead.count({ where: { organizationId, status: "HANDOFF_REQUIRED" } }),
      prisma.appointment.count({ where: { organizationId } }),
      prisma.message.count({ where: { conversation: { organizationId }, channel: "EMAIL", direction: "OUTBOUND" } }),
      prisma.callSession.count({ where: { organizationId } })
    ]);

    const activeFollowups = await prisma.followUpTask.count({
      where: { organizationId, status: "SCHEDULED" }
    });

    const responseRatePct = contactedCount > 0
      ? Math.round(((inConversationCount + qualifiedCount + handoffCount) / contactedCount) * 100)
      : 0;

    const qualificationRatePct = contactedCount > 0
      ? Math.round(((qualifiedCount + appointmentsBooked) / contactedCount) * 100)
      : 0;

    const recentActivities = await prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    return {
      totalLeads,
      contactedCount,
      inConversationCount,
      qualifiedCount,
      appointmentsBooked,
      humanHandoffsCount: handoffCount,
      responseRatePct,
      qualificationRatePct,
      emailsSent: emailMessages,
      callsPlaced: calls,
      activeFollowups,
      channelBreakdown: {
        email: emailMessages,
        phone: calls,
        whatsapp: 0
      },
      recentActivities
    };
  }
}