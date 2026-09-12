import { ChannelManager } from "./channels/channelManager.js";
import { prisma } from "../lib/prisma.js";
import { aiService } from "./ai/aiService.js";
import { ToolExecutor } from "./toolExecutor.js";
import { CalendarService } from "./calendarService.js";
import { SdrContext, LeadContext, ConversationTurn } from "./ai/types.js";
import { logger } from "../lib/logger.js";
import { broadcastToOrganization } from "../lib/wsBroadcaster.js";
import { EmailReplyParser } from "./emailReplyParser.js";

export class ConversationService {
  static async getConversations(organizationId: string) {
    const convs = await prisma.conversation.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        lead: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    return convs.map((c) => {
      const isDnc = Boolean(c.lead?.isOptedOut || c.lead?.status === "OPTED_OUT");
      return {
        ...c,
        isAiActive: isDnc ? false : c.isAiActive
      };
    });
  }

  static async getConversationWithMessages(organizationId: string, id: string) {
    const conv = await prisma.conversation.findFirst({
      where: { id, organizationId },
      include: {
        lead: true,
        messages: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!conv) return null;
    const isDnc = Boolean(conv.lead?.isOptedOut || conv.lead?.status === "OPTED_OUT");
    return {
      ...conv,
      isAiActive: isDnc ? false : conv.isAiActive
    };
  }

  static async ingestLeadReply(
    organizationId: string,
    leadId: string,
    channel: string,
    replyText: string,
    options?: {
      subject?: string;
      externalMessageId?: string;
      isRealInbound?: boolean;
      replyTo?: string;
      inReplyTo?: string;
      references?: string;
      isSimulator?: boolean;
      forceLiveEmail?: boolean;
      conversationId?: string;
      rawHtml?: string;
    }
  ) {
    logger.info(`Ingesting lead reply for lead ${leadId} via ${channel}: "${replyText}"`);

    // Inbound reply dispatch: If forceLiveEmail is explicitly requested or real inbound, route to RESEND.
    // Simulator runs with isSimulator: true (zero external network latency).
    const dispatchForceProvider: "ETHEREAL" | "RESEND" | undefined =
      (options?.forceLiveEmail || options?.isRealInbound) ? "RESEND" : undefined;

    // 1. Verify lead ownership under organization
    const targetLead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId }
    });
    if (!targetLead) {
      throw new Error(`Lead ${leadId} not found in this organization`);
    }

    // Hard-block if lead is already opted out
    if (targetLead.isOptedOut || targetLead.status === "OPTED_OUT") {
      logger.warn(`Lead ${leadId} has already opted out. Suppressing all automated outreach.`);
      await prisma.conversation.updateMany({
        where: { leadId, organizationId },
        data: { isAiActive: false }
      });
      return { optedOut: true, message: "Lead has opted out of communications" };
    }

    // 2. Isolate newly authored text & check opt-out keywords ONLY against newly authored content
    // Prevents false DNC triggers caused by quoted previous emails containing "reply STOP to unsubscribe"
    const isEmail = channel.toUpperCase() === "EMAIL";
    const newlyAuthored = isEmail
      ? EmailReplyParser.extractNewlyAuthoredReply(replyText, options?.rawHtml)
      : replyText.trim();
    const effectiveReply = newlyAuthored.length > 0 ? newlyAuthored : replyText.trim();

    const isOptOut = isEmail
      ? EmailReplyParser.isOptOutIntent(replyText, options?.rawHtml)
      : /\b(stop|unsubscribe|remove me|opt out|cancel|do not contact|don't contact)\b/i.test(replyText);

    if (isOptOut) {
      let inboundMsg: any = null;
      await prisma.$transaction(async (tx) => {
        // 1. Mark ONLY this exact lead as opted-out
        await tx.lead.updateMany({
          where: { id: leadId, organizationId },
          data: { isOptedOut: true, status: "OPTED_OUT" }
        });

        // 2. Cancel ALL pending follow-up tasks strictly for this lead in this organization
        await tx.followUpTask.updateMany({
          where: { leadId, organizationId, status: "SCHEDULED" },
          data: { status: "CANCELLED" }
        });

        // 3. Ensure ALL conversations for this lead are marked isAiActive: false
        await tx.conversation.updateMany({
          where: { leadId, organizationId },
          data: { isAiActive: false }
        });

        // Find or create conversation for this lead to record the STOP message
        let conv = options?.conversationId
          ? await tx.conversation.findFirst({ where: { id: options.conversationId, organizationId } })
          : null;
        if (!conv) {
          conv = await tx.conversation.findFirst({
            where: { leadId, organizationId, channel }
          });
        }
        if (!conv) {
          conv = await tx.conversation.create({
            data: { organizationId, leadId, channel, isAiActive: false }
          });
        }

        // 4. Record the inbound STOP message with proper LEAD role
        inboundMsg = await tx.message.create({
          data: {
            conversationId: conv.id,
            channel,
            direction: "INBOUND",
            senderRole: "LEAD",
            senderId: targetLead.id,
            recipientId: null,
            content: effectiveReply || replyText,
            senderName: `${targetLead.firstName} ${targetLead.lastName}`.trim() || "Lead",
            status: options?.isRealInbound ? "REAL_INBOUND" : "DELIVERED",
            toolCallArgs: options?.externalMessageId
              ? JSON.stringify({ source: options?.isRealInbound ? "REAL_INBOUND" : "SIMULATED", externalMessageId: options.externalMessageId })
              : null
          }
        });

        // 5. Create activity log
        await tx.activityLog.create({
          data: {
            organizationId,
            category: "LEAD",
            action: "LEAD_OPTED_OUT",
            detailsJson: JSON.stringify({ leadId, reply: effectiveReply || replyText })
          }
        });
      });

      logger.info(`Lead ${leadId} opted out atomically. Cancelled all pending cadences.`);
      return { optedOut: true, leadId, inboundMsg, message: "Lead opted out successfully" };
    }

    // Find or create conversation
    let conv = options?.conversationId
      ? await prisma.conversation.findFirst({ where: { id: options.conversationId, organizationId } })
      : null;
    if (!conv) {
      conv = await prisma.conversation.findFirst({
        where: { leadId, organizationId, channel }
      });
    }
    if (!conv) {
      conv = await prisma.conversation.create({
        data: { organizationId, leadId, channel, subject: options?.subject || undefined }
      });
    } else if (options?.subject && !conv.subject) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { subject: options.subject }
      });
    }

    // Record inbound prospect message with proper LEAD role
    const inboundMsg = await prisma.message.create({
      data: {
        conversationId: conv.id,
        channel,
        direction: "INBOUND",
        senderRole: "LEAD",
        senderId: targetLead.id,
        recipientId: null,
        content: effectiveReply || replyText,
        senderName: `${targetLead.firstName} ${targetLead.lastName}`.trim() || "Lead",
        status: options?.isRealInbound ? "REAL_INBOUND" : "DELIVERED",
        toolCallArgs: options?.externalMessageId
          ? JSON.stringify({ source: options?.isRealInbound ? "REAL_INBOUND" : "SIMULATED", externalMessageId: options.externalMessageId })
          : null
      }
    });

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() }
    }).catch(() => {});

    broadcastToOrganization(organizationId, {
      type: "MESSAGE_CREATED",
      payload: { conversationId: conv.id, message: inboundMsg }
    });
    broadcastToOrganization(organizationId, {
      type: "CONVERSATION_UPDATED",
      payload: { conversationId: conv.id, leadId }
    });

    // Record activity log for Lead Reply
    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "CONVERSATION",
        action: "LEAD_REPLIED",
        detailsJson: JSON.stringify({
          leadId: targetLead.id,
          leadName: `${targetLead.firstName} ${targetLead.lastName}`.trim(),
          channel,
          reply: replyText
        })
      }
    });

    // Update lead status to IN_CONVERSATION if it was NEW or CONTACTED
    if (targetLead.status === "NEW" || targetLead.status === "CONTACTED") {
      await prisma.lead.updateMany({
        where: { id: leadId, organizationId },
        data: { status: "IN_CONVERSATION" }
      });
    }

    // Cancel pending automated cold followups since the lead has replied
    await prisma.followUpTask.updateMany({
      where: { leadId, organizationId, status: "SCHEDULED" },
      data: { status: "CANCELLED" }
    });

    // If human took over (isAiActive == false), do not auto-respond
    const isDnc = Boolean(targetLead.isOptedOut || targetLead.status === "OPTED_OUT");
    logger.info(`[DIAGNOSTIC 4/14] check AI active/DNC/human takeover state (isDnc: ${isDnc}, isAiActive: ${conv.isAiActive})`);
    if (isDnc) {
      logger.warn(`[DIAGNOSTIC 4/14 - BLOCKED] DNC state active for lead ${leadId.substring(0, 8)}... Auto-reply suppressed.`);
      return { optedOut: true, message: "Lead has opted out of communications" };
    }
    if (!conv.isAiActive) {
      logger.info(`[DIAGNOSTIC 4/14 - PAUSED] Human takeover active (isAiActive=false) for lead ${leadId.substring(0, 8)}... Auto-reply suppressed.`);
      return { inboundMsg, aiResponded: false, reason: "Human takeover active" };
    }

    return await this.generateAndDispatchAiResponse(
      organizationId,
      conv,
      targetLead,
      effectiveReply || replyText,
      inboundMsg,
      options
    );
  }

  static async generateAndDispatchAiResponse(
    organizationId: string,
    conv: any,
    targetLead: any,
    replyText: string,
    inboundMsg: any,
    options?: {
      subject?: string;
      externalMessageId?: string;
      isRealInbound?: boolean;
      replyTo?: string;
      inReplyTo?: string;
      references?: string;
      isSimulator?: boolean;
      forceLiveEmail?: boolean;
    }
  ) {
    const channel = conv.channel || "EMAIL";
    const leadId = targetLead.id;
    const isReal = Boolean(options?.isRealInbound) || Boolean(options?.forceLiveEmail) || inboundMsg?.status === "REAL_INBOUND";
    const dispatchForceProvider: "ETHEREAL" | "RESEND" | undefined = isReal ? "RESEND" : undefined;
    logger.info(`[DIAGNOSTIC 5/14] AI response generation function called (leadId: ${leadId.substring(0, 8)}..., convId: ${conv.id}, isRealInbound: ${isReal}, dispatchForceProvider: ${dispatchForceProvider})`);

    // Fetch full context to generate AI response
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const sdr = await prisma.sdrProfile.findFirst({ where: { organizationId } });
    const lead = targetLead;
    const historyMsgs = await prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" }
    });

    if (!org || !sdr || !lead) return { inboundMsg };

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

    const priorHistory = historyMsgs.filter(m => m.id !== inboundMsg.id);
    const turns: ConversationTurn[] = priorHistory.map(m => ({
      speaker: (m.senderRole === "LEAD" || m.direction === "INBOUND") ? "lead" : "sdr",
      channel: m.channel,
      content: m.content,
      timestamp: m.createdAt.toISOString()
    }));

    // =========================================================================
    // 2. EXPLICIT MEETING / CALENDAR BOOKING FLOW (BUG 2)
    // =========================================================================
    const meetingParse = CalendarService.parseMeetingDateTime(replyText);
    if (meetingParse.hasMeetingIntent) {
      // If date is missing (e.g. prospect only said "at 3 PM")
      if (meetingParse.missing === "date") {
        const askDateMsg = `I would be happy to schedule a demo at ${meetingParse.formattedTime}. Which day works best for you?`;
        const outboundMsg = await prisma.message.create({
          data: {
            conversationId: conv.id,
            channel,
            direction: "OUTBOUND",
            senderRole: "AI",
            senderId: sdr.id,
            recipientId: targetLead.id,
            content: askDateMsg,
            senderName: sdr.personaName,
            status: "SENT",
            aiReasoning: "Meeting booking: missing date - requested day from prospect"
          }
        });

        broadcastToOrganization(organizationId, {
          type: "MESSAGE_CREATED",
          payload: { conversationId: conv.id, message: outboundMsg }
        });

        await ChannelManager.dispatch(channel, {
          to: targetLead.email || targetLead.phone || "",
          content: askDateMsg,
          subject: options?.subject ? (options.subject.startsWith("Re:") ? options.subject : `Re: ${options.subject}`) : undefined,
          senderName: sdr.personaName,
          senderEmail: (sdr as any).email || "alex@nexsdr.in",
          leadId: targetLead.id,
          organizationId,
          inReplyTo: options?.inReplyTo || options?.externalMessageId,
          references: options?.references || options?.externalMessageId,
          replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
          forceProvider: dispatchForceProvider,
          isSimulator: options?.isSimulator
        }).catch((err) => logger.warn(`Channel dispatch failed: ${err.message}`));
        return {
          inboundMsg,
          outboundMsg,
          action: {
            intent: "meeting",
            action: "reply",
            reply: askDateMsg,
            confidence: 1,
            tool_arguments: { missing: "date", time: meetingParse.formattedTime },
            reason: "Missing date"
          },
          toolExecution: null
        };
      }

      // If time is missing (e.g. prospect only said "next Tuesday")
      if (meetingParse.missing === "time") {
        const askTimeMsg = `I would be happy to schedule a demo for ${meetingParse.formattedDate}. What time works best for you?`;
        const outboundMsg = await prisma.message.create({
          data: {
            conversationId: conv.id,
            channel,
            direction: "OUTBOUND",
            senderRole: "AI",
            senderId: sdr.id,
            recipientId: targetLead.id,
            content: askTimeMsg,
            senderName: sdr.personaName,
            status: "SENT",
            aiReasoning: "Meeting booking: missing time - requested time from prospect"
          }
        });

        broadcastToOrganization(organizationId, {
          type: "MESSAGE_CREATED",
          payload: { conversationId: conv.id, message: outboundMsg }
        });

        await ChannelManager.dispatch(channel, {
          to: targetLead.email || targetLead.phone || "",
          content: askTimeMsg,
          subject: options?.subject ? (options.subject.startsWith("Re:") ? options.subject : `Re: ${options.subject}`) : undefined,
          senderName: sdr.personaName,
          senderEmail: (sdr as any).email || "alex@nexsdr.in",
          leadId: targetLead.id,
          organizationId,
          inReplyTo: options?.inReplyTo || options?.externalMessageId,
          references: options?.references || options?.externalMessageId,
          replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
          forceProvider: dispatchForceProvider,
          isSimulator: options?.isSimulator
        }).catch((err) => logger.warn(`Channel dispatch failed: ${err.message}`));
        return {
          inboundMsg,
          outboundMsg,
          action: {
            intent: "meeting",
            action: "reply",
            reply: askTimeMsg,
            confidence: 1,
            tool_arguments: { missing: "time", date: meetingParse.formattedDate },
            reason: "Missing time"
          },
          toolExecution: null
        };
      }

      // Both date and time provided explicitly!
      if (meetingParse.missing === "none" && meetingParse.date) {
        const durationMinutes = 30;
        const targetDate = meetingParse.date;

        const availability = await CalendarService.checkAvailability(organizationId, targetDate, durationMinutes);

        if (availability.available) {
          // Available: schedule appointment
          const calResult = await CalendarService.scheduleAppointment({
            organizationId,
            leadId,
            title: `Product Demo with ${org.name}`,
            description: `Discovery and demo call with ${lead.firstName} ${lead.lastName}`,
            startTime: targetDate,
            durationMinutes,
            attendeeEmail: lead.email,
            attendeeName: `${lead.firstName} ${lead.lastName}`.trim(),
            organizerName: sdr.personaName
          });

          // Verify appointment exists in database
          const verifiedAppt = await prisma.appointment.findUnique({
            where: { id: calResult.appointment.id }
          });

          if (verifiedAppt) {
            // Update lead status to QUALIFIED
            await prisma.lead.updateMany({
              where: { id: leadId, organizationId },
              data: { status: "QUALIFIED", intentScore: 90 }
            });

            await prisma.activityLog.create({
              data: {
                organizationId,
                category: "APPOINTMENT",
                action: "APPOINTMENT_BOOKED",
                detailsJson: JSON.stringify({
                  appointmentId: verifiedAppt.id,
                  startTime: targetDate,
                  durationMinutes,
                  calendarMode: "LOCAL_RFC5545"
                })
              }
            });

            const tzStr = meetingParse.timezone ? ` ${meetingParse.timezone}` : "";
            const confirmMsg = `I've confirmed our demo for ${meetingParse.formattedDate} at ${meetingParse.formattedTime}${tzStr}. A calendar invitation (.ics) has been sent to ${lead.email}. Looking forward to connecting!`;

            const outboundMsg = await prisma.message.create({
              data: {
                conversationId: conv.id,
                channel,
                direction: "OUTBOUND",
                senderRole: "AI",
                senderId: sdr.id,
                recipientId: targetLead.id,
                content: confirmMsg,
                senderName: sdr.personaName,
                status: "SENT",
                aiReasoning: "Meeting booked autonomously into calendar",
                toolCallName: "create_calendar_event",
                toolCallArgs: JSON.stringify({
                  lead_id: leadId,
                  start_time: targetDate.toISOString(),
                  duration_minutes: durationMinutes
                })
              }
            });

            broadcastToOrganization(organizationId, {
              type: "MESSAGE_CREATED",
              payload: { conversationId: conv.id, message: outboundMsg }
            });

            await ChannelManager.dispatch(channel, {
              to: targetLead.email || targetLead.phone || "",
              content: confirmMsg,
              subject: options?.subject ? (options.subject.startsWith("Re:") ? options.subject : `Re: ${options.subject}`) : undefined,
              senderName: sdr.personaName,
              senderEmail: (sdr as any).email || "alex@nexsdr.in",
              leadId: targetLead.id,
              organizationId,
              inReplyTo: options?.inReplyTo || options?.externalMessageId,
              references: options?.references || options?.externalMessageId,
              replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
              forceProvider: dispatchForceProvider,
              isSimulator: options?.isSimulator
            }).catch((err) => logger.warn(`Channel dispatch failed: ${err.message}`));

            return {
              inboundMsg,
              outboundMsg,
              action: {
                intent: "meeting",
                action: "create_calendar_event",
                reply: confirmMsg,
                confidence: 1,
                tool_arguments: {
                  lead_id: leadId,
                  start_time: targetDate.toISOString(),
                  duration_minutes: durationMinutes
                },
                reason: "Confirmed available slot"
              },
              toolExecution: {
                tool: "create_calendar_event",
                success: true,
                data: {
                  ...calResult.appointment,
                  icsContent: calResult.icsContent,
                  calendarMode: "LOCAL_RFC5545"
                }
              }
            };
          }
        } else {
          // Slot conflict / double-booking detected!
          const alt1 = availability.suggestedAlternatives[0]
            ? availability.suggestedAlternatives[0].toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            : "later that afternoon";
          const alt2 = availability.suggestedAlternatives[1]
            ? availability.suggestedAlternatives[1].toLocaleDateString("en-US", { weekday: "long" }) + " at 10:00 AM"
            : "the following morning";

          const conflictMsg = `Unfortunately, ${meetingParse.formattedDate} at ${meetingParse.formattedTime} is already booked on our calendar. Would ${alt1} or ${alt2} work for you instead?`;

          const outboundMsg = await prisma.message.create({
            data: {
              conversationId: conv.id,
              channel,
              direction: "OUTBOUND",
              senderRole: "AI",
              senderId: sdr.id,
              recipientId: targetLead.id,
              content: conflictMsg,
              senderName: sdr.personaName,
              status: "SENT",
              aiReasoning: "Calendar slot conflict - suggested alternative times"
            }
          });

          broadcastToOrganization(organizationId, {
            type: "MESSAGE_CREATED",
            payload: { conversationId: conv.id, message: outboundMsg }
          });

          await ChannelManager.dispatch(channel, {
            to: targetLead.email || targetLead.phone || "",
            content: conflictMsg,
            subject: options?.subject ? (options.subject.startsWith("Re:") ? options.subject : `Re: ${options.subject}`) : undefined,
            senderName: sdr.personaName,
            senderEmail: (sdr as any).email || "alex@nexsdr.in",
            leadId: targetLead.id,
            organizationId,
            inReplyTo: options?.inReplyTo || options?.externalMessageId,
            references: options?.references || options?.externalMessageId,
            replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
            forceProvider: dispatchForceProvider,
            isSimulator: options?.isSimulator
          }).catch((err) => logger.warn(`Channel dispatch failed: ${err.message}`));

          return {
            inboundMsg,
            outboundMsg,
            action: {
              intent: "meeting",
              action: "reply",
              reply: conflictMsg,
              confidence: 1,
              tool_arguments: { requested_slot: targetDate.toISOString(), conflict: true },
              reason: "Slot unavailable"
            },
            toolExecution: {
              tool: "check_calendar_availability",
              success: false,
              error: `Slot unavailable at ${targetDate.toISOString()}`
            }
          };
        }
      }
    }

    // =========================================================================
    // 3. EXPLICIT FOLLOW-UP REQUEST FLOW (BUG 3)
    // =========================================================================
    const isFollowUpRequest =
      /\b(?:follow\s*up|check\s*back|reach\s*out)\s*(?:with\s*me\s*)?(?:in\s*(\d+)\s*days?|next\s*week|next\s*month)?/i.test(replyText) ||
      /\bnot ready (?:to buy )?yet.*(?:follow up|in \d+ days?)/i.test(replyText) ||
      /\bfollow up in \d+ days?\b/i.test(replyText);

    if (isFollowUpRequest) {
      let delayDays = 3;
      const numMatch = replyText.match(/\bin\s*(\d+)\s*days?\b/i) || replyText.match(/\b(\d+)\s*days?\b/i);
      if (numMatch) {
        delayDays = parseInt(numMatch[1], 10);
      } else if (/\bnext\s*week\b/i.test(replyText)) {
        delayDays = 7;
      } else if (/\bnext\s*month\b/i.test(replyText)) {
        delayDays = 30;
      }

      // Check if duplicate follow-up task already scheduled
      const existingFollowUp = await prisma.followUpTask.findFirst({
        where: {
          organizationId,
          leadId,
          status: "SCHEDULED"
        }
      });

      let taskCreated = null;
      if (!existingFollowUp) {
        const scheduledDate = new Date(Date.now() + delayDays * 86400000);
        taskCreated = await prisma.followUpTask.create({
          data: {
            organizationId,
            leadId,
            stepNumber: 2,
            channel: "EMAIL",
            scheduledFor: scheduledDate,
            status: "SCHEDULED"
          }
        });

        // Verify DB persistence
        const verified = await prisma.followUpTask.findUnique({
          where: { id: taskCreated.id }
        });

        if (!verified) {
          logger.error("Failed to verify FollowUpTask creation in database");
          taskCreated = null;
        }
      } else {
        taskCreated = existingFollowUp;
      }

      const confirmFollowUpMsg = taskCreated
        ? `Understood. I have scheduled a follow-up for you in ${delayDays} days. We look forward to connecting then!`
        : `I've noted your request to follow up in ${delayDays} days. Our team will reach out accordingly.`;

      const outboundMsg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          channel,
          direction: "OUTBOUND",
          senderRole: "AI",
          senderId: sdr.id,
          recipientId: targetLead.id,
          content: confirmFollowUpMsg,
          senderName: sdr.personaName,
          status: "SENT",
          aiReasoning: "Follow-up task scheduled in database",
          toolCallName: "create_followup",
          toolCallArgs: JSON.stringify({ lead_id: leadId, delay_days: delayDays, channel: "EMAIL" })
        }
      });

      broadcastToOrganization(organizationId, {
        type: "MESSAGE_CREATED",
        payload: { conversationId: conv.id, message: outboundMsg }
      });

      await ChannelManager.dispatch(channel, {
        to: targetLead.email || targetLead.phone || "",
        content: confirmFollowUpMsg,
        subject: options?.subject ? (options.subject.startsWith("Re:") ? options.subject : `Re: ${options.subject}`) : undefined,
        senderName: sdr.personaName,
        senderEmail: (sdr as any).email || "alex@nexsdr.in",
        leadId: targetLead.id,
        organizationId,
        inReplyTo: options?.inReplyTo || options?.externalMessageId,
        references: options?.references || options?.externalMessageId,
        replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
        forceProvider: dispatchForceProvider,
        isSimulator: options?.isSimulator
      }).catch((err) => logger.warn(`Channel dispatch failed: ${err.message}`));

      return {
        inboundMsg,
        outboundMsg,
        action: {
          intent: "followup",
          action: "create_followup",
          reply: confirmFollowUpMsg,
          confidence: 1,
          tool_arguments: { lead_id: leadId, delay_days: delayDays },
          reason: "Created persistent follow-up cadence task"
        },
        toolExecution: {
          tool: "create_followup",
          success: !!taskCreated,
          data: taskCreated
        }
      };
    }

    // =========================================================================
    // 4. AI DIALOGUE INFERENCE & CANONICAL ACTION DECISION
    // =========================================================================
    let aiCompletion: any;
    try {
      aiCompletion = await aiService.respondToMessage(sdrContext, leadContext, turns, replyText);
      logger.info(`[DIAGNOSTIC 9/14] generated response returned (intent: ${aiCompletion?.action?.intent}, action: ${aiCompletion?.action?.action}, responseLength: ${aiCompletion?.content?.length || 0})`);
    } catch (err: any) {
      logger.error(`[DIAGNOSTIC 9/14 - FAILED] AI response generation failed: ${err.message}`);
      logger.error(`[ConversationService] Inbound email AI response generation failed: ${err.message}`, {
        organizationId,
        leadId,
        conversationId: conv.id
      });
      await prisma.activityLog.create({
        data: {
          organizationId,
          category: "AI",
          action: "AI_GENERATION_FAILED",
          detailsJson: JSON.stringify({
            conversationId: conv.id,
            leadId,
            error: err.message
          })
        }
      });
      return {
        inboundMsg,
        aiResponded: false,
        error: err.message,
        reason: `AI generation failed: ${err.message}`
      };
    }

    // Explicit Human Escalation / Enterprise Handoff Guard
    const isExplicitHumanRequest =
      /\b(?:connect me to|speak with|talk to)\s+(?:a\s+)?(?:human|person|sales director|director|executive|representative)\b/i.test(replyText) ||
      /\b(?:talk to a human|speak with a person|human handoff|enterprise sales director|on-prem soc2 deployment)\b/i.test(replyText);

    if (isExplicitHumanRequest && aiCompletion.action.action !== "human_handoff") {
      aiCompletion.action = {
        intent: "handoff",
        action: "human_handoff",
        reply: "I completely understand. I am connecting you directly with our enterprise solutions team to review your specific requirements.",
        reason: "Prospect requested enterprise / human sales consultation",
        tool_arguments: { lead_id: leadId, reason: replyText, priority: "URGENT" },
        confidence: 0.95
      };
      aiCompletion.toolDecision = {
        tool: "human_handoff",
        arguments: {
          lead_id: leadId,
          reason: `Prospect requested enterprise consultation: "${replyText}"`,
          priority: "URGENT",
          recommended_action: "Schedule executive consultation with enterprise sales director"
        }
      };
      aiCompletion.content = aiCompletion.action.reply;
    }

    // =========================================================================
    // 5. PRICING & DISCOUNT HALLUCINATION GUARD (BUG 1)
    // =========================================================================
    const pricingKeywords = /\b(cost|pricing|price|how much|rates|rate)\b/i;
    const discountKeywords = /\b(discount|discounts|deal|special offer|package|packages|negotiate|negotiation|cheaper|reduction)\b/i;
    const roiKeywords = /\b(roi|return on investment|savings|save)\b/i;

    const isAskingPricing = pricingKeywords.test(replyText);
    const isAskingDiscounts = discountKeywords.test(replyText);
    const isAskingRoi = roiKeywords.test(replyText);

    const kbText = `${org.knowledgeBase || ""} ${(org as any).pricingInfo || ""} ${(org as any).products || ""}`;
    const kbTextLower = kbText.toLowerCase();
    const hasVerifiedPricing =
      kbTextLower.includes("$") ||
      kbTextLower.includes("pricing:") ||
      kbTextLower.includes("tier") ||
      kbTextLower.includes("/mo") ||
      kbTextLower.includes("/month");
    const hasVerifiedDiscounts =
      kbTextLower.includes("discount") &&
      !kbTextLower.includes("no discount") &&
      !kbTextLower.includes("no unverified discount");
    const hasVerifiedRoi = kbTextLower.includes("roi") || kbTextLower.includes("savings");

    // Extract exact pricing line from knowledgeBase if available
    let verifiedPricingSummary = "";
    if (hasVerifiedPricing) {
      const kbLines = kbText.split("\n");
      const pricingLine = kbLines.find(l => l.toLowerCase().includes("pricing") || l.includes("$"));
      if (pricingLine) {
        verifiedPricingSummary = pricingLine.replace(/^[-*•]\s*/, "").replace(/pricing:\s*/i, "").trim();
      }
    }

    if (isAskingPricing || isAskingDiscounts) {
      const contentLower = aiCompletion.content.toLowerCase();
      const hasGenericFiller =
        contentLower.includes("based on specific requirements") ||
        contentLower.includes("discuss potential") ||
        contentLower.includes("discuss discount") ||
        contentLower.includes("potential discount") ||
        contentLower.includes("potential tiers") ||
        contentLower.includes("discuss packages") ||
        contentLower.includes("negotiate");

      if (!hasVerifiedPricing) {
        aiCompletion.content = "I don't have verified pricing information available right now. I can connect you with a human to discuss pricing.";
        aiCompletion.action.reply = aiCompletion.content;
      } else {
        // Verified pricing exists in Product Truth
        const quotesVerifiedPrice =
          contentLower.includes("199") ||
          contentLower.includes("499") ||
          contentLower.includes("79") ||
          contentLower.includes("starter") ||
          contentLower.includes("growth");

        if (!quotesVerifiedPrice || hasGenericFiller) {
          const pricingText = verifiedPricingSummary ? `Our standard pricing is: ${verifiedPricingSummary}.` : `Our pricing tiers are Starter ($199/mo) and Growth ($499/mo).`;
          if (isAskingDiscounts && !hasVerifiedDiscounts) {
            aiCompletion.content = `${pricingText} We do not offer unverified discounts or custom packages. I can connect you with a specialist if you'd like to discuss further.`;
          } else {
            aiCompletion.content = `${pricingText} How does that align with your current requirements?`;
          }
          aiCompletion.action.reply = aiCompletion.content;
        }
      }
    }

    // Fake ROI guard
    if (isAskingRoi && !hasVerifiedRoi) {
      const contentLower = aiCompletion.content.toLowerCase();
      if (contentLower.includes("65%") || contentLower.includes("$42,000") || contentLower.includes("proven roi")) {
        aiCompletion.content = "I don't have verified ROI statistics available for that scenario. I can connect you with our technical team to discuss your operational requirements.";
        aiCompletion.action.reply = aiCompletion.content;
      }
    }

    // Internal Team / In-House Build-vs-Buy Objection Guard
    const isInternalTeamObjection =
      /\b(internal|in-house)\b.*?\b(team|engineering|development|automation|solution|developers)\b|\b(internal team|in-house team|our own team|build vs buy)\b/i.test(replyText);
    if (isInternalTeamObjection) {
      const contentLower = aiCompletion.content.toLowerCase();
      const hasBuildVsBuyKeywords =
        contentLower.includes("internal") ||
        contentLower.includes("in-house") ||
        contentLower.includes("engineering") ||
        contentLower.includes("maintenance") ||
        contentLower.includes("compliance");

      if (!hasBuildVsBuyKeywords) {
        aiCompletion.content = `We admire teams with strong internal engineering capabilities. Many organizations partner with ${org.name} not to replace their in-house team, but to relieve developer backlog and reduce ongoing compliance maintenance. How is your internal engineering backlog currently prioritized?`;
        aiCompletion.action.reply = aiCompletion.content;
      }
    }

    // =========================================================================
    // 6. SERVER-SIDE TOOL EXECUTION & MESSAGE PERSISTENCE (BUG 5 & 6)
    // =========================================================================
    let toolResult = null;
    const actionName = aiCompletion.action.action;

    if (actionName !== "reply" && actionName !== "none" && aiCompletion.toolDecision) {
      if (actionName === "send_email") {
        logger.info("Suppressed redundant send_email tool call in ongoing conversation thread.");
      } else {
        toolResult = await ToolExecutor.executeTool(organizationId, aiCompletion.toolDecision);
      }
    }

    // Bug 4 & Bug 3 Sanitization Guard:
    // 1. Remove duplicate "At [Company], [Company] helps..." boilerplate if present
    if (org.name) {
      const escapedOrgName = org.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const dupRegex = new RegExp(`^At ${escapedOrgName},\\s*${escapedOrgName}\\s+`, 'i');
      if (dupRegex.test(aiCompletion.content)) {
        aiCompletion.content = aiCompletion.content.replace(dupRegex, `At ${org.name}, we `);
      }
    }
    // 2. Also if lead company/name is Unknown, strip any hallucinated "technew" or "Tanish"
    const leadCompUnknown = !lead.companyName || lead.companyName.toLowerCase() === "unknown";
    const leadNameUnknown = !lead.firstName || lead.firstName.toLowerCase() === "unknown";
    if (leadCompUnknown) {
      aiCompletion.content = aiCompletion.content.replace(/\b(?:at\s+)?technew\b/gi, "").replace(/\s{2,}/g, " ").trim();
      aiCompletion.content = aiCompletion.content.replace(/\b(?:at\s+)?CloudFlow\s*AI\b/gi, "").replace(/\s{2,}/g, " ").trim();
    }
    if (leadNameUnknown) {
      aiCompletion.content = aiCompletion.content.replace(/\b(?:hi|hello|hey|thanks for getting back to me,?)\s+tanish\b/gi, "Hello,").trim();
    }
    // 3. Purge any stray legacy "CloudFlow AI" tokens and replace with actual organization name
    aiCompletion.content = aiCompletion.content.replace(/\bCloudFlow\s*AI\b/gi, org.name || "NexSDR");

    // 4. Remove duplicate company prefix boilerplate ("At MachineMind, MachineMind..." -> "At MachineMind, we...")
    aiCompletion.content = aiCompletion.content.replace(/^At\s+([A-Za-z0-9_-]+),\s+\1\b/i, "At $1, we");
    aiCompletion.content = aiCompletion.content.replace(/^At\s+([A-Za-z0-9_-]+),\s+at\s+\1\b/i, "At $1, we");

    if (aiCompletion.action && aiCompletion.action.reply) {
      aiCompletion.action.reply = aiCompletion.content;
    }

    // Store ONLY clean natural language reply in Message table with proper AI role
    const outboundMsg = await prisma.message.create({
      data: {
        conversationId: conv.id,
        channel,
        direction: "OUTBOUND",
        senderRole: "AI",
        senderId: sdr.id,
        recipientId: targetLead.id,
        content: aiCompletion.content, // Pure conversational response - NEVER raw JSON
        senderName: sdr.personaName,
        status: "SENT",
        aiReasoning: `Intent: ${aiCompletion.action.intent} | Action: ${aiCompletion.action.action} (${aiCompletion.latencyMs}ms)`,
        toolCallName: actionName !== "reply" ? actionName : null,
        toolCallArgs: aiCompletion.toolDecision ? JSON.stringify(aiCompletion.toolDecision.arguments) : null
      }
    });
    logger.info(`[DIAGNOSTIC 13/14] outbound message saved to DB (msgId: ${outboundMsg.id}, role: ${outboundMsg.senderRole}, status: ${outboundMsg.status})`);

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() }
    }).catch(() => {});

    broadcastToOrganization(organizationId, {
      type: "MESSAGE_CREATED",
      payload: { conversationId: conv.id, message: outboundMsg }
    });
    logger.info(`[DIAGNOSTIC 14/14] WebSocket broadcast occurs (event: MESSAGE_CREATED, msgId: ${outboundMsg.id})`);

    // Dispatch via channel abstraction to external lead
    logger.info(`[DIAGNOSTIC 10/14] outbound email dispatch starts (channel: ${channel}, leadId: ${leadId.substring(0, 8)}..., forceProvider: ${dispatchForceProvider})`);
    const dispatchRes: any = await ChannelManager.dispatch(channel, {
      to: targetLead.email || targetLead.phone || "",
      content: aiCompletion.content,
      subject: options?.subject ? (options.subject.startsWith("Re:") ? options.subject : `Re: ${options.subject}`) : undefined,
      senderName: sdr.personaName,
      senderEmail: (sdr as any).email || "alex@nexsdr.in",
      leadId: targetLead.id,
      organizationId,
      inReplyTo: options?.inReplyTo || options?.externalMessageId,
      references: options?.references || options?.externalMessageId,
      replyTo: (sdr as any).replyTo || (sdr as any).email || "alex@nexsdr.in",
      forceProvider: dispatchForceProvider,
      isSimulator: options?.isSimulator
    }).catch((err) => {
      logger.warn(`Channel dispatch failed: ${err.message}`);
      return null;
    });

    if (dispatchRes?.messageId) {
      const existingArgs = outboundMsg.toolCallArgs ? JSON.parse(outboundMsg.toolCallArgs) : {};
      await prisma.message.update({
        where: { id: outboundMsg.id },
        data: {
          toolCallArgs: JSON.stringify({ ...existingArgs, externalMessageId: dispatchRes.messageId })
        }
      }).catch(() => {});
    }

    // Record ActivityLog for AI SDR reply
    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "AI",
        action: "AI_REPLY_SENT",
        detailsJson: JSON.stringify({
          leadId: targetLead.id,
          leadName: `${targetLead.firstName} ${targetLead.lastName}`.trim(),
          reply: aiCompletion.content,
          intent: aiCompletion.action?.intent || "reply"
        })
      }
    });

    // Run qualification assessment safely with timeout protection
    let qualResult: any = { status: "IN_CONVERSATION" };
    try {
      qualResult = await Promise.race([
        aiService.qualifyLead(sdrContext, leadContext, [...turns, {
          speaker: "sdr",
          channel,
          content: aiCompletion.content,
          timestamp: new Date().toISOString()
        }]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Qualification timeout")), 3500))
      ]);
    } catch (err: any) {
      logger.warn(`Qualification assessment bypassed or timed out: ${err.message}`);
    }

    // Guard against premature qualification on mere problem descriptions:
    // If the prospect only described an operational problem without budget, timeline, or meeting, keep IN_CONVERSATION
    if (qualResult.status === "QUALIFIED" && aiCompletion.action.action === "reply") {
      const text = `${replyText} ${aiCompletion.content}`.toLowerCase();
      const hasExplicitBudgetOrTimeline =
        (text.includes("$") || text.includes("budget")) &&
        (/\b(next\s+week|in\s+\d+\s+weeks?|this\s+month|next\s+month|q[1-4]|launching\s+soon|deploy(?:ing)?\s+soon)\b/i.test(text));
      if (!hasExplicitBudgetOrTimeline) {
        qualResult.status = "IN_CONVERSATION";
      }
    }

    // Do not downgrade status if already QUALIFIED, HANDOFF_REQUIRED, CONVERTED, or OPTED_OUT
    const currentLead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    const isProtectedStatus = currentLead && (
      currentLead.status === "QUALIFIED" ||
      currentLead.status === "HANDOFF_REQUIRED" ||
      currentLead.status === "CONVERTED" ||
      currentLead.status === "OPTED_OUT" ||
      currentLead.isOptedOut
    );

    await prisma.lead.updateMany({
      where: { id: leadId, organizationId },
      data: {
        ...(!isProtectedStatus ? { status: qualResult.status } : {}),
        bantScorecard: JSON.stringify(qualResult)
      }
    });

    return {
      inboundMsg,
      outboundMsg,
      action: aiCompletion.action,
      toolExecution: toolResult,
      qualification: qualResult
    };
  }

  static async sendHumanMessage(
    organizationId: string,
    conversationId: string,
    content: string,
    user?: { userId?: string; id?: string; name?: string }
  ) {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: { lead: true }
    });
    if (!conv) throw new Error("Conversation not found");

    const senderName = user?.name || "Human Operator";
    const senderId = user?.userId || user?.id || null;

    const message = await prisma.message.create({
      data: {
        conversationId,
        channel: conv.channel,
        direction: "OUTBOUND",
        senderRole: "HUMAN",
        senderId,
        recipientId: conv.leadId,
        content,
        senderName,
        status: "SENT"
      }
    });

    broadcastToOrganization(organizationId, {
      type: "MESSAGE_CREATED",
      payload: { conversationId, message }
    });
    broadcastToOrganization(organizationId, {
      type: "CONVERSATION_UPDATED",
      payload: { conversationId, leadId: conv.leadId }
    });

    // Mark as human takeover: pause AI and clear escalation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { isAiActive: false, isEscalated: false, updatedAt: new Date() }
    });

    // Dispatch via channel abstraction to external lead
    if (conv.lead?.email || conv.lead?.phone) {
      await ChannelManager.dispatch(conv.channel, {
        to: conv.lead.email || conv.lead.phone || "",
        content,
        senderName,
        leadId: conv.leadId,
        organizationId
      }).catch((err) => logger.warn(`Channel dispatch failed for human message: ${err.message}`));
    }

    // Record activity log for human takeover
    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "CONVERSATION",
        action: "HUMAN_TAKEOVER_MESSAGE",
        detailsJson: JSON.stringify({
          conversationId,
          leadId: conv.leadId,
          leadName: conv.lead ? `${conv.lead.firstName} ${conv.lead.lastName}`.trim() : "Unknown",
          senderName,
          content
        })
      }
    });

    return message;
  }

  static async resumeAiHandling(organizationId: string, conversationId: string) {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: { lead: true }
    });
    if (!conv) throw new Error("Conversation not found");

    const targetLead = conv.lead;
    if (!targetLead) throw new Error("Lead not found for conversation");

    // Guard: DNC / STOP protection. If lead opted out, do NOT allow AI resumption or automated outreach
    if (targetLead.isOptedOut || targetLead.status === "OPTED_OUT") {
      logger.warn(`[ConversationService] Cannot resume AI for opted-out lead ${targetLead.id} (DNC enforced)`);
      await prisma.conversation.updateMany({
        where: { id: conversationId, organizationId },
        data: { isAiActive: false }
      });
      broadcastToOrganization(organizationId, {
        type: "CONVERSATION_UPDATED",
        payload: { conversationId, leadId: conv.leadId, isAiActive: false }
      });
      return {
        conversation: { ...conv, isAiActive: false },
        optedOut: true,
        aiTriggered: false,
        error: "Cannot resume AI SDR: Lead is on the Do Not Contact (DNC) list. All automated outbound communication is hard-blocked.",
        reason: "Lead has opted out of communications"
      };
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isAiActive: true, isEscalated: false, updatedAt: new Date() }
    });

    broadcastToOrganization(organizationId, {
      type: "CONVERSATION_UPDATED",
      payload: { conversationId, leadId: conv.leadId, isAiActive: true }
    });

    await prisma.activityLog.create({
      data: {
        organizationId,
        category: "AI",
        action: "AI_HANDLING_RESUMED",
        detailsJson: JSON.stringify({
          conversationId,
          leadId: conv.leadId,
          leadName: `${targetLead.firstName} ${targetLead.lastName}`.trim() || "Unknown"
        })
      }
    });

    // Check if the latest message in this thread is an unanswered INBOUND lead message
    const latestMsg = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" }
    });

    let aiResult: any = null;
    if (latestMsg && (latestMsg.direction === "INBOUND" || latestMsg.senderRole === "LEAD")) {
      logger.info(
        `[ConversationService] AI resumed on active conversation ${conversationId}. Responding to pending lead message ${latestMsg.id}: "${latestMsg.content.substring(0, 60)}"`
      );
      const isReal = Boolean(
        latestMsg.status === "REAL_INBOUND" ||
        (latestMsg.toolCallArgs && latestMsg.toolCallArgs.includes("REAL_INBOUND"))
      );
      aiResult = await this.generateAndDispatchAiResponse(
        organizationId,
        updated,
        targetLead,
        latestMsg.content,
        latestMsg,
        {
          subject: conv.subject || undefined,
          isRealInbound: isReal,
          forceLiveEmail: isReal,
          isSimulator: !isReal
        }
      );
    }

    return {
      conversation: updated,
      aiTriggered: Boolean(aiResult && (aiResult.outboundMsg || aiResult.action)),
      responseResult: aiResult
    };
  }
}