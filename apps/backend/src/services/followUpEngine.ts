import { prisma } from "../lib/prisma.js";
import { LeadService } from "./leadService.js";
import { logger } from "../lib/logger.js";

export class FollowUpEngine {
  static async getRules(organizationId: string) {
    return prisma.followUpRule.findMany({
      where: { organizationId },
      orderBy: { stepNumber: "asc" }
    });
  }

  static async createRule(organizationId: string, data: any) {
    return prisma.followUpRule.create({
      data: {
        organizationId,
        stepNumber: data.stepNumber,
        channel: data.channel || "EMAIL",
        delayDays: data.delayDays || 3,
        condition: data.condition || "NO_REPLY",
        templatePrompt: data.templatePrompt || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });
  }

  static async getPendingTasks(organizationId: string) {
    return prisma.followUpTask.findMany({
      where: { organizationId, status: "SCHEDULED" },
      orderBy: { scheduledFor: "asc" },
      include: { lead: true }
    });
  }

  static async runPendingTasks(organizationId: string) {
    const now = new Date();
    const tasks = await prisma.followUpTask.findMany({
      where: {
        organizationId,
        status: "SCHEDULED",
        scheduledFor: { lte: now }
      },
      include: { lead: true }
    });

    logger.info(`Running ${tasks.length} due follow-up tasks for org ${organizationId}`);
    const results = [];

    for (const task of tasks) {
      // 1. Check if lead has opted out or already converted
      if (task.lead.isOptedOut || task.lead.status === "OPTED_OUT" || task.lead.status === "CONVERTED") {
        await prisma.followUpTask.updateMany({
          where: { id: task.id, organizationId, leadId: task.leadId },
          data: { status: "CANCELLED" }
        });
        results.push({ taskId: task.id, status: "SKIPPED_OPTED_OUT" });
        continue;
      }

      try {
        // Trigger outreach
        const outreach = await LeadService.triggerAiOutreach(organizationId, task.leadId);
        await prisma.followUpTask.updateMany({
          where: { id: task.id, organizationId, leadId: task.leadId },
          data: { status: "EXECUTED", executedAt: new Date() }
        });

        // Schedule next cadence step if rule exists
        const nextRule = await prisma.followUpRule.findFirst({
          where: {
            organizationId,
            stepNumber: task.stepNumber + 1,
            isActive: true
          }
        });

        if (nextRule) {
          const nextDate = new Date(Date.now() + nextRule.delayDays * 86400000);
          await prisma.followUpTask.create({
            data: {
              organizationId,
              leadId: task.leadId,
              stepNumber: nextRule.stepNumber,
              channel: nextRule.channel,
              scheduledFor: nextDate,
              status: "SCHEDULED"
            }
          });
        }

        results.push({ taskId: task.id, status: "EXECUTED", outreach });
      } catch (err: any) {
        logger.error(`Failed to execute follow-up task ${task.id}:`, err);
        results.push({ taskId: task.id, status: "FAILED", error: err.message });
      }
    }

    return { executedCount: results.filter(r => r.status === "EXECUTED").length, results };
  }
}