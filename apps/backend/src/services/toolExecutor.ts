import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { SdrToolDecision, ToolExecutionResult } from "@ai-sdr/shared";
import { EmailService } from "./emailService.js";
import { CalendarService } from "./calendarService.js";

export class ToolExecutor {
  static async executeTool(
    organizationId: string,
    decision: SdrToolDecision
  ): Promise<ToolExecutionResult> {
    const { tool, arguments: args } = decision;
    logger.ai(`Executing SDR tool decision: ${tool}`, { organizationId, args });

    try {
      // 1. Authenticated tenant context & lead ownership check
      let leadRecord: any = null;
      if (args.lead_id) {
        leadRecord = await prisma.lead.findFirst({
          where: { id: args.lead_id, organizationId }
        });

        if (!leadRecord) {
          logger.warn(`Authorization failure: Lead ${args.lead_id} does not belong to organization ${organizationId}`);
          return { tool, success: false, error: `Unauthorized: Lead ${args.lead_id} not found in this organization` };
        }

        // 2. Opt-out safety enforcement: hard-block outbound tools
        if ((leadRecord.isOptedOut || leadRecord.status === "OPTED_OUT") && (tool === "send_email" || tool === "schedule_call" || tool === "create_followup" || tool === "create_calendar_event")) {
          logger.warn(`Outbound action blocked: Lead ${leadRecord.email} has opted out.`);
          return {
            tool,
            success: false,
            error: `Action blocked: Lead ${leadRecord.email} has opted out of communications.`
          };
        }
      }

      switch (tool) {
        case "send_email": {
          const leadId = args.lead_id;
          const targetLead = leadRecord || (await prisma.lead.findFirst({ where: { id: leadId, organizationId } }));
          if (!targetLead) {
            return { tool, success: false, error: `Lead ${leadId} not found` };
          }
          if (targetLead.isOptedOut || targetLead.status === "OPTED_OUT") {
            return {
              tool,
              success: false,
              error: `Action blocked: Lead ${targetLead.email} has opted out of communications.`
            };
          }
          const subject = args.subject || "Message from your SDR";
          const body = args.body || "";

          // Ensure conversation exists
          let conv = await prisma.conversation.findFirst({
            where: { leadId, organizationId, channel: "EMAIL" }
          });

          if (!conv) {
            conv = await prisma.conversation.create({
              data: {
                organizationId,
                leadId,
                channel: "EMAIL",
                subject
              }
            });
          }

          // Prevent duplicate sends within 5 minutes (Idempotency)
          const recentDuplicate = await prisma.message.findFirst({
            where: {
              conversationId: conv.id,
              direction: "OUTBOUND",
              content: body,
              createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
            }
          });

          if (recentDuplicate) {
            logger.info(`Duplicate email send suppressed for lead ${leadId} within 5-minute idempotency window.`);
            return {
              tool,
              success: true,
              data: {
                messageId: recentDuplicate.id,
                conversationId: conv.id,
                isDuplicateSuppressed: true
              }
            };
          }

          // Real email dispatch through EmailService
          const sdrProfile = await prisma.sdrProfile.findFirst({ where: { organizationId } });
          const sdrName = sdrProfile?.personaName || "Alex";

          let emailSendResult = { success: true, messageId: `msg_${Date.now()}`, previewUrl: undefined as string | undefined, isSimulated: true };
          if (leadRecord?.email) {
            const sendRes = await EmailService.sendEmail({
              to: leadRecord.email,
              subject,
              text: body,
              leadId,
              organizationId,
              senderName: sdrName
            });
            if (sendRes.success) {
              emailSendResult = {
                success: true,
                messageId: sendRes.messageId || `msg_${Date.now()}`,
                previewUrl: (sendRes.previewUrl || undefined) as string | undefined,
                isSimulated: sendRes.isSimulated
              };
            }
          }

          const message = await prisma.message.create({
            data: {
              conversationId: conv.id,
              channel: "EMAIL",
              direction: "OUTBOUND",
              senderRole: "AI",
              senderId: sdrProfile?.id || null,
              recipientId: leadId,
              content: body,
              senderName: sdrName,
              status: "SENT",
              toolCallName: "send_email",
              toolCallArgs: JSON.stringify({ ...args, previewUrl: emailSendResult.previewUrl })
            }
          });

          // Update lead status to CONTACTED if it was NEW
          await prisma.lead.updateMany({
            where: { id: leadId, organizationId, status: "NEW" },
            data: { status: "CONTACTED" }
          });

          // Record usage
          await prisma.usageRecord.create({
            data: { organizationId, metricType: "AI_EMAIL_SENT", quantity: 1 }
          });

          // Complete audit logging
          await prisma.activityLog.create({
            data: {
              organizationId,
              category: "EMAIL",
              action: "EMAIL_SENT",
              detailsJson: JSON.stringify({
                leadId,
                messageId: message.id,
                subject,
                previewUrl: emailSendResult.previewUrl,
                isTestEmail: !!emailSendResult.previewUrl
              })
            }
          });

          return {
            tool,
            success: true,
            data: {
              messageId: message.id,
              conversationId: conv.id,
              previewUrl: emailSendResult.previewUrl,
              deliveryMode: emailSendResult.previewUrl ? "TEST_EMAIL_ETHEREAL" : "PRODUCTION_SMTP"
            }
          };
        }

        case "read_email": {
          const leadId = args.lead_id;
          const conv = await prisma.conversation.findFirst({
            where: { leadId, organizationId, channel: "EMAIL" },
            include: { messages: { orderBy: { createdAt: "desc" }, take: 10 } }
          });

          return { tool, success: true, data: { messages: conv?.messages || [] } };
        }

        case "check_calendar_availability": {
          const dateStr = args.date;
          const targetDate = new Date(dateStr);
          const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
          const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

          const existing = await prisma.appointment.findMany({
            where: {
              organizationId,
              scheduledAt: { gte: startOfDay, lte: endOfDay }
            }
          });

          const bookedHours = existing.map(a => new Date(a.scheduledAt).getUTCHours());
          const availableSlots = [10, 11, 14, 15, 16]
            .filter(h => !bookedHours.includes(h))
            .map(h => `${dateStr}T${h.toString().padStart(2, "0")}:00:00.000Z`);

          return {
            tool,
            success: true,
            data: {
              date: dateStr,
              availableSlots,
              calendarMode: "LOCAL_RFC5545"
            }
          };
        }

        case "create_calendar_event": {
          const { lead_id, title, start_time, duration_minutes } = args;
          const lead = leadRecord || (await prisma.lead.findFirst({ where: { id: lead_id, organizationId } }));

          if (!lead) {
            return { tool, success: false, error: "Lead not found" };
          }

          if (lead.isOptedOut || lead.status === "OPTED_OUT") {
            return {
              tool,
              success: false,
              error: `Action blocked: Lead ${lead.email} has opted out of communications.`
            };
          }

          const startTime = new Date(start_time);
          const duration = duration_minutes || 30;

          // Double-booking conflict check
          let appointmentData;
          let icsString = "";

          try {
            const res = await CalendarService.scheduleAppointment({
              organizationId,
              leadId: lead_id,
              title: title || "Intro Demo Call",
              description: `Product Discovery Call with ${lead.firstName} ${lead.lastName}`,
              startTime,
              durationMinutes: duration,
              attendeeEmail: lead.email || "prospect@example.com",
              attendeeName: `${lead.firstName} ${lead.lastName}`.trim(),
              organizerName: "AI Sales Representative"
            });
            appointmentData = res.appointment;
            icsString = res.icsContent;
          } catch (calErr: any) {
            logger.warn(`Calendar booking conflict for lead ${lead_id}: ${calErr.message}`);
            return { tool, success: false, error: calErr.message };
          }

          // Advance lead status
          await prisma.lead.updateMany({
            where: { id: lead_id, organizationId },
            data: { status: "QUALIFIED", intentScore: 90 }
          });

          await prisma.activityLog.create({
            data: {
              organizationId,
              category: "APPOINTMENT",
              action: "APPOINTMENT_BOOKED",
              detailsJson: JSON.stringify({
                appointmentId: appointmentData.id,
                title,
                start_time,
                calendarMode: "LOCAL_RFC5545"
              })
            }
          });

          return {
            tool,
            success: true,
            data: {
              ...appointmentData,
              icsContent: icsString,
              calendarMode: "LOCAL_RFC5545"
            }
          };
        }

        case "create_followup": {
          const { lead_id, cadence_step, channel, delay_days } = args;
          const lead = leadRecord || (await prisma.lead.findFirst({ where: { id: lead_id, organizationId } }));

          if (!lead) {
            return { tool, success: false, error: `Lead ${lead_id} not found` };
          }

          if (lead.isOptedOut || lead.status === "OPTED_OUT") {
            return {
              tool,
              success: false,
              error: `Action blocked: Cannot create follow-up for opted-out lead ${lead.email}.`
            };
          }

          const scheduledDate = new Date(Date.now() + (delay_days || 3) * 86400000);

          // Prevent duplicate active follow-up tasks
          const existing = await prisma.followUpTask.findFirst({
            where: {
              organizationId,
              leadId: lead_id,
              status: "SCHEDULED"
            }
          });

          if (existing) {
            logger.info(`Existing follow-up task already scheduled for lead ${lead_id}. Skipping duplicate.`);
            return {
              tool,
              success: true,
              data: { ...existing, isDuplicateSuppressed: true }
            };
          }

          const task = await prisma.followUpTask.create({
            data: {
              organizationId,
              leadId: lead_id,
              stepNumber: cadence_step || 2,
              channel: channel || "EMAIL",
              scheduledFor: scheduledDate,
              status: "SCHEDULED"
            }
          });

          // Verify DB persistence
          const verified = await prisma.followUpTask.findFirst({
            where: { id: task.id, organizationId, leadId: lead_id }
          });

          if (!verified) {
            return { tool, success: false, error: "Failed to persist follow-up task in database" };
          }

          await prisma.activityLog.create({
            data: {
              organizationId,
              category: "CADENCE",
              action: "FOLLOWUP_SCHEDULED",
              detailsJson: JSON.stringify({ taskId: task.id, leadId: lead_id, scheduledFor: scheduledDate })
            }
          });

          return { tool, success: true, data: task };
        }

        case "update_lead": {
          const { lead_id, ...updates } = args;
          await prisma.lead.updateMany({
            where: { id: lead_id, organizationId },
            data: {
              companyName: updates.company_name,
              jobTitle: updates.job_title,
              industry: updates.industry,
              intentScore: updates.intent_score
            }
          });
          const updated = await prisma.lead.findFirst({ where: { id: lead_id, organizationId } });
          return { tool, success: true, data: updated };
        }

        case "qualify_lead": {
          const { lead_id, status, ...scorecard } = args;
          const lead = leadRecord || (await prisma.lead.findFirst({ where: { id: lead_id, organizationId } }));
          if (lead?.isOptedOut || lead?.status === "OPTED_OUT") {
            return { tool, success: false, error: "Cannot qualify opted-out lead" };
          }
          await prisma.lead.updateMany({
            where: { id: lead_id, organizationId },
            data: {
              status: status || "QUALIFIED",
              bantScorecard: JSON.stringify(scorecard)
            }
          });
          const updated = await prisma.lead.findFirst({ where: { id: lead_id, organizationId } });

          await prisma.activityLog.create({
            data: {
              organizationId,
              category: "QUALIFICATION",
              action: "LEAD_QUALIFIED",
              detailsJson: JSON.stringify({ leadId: lead_id, status, scorecard })
            }
          });

          return { tool, success: true, data: updated };
        }

        case "schedule_call": {
          const { lead_id, scheduled_time, purpose } = args;
          const callSid = `call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          const session = await prisma.callSession.create({
            data: {
              organizationId,
              leadId: lead_id,
              callSid,
              direction: "OUTBOUND",
              status: "INITIATED",
              aiSummary: purpose || "Outbound consultative discovery call"
            }
          });

          return {
            tool,
            success: true,
            data: {
              ...session,
              telephonyMode: "BROWSER_SIMULATION"
            }
          };
        }

        case "log_call": {
          const { lead_id, duration_seconds, outcome, summary, qualification_score } = args;
          const session = await prisma.callSession.create({
            data: {
              organizationId,
              leadId: lead_id,
              callSid: `completed_${Date.now()}`,
              direction: "OUTBOUND",
              status: "COMPLETED",
              durationSeconds: duration_seconds || 60,
              aiSummary: summary,
              qualificationScore: qualification_score || 75
            }
          });

          return { tool, success: true, data: session };
        }

        case "human_handoff": {
          const { lead_id, reason, priority, recommended_action } = args;

          // 1. Update lead status
          await prisma.lead.update({
            where: { id: lead_id },
            data: { status: "HANDOFF_REQUIRED", intentScore: 95 }
          });

          // 2. Mark conversations as escalated
          await prisma.conversation.updateMany({
            where: { leadId: lead_id, organizationId },
            data: {
              isEscalated: true,
              escalationReason: reason,
              escalatedAt: new Date()
            }
          });

          // 3. Create activity log
          await prisma.activityLog.create({
            data: {
              organizationId,
              category: "HANDOFF",
              action: "HUMAN_ESCALATION_TRIGGERED",
              detailsJson: JSON.stringify({ leadId: lead_id, reason, priority, recommended_action })
            }
          });

          logger.info(`Human handoff triggered for lead ${lead_id}: ${reason}`);
          return {
            tool,
            success: true,
            data: { leadId: lead_id, status: "HANDOFF_REQUIRED", priority: priority || "URGENT", recommended_action }
          };
        }

        default:
          return { tool: tool as any, success: false, error: `Unknown tool: ${tool}` };
      }
    } catch (err: any) {
      logger.error(`Error executing tool ${tool}:`, err);
      return { tool, success: false, error: err.message };
    }
  }
}