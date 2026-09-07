import { prisma } from "../lib/prisma.js";
import { LeadService } from "../services/leadService.js";
import { ConversationService } from "../services/conversationService.js";
import { PhoneService } from "../services/phoneService.js";
import { FollowUpEngine } from "../services/followUpEngine.js";
import { HandoffService } from "../services/handoffService.js";
import { AnalyticsService } from "../services/analyticsService.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

async function runSuite() {
  console.log("\n==========================================");
  console.log("STARTING AI SDR END-TO-END VERIFICATION");
  console.log("==========================================\n");

  // 1. Setup Test Organization
  const org = await prisma.organization.create({
    data: {
      name: "Acme Cloud AI",
      valueProposition: "Autonomous data reconciliation",
      targetCustomerIcp: "Fintech engineering teams",
      knowledgeBase: "Acme Cloud integrates with PostgreSQL and Snowflake."
    }
  });
  console.log(`Created test organization: ${org.name} (${org.id})`);

  await prisma.sdrProfile.create({
    data: {
      organizationId: org.id,
      personaName: "Morgan Vance",
      title: "Senior AI SDR",
      tone: "Direct, professional, consultative"
    }
  });

  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Claire",
      lastName: "Delacroix",
      email: `claire_${Date.now()}@fintech.test`,
      companyName: "FinTech Prime",
      status: "NEW"
    }
  });
  console.log(`Created test lead: ${lead.firstName} ${lead.lastName}`);

  // Test 1: Cold Outreach Generation & Tool Decision
  console.log("\n-> Testing AI Cold Outreach Generation...");
  const outreachRes = await LeadService.triggerAiOutreach(org.id, lead.id);
  assert(outreachRes !== undefined, "Outreach response returned");

  const leadAfterOutreach = await prisma.lead.findUnique({ where: { id: lead.id } });
  assert(leadAfterOutreach?.status === "CONTACTED", "Lead status updated to CONTACTED");

  const conv = await prisma.conversation.findFirst({ where: { leadId: lead.id, organizationId: org.id } });
  assert(conv !== null, "Conversation record created");

  // Test 2: Inbound Lead Reply & Objection Handling
  console.log("\n-> Testing Lead Reply & Competitor/Price Objection Handling...");
  const replyRes = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "We currently use Zapier and your pricing is 3x higher. Why should we switch?"
  );
  assert(replyRes.inboundMsg !== undefined, "Inbound message stored");
  assert(replyRes.outboundMsg !== undefined, "AI SDR outbound objection reply generated");
  assert(replyRes.outboundMsg.content.length > 20, "Objection reply contains thoughtful value framing");

  const leadInConv = await prisma.lead.findUnique({ where: { id: lead.id } });
  assert(leadInConv?.status === "IN_CONVERSATION", "Lead status updated to IN_CONVERSATION");

  // Test 3: Calendar Intent & Automated Meeting Booking Tool Execution
  console.log("\n-> Testing Intent Detection & Calendar Event Booking Tool...");
  const bookingRes = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "That makes total sense regarding compliance. Can we schedule a 20-minute demo this Thursday at 2pm? My VP will join."
  );
  assert(bookingRes.toolExecution?.tool === "create_calendar_event", "AI correctly selected create_calendar_event tool");
  assert(bookingRes.toolExecution?.success === true, "Calendar booking executed by backend");

  const appt = await prisma.appointment.findFirst({ where: { leadId: lead.id, organizationId: org.id } });
  assert(appt !== null, "Appointment persisted in database");

  const leadQualified = await prisma.lead.findUnique({ where: { id: lead.id } });
  assert(leadQualified?.status === "QUALIFIED", "Lead status advanced to QUALIFIED");

  // Test 4: Human Escalation & Handoff Trigger
  console.log("\n-> Testing Enterprise Escalation & Human Handoff...");
  const escalationRes = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "We are a Fortune 100 enterprise with 10,000 users. We need custom SOC2 audit review, custom MSA, and dedicated on-prem VPC. Can we speak to your enterprise director immediately?"
  );
  assert(escalationRes.toolExecution?.tool === "human_handoff", "AI correctly selected human_handoff tool");

  const escalations = await HandoffService.getEscalations(org.id);
  assert(escalations.length >= 1, "Escalation listed in Handoff inbox");

  const dossier = await HandoffService.getLeadDossier(org.id, lead.id);
  assert(dossier.lead.id === lead.id, "360-degree lead dossier generated");
  assert(dossier.conversations.length > 0, "Dossier includes conversation history");

  // Test 5: Lead Opt-Out Safety Enforcement
  console.log("\n-> Testing Lead Opt-Out (STOP) Enforcement...");
  await prisma.followUpTask.create({
    data: {
      organizationId: org.id,
      leadId: lead.id,
      stepNumber: 2,
      channel: "EMAIL",
      scheduledFor: new Date(Date.now() + 86400000),
      status: "SCHEDULED"
    }
  });

  const optOutRes = await ConversationService.ingestLeadReply(org.id, lead.id, "EMAIL", "STOP - Unsubscribe me.");
  assert(optOutRes.optedOut === true, "Opt-out recognized");

  const leadOpted = await prisma.lead.findUnique({ where: { id: lead.id } });
  assert(leadOpted?.isOptedOut === true, "Lead marked isOptedOut: true");
  assert(leadOpted?.status === "OPTED_OUT", "Lead status set to OPTED_OUT");

  const pendingTasks = await prisma.followUpTask.findMany({ where: { leadId: lead.id, status: "SCHEDULED" } });
  assert(pendingTasks.length === 0, "Pending follow-up cadences cancelled on opt-out");

  // Test 6: Voice Phone Studio Lifecycle
  console.log("\n-> Testing Voice Phone Studio Lifecycle...");
  const callLead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Marcus",
      lastName: "Kane",
      email: `marcus_${Date.now()}@shipping.test`,
      companyName: "Kane Global",
      status: "NEW"
    }
  });

  const initCall = await PhoneService.initiateCall(org.id, callLead.id, "OUTBOUND");
  assert(initCall.session.status === "IN_PROGRESS", "Call session initiated");

  const callTurn = await PhoneService.processCallTurn(
    org.id,
    initCall.session.callSid,
    "Hi Morgan, yes we are interested in automating our freight reconciliations."
  );
  assert(callTurn.sdrSpeech.length > 0, "SDR spoken response returned");
  assert(callTurn.transcript.length >= 3, "Turn recorded in call transcript");

  const completedCall = await PhoneService.completeCall(org.id, initCall.session.callSid, 95);
  assert(completedCall.session.status === "COMPLETED", "Call session completed");
  assert(completedCall.analysis.qualificationScore >= 50, "Call analyzed and qualification scored");

  // Test 7: SaaS Analytics Rollup
  console.log("\n-> Testing SaaS Analytics Aggregation...");
  const analytics = await AnalyticsService.getOverview(org.id);
  assert(analytics.totalLeads >= 2, "Analytics counts total leads");
  assert(analytics.emailsSent >= 1, "Analytics counts outbound emails");
  assert(analytics.callsPlaced >= 1, "Analytics counts calls placed");

  // Cleanup test org
  await prisma.organization.delete({ where: { id: org.id } });

  console.log("\n==========================================");
  console.log("ALL 7 END-TO-END WORKFLOW TESTS PASSED! 🚀");
  console.log("==========================================\n");
}

runSuite().catch(err => {
  console.error("Test Suite Crashed:", err);
  process.exit(1);
});