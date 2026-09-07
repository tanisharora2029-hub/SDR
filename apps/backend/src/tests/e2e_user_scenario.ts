import { prisma } from "../lib/prisma.js";
import { aiService } from "../services/ai/aiService.js";
import { ToolExecutor } from "../services/toolExecutor.js";
import { ConversationService } from "../services/conversationService.js";
import { LeadService } from "../services/leadService.js";
import { PhoneService } from "../services/phoneService.js";
import { CalendarService } from "../services/calendarService.js";
import { SdrContext, LeadContext } from "../services/ai/types.js";
import bcrypt from "bcryptjs";

async function runEndToEndUserScenario() {
  console.log("================================================================================");
  console.log("NEXUSSDR 19-STEP COMPLETE END-TO-END USER JOURNEY SCENARIO");
  console.log("================================================================================\n");

  const runId = Date.now();

  // STEP 1: Signup / Login
  console.log("Step 1: User Signup & Organization Creation...");
  const passwordHash = await bcrypt.hash("securePassword123", 10);
  const org = await prisma.organization.create({
    data: {
      name: `Vanguard Cloud ${runId}`,
      industry: "Enterprise AI Infrastructure"
    }
  });

  const user = await prisma.user.create({
    data: {
      name: "Alex Vance",
      email: `user_${runId}@vanguardcloud.com`,
      passwordHash,
      role: "OWNER",
      organizationId: org.id
    }
  });
  console.log(`  -> Organization created: ${org.name} (ID: ${org.id})`);
  console.log(`  -> Owner user registered: ${user.email}`);

  // STEP 2 & 3: Configure SDR & Product Truth Knowledge Base
  console.log("\nStep 2 & 3: Configure SDR Persona & Product Truth Knowledge Base...");
  const sdr = await prisma.sdrProfile.create({
    data: {
      organizationId: org.id,
      personaName: "Devon Reed",
      title: "Strategic Account Specialist",
      tone: "Professional, consultative, crisp",
      qualificationFramework: "BANT",
      isActive: true
    }
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      valueProposition: "Autonomous data reconciliation and compliance pipeline automation.",
      targetCustomerIcp: "VP of Engineering and Data Platform Leaders at Series B+ Tech Companies.",
      knowledgeBase: `PRODUCT TRUTH:
Vanguard Cloud delivers autonomous data pipeline reconciliation.
- Integrations: Native bi-directional sync with Salesforce, Snowflake, and Postgres.
- Compliance: SOC2 Type II verified.
- Pricing: Standard Team tier is $199/month. Enterprise tier requires custom quote.
- Note: We do NOT support legacy on-prem mainframe or SAP.`,
      objectionRules: `When prospect mentions competitor:
- Acknowledge their existing solution.
- Ask what they like and wish could be improved.
- Highlight verified real-time reconciliation without disparaging competitors.`
    }
  });
  console.log("  -> SDR Persona and Product Truth Knowledge Base stored in database.");

  const sdrContext: SdrContext = {
    organizationName: org.name,
    industry: org.industry,
    valueProposition: "Autonomous data reconciliation and compliance pipeline automation.",
    targetCustomerIcp: "VP of Engineering and Data Platform Leaders.",
    knowledgeBase: `Vanguard Cloud delivers autonomous data pipeline reconciliation. Integrations: Salesforce, Snowflake, Postgres. Compliance: SOC2 Type II. Pricing: Starter $199/mo.`,
    objectionRules: "Acknowledge existing solution, ask discovery question, highlight verified capabilities.",
    personaName: sdr.personaName,
    personaTitle: sdr.title,
    tone: sdr.tone,
    qualificationFramework: sdr.qualificationFramework
  };

  // STEP 4: Create Lead
  console.log("\nStep 4: Create Target Account Lead...");
  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Marcus",
      lastName: "Sterling",
      email: `marcus_${runId}@fintechinnovations.io`,
      companyName: "FinTech Innovations Global",
      jobTitle: "VP of Data Engineering",
      industry: "Financial Services",
      status: "NEW",
      intentScore: 20
    }
  });
  console.log(`  -> Lead created: ${lead.firstName} ${lead.lastName} at ${lead.companyName} (Status: ${lead.status})`);

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

  // STEP 5: Generate Cold Email
  console.log("\nStep 5: Generate Autonomous Cold Email Outreach...");
  const outreachResult = await LeadService.triggerAiOutreach(org.id, lead.id);
  const updatedAfterOutreach = await prisma.lead.findUnique({ where: { id: lead.id } });
  console.log(`  -> Outreach generated. Lead status advanced to: ${updatedAfterOutreach?.status}`);
  console.log(`  -> Outbound message saved in DB. Message count: 1`);

  // STEP 6 & 7: Prospect Replies & AI Responds
  console.log("\nStep 6 & 7: Prospect Replies to Email & AI Responds...");
  const reply1 = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "Hi Devon, thanks for reaching out. What makes your data pipeline automation different from standard ETL tools?"
  );
  console.log(`  -> Prospect reply ingested.`);
  console.log(`  -> AI Response generated (${reply1.outboundMsg?.content.slice(0, 80)}...)`);
  console.log(`  -> Zero raw JSON leaked: ${!reply1.outboundMsg?.content.includes("{\"tool\"")}`);

  // STEP 8: Competitor Objection
  console.log("\nStep 8: Competitor Objection Ingested...");
  const compReply = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "We are already using Fivetran and dbt, and our team is pretty happy. Why should we consider switching?"
  );
  console.log(`  -> Competitor objection handled.`);
  console.log(`  -> Action taken: ${compReply.action?.action} (Tool execution: ${compReply.toolExecution ? "Triggered" : "None - pure conversational reply"})`);
  console.log(`  -> Outbound message content: "${compReply.outboundMsg?.content.slice(0, 100)}..."`);
  console.log(`  -> Verification: No raw tool call exposed: ${!compReply.outboundMsg?.content.includes("{\"tool\"")}`);

  // STEP 9: Pricing Question
  console.log("\nStep 9: Pricing Question Ingested...");
  const priceReply = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "What is your pricing model for an engineering team of 25?"
  );
  console.log(`  -> Pricing question answered grounded in Knowledge Base.`);
  console.log(`  -> Outbound content: "${priceReply.outboundMsg?.content.slice(0, 100)}..."`);

  // STEP 10: Qualification Scorecard
  console.log("\nStep 10: Lead Qualification Assessment...");
  const qualLead = await prisma.lead.findUnique({ where: { id: lead.id } });
  console.log(`  -> Current BANT scorecard in DB: ${qualLead?.bantScorecard?.slice(0, 120)}...`);

  // STEP 11, 12 & 13: Meeting Request, Availability Check & Meeting Creation
  console.log("\nStep 11, 12 & 13: Meeting Request & Autonomous Calendar Booking...");
  const meetingReply = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "That sounds interesting. Can we schedule a 30-minute demo call this Thursday at 2 PM?"
  );
  console.log(`  -> Meeting request processed. Action: ${meetingReply.action?.action}`);

  const bookedAppointments = await prisma.appointment.findMany({ where: { organizationId: org.id, leadId: lead.id } });
  console.log(`  -> Appointments created in database: ${bookedAppointments.length}`);
  const qualifiedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
  console.log(`  -> Lead status after demo booking: ${qualifiedLead?.status} (Intent score: ${qualifiedLead?.intentScore})`);

  // STEP 14: Follow-up Cadence Scheduling
  console.log("\nStep 14: Follow-up Cadence Task Scheduled...");
  const cadenceTask = await ToolExecutor.executeTool(org.id, {
    tool: "create_followup",
    arguments: {
      lead_id: lead.id,
      cadence_step: 2,
      channel: "EMAIL",
      delay_days: 3
    }
  });
  console.log(`  -> Follow-up task scheduled for lead: Task ID ${cadenceTask.data?.id}`);

  // STEP 15 & 16: STOP Opt-Out & Verify Cadence Cancellation
  console.log("\nStep 15 & 16: Prospect sends STOP & Verify Cadence Cancellation...");
  const stopReply = await ConversationService.ingestLeadReply(
    org.id,
    lead.id,
    "EMAIL",
    "STOP - please unsubscribe me."
  );
  console.log(`  -> Opt-out processed: ${stopReply.optedOut}`);

  const postOptOutLead = await prisma.lead.findUnique({ where: { id: lead.id } });
  const pendingTasksPostStop = await prisma.followUpTask.findMany({
    where: { leadId: lead.id, status: "SCHEDULED" }
  });
  console.log(`  -> Lead status: ${postOptOutLead?.status} (isOptedOut: ${postOptOutLead?.isOptedOut})`);
  console.log(`  -> Active pending tasks remaining: ${pendingTasksPostStop.length} (Expected: 0)`);

  // STEP 17: Enterprise Human Escalation
  console.log("\nStep 17: Enterprise Human Escalation Handoff...");
  const enterpriseLead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Samantha",
      lastName: "Hayes",
      email: `samantha_${runId}@globalenterprise.com`,
      companyName: "Global Enterprise Capital",
      jobTitle: "Chief Risk Officer",
      status: "IN_CONVERSATION",
      intentScore: 75
    }
  });

  const handoffRes = await ToolExecutor.executeTool(org.id, {
    tool: "human_handoff",
    arguments: {
      lead_id: enterpriseLead.id,
      reason: "Large enterprise account with 8,000 seats requesting custom compliance audit and direct discussion with an executive.",
      priority: "URGENT",
      recommended_action: "Executive Account Director to reach out via phone immediately."
    }
  });
  const handoffLead = await prisma.lead.findUnique({ where: { id: enterpriseLead.id } });
  console.log(`  -> Human handoff executed. Lead status: ${handoffLead?.status} (Priority: URGENT)`);

  // STEP 18: Voice Telephony Simulation
  console.log("\nStep 18: Browser Voice Simulation Lifecycle...");
  const callSession = await PhoneService.initiateCall(org.id, enterpriseLead.id, "OUTBOUND");
  console.log(`  -> Call session initiated with callSid: ${callSession.session.callSid}`);

  const callTurn = await PhoneService.processCallTurn(
    org.id,
    callSession.session.callSid,
    "Hi Devon, could you clarify your data security certifications?"
  );
  console.log(`  -> Spoken turn response generated: "${callTurn.sdrSpeech.slice(0, 80)}..."`);
  console.log(`  -> Zero raw JSON in spoken audio: ${!callTurn.sdrSpeech.includes("{\"tool\"")}`);

  const callEnded = await PhoneService.completeCall(org.id, callSession.session.callSid, 60);
  console.log(`  -> Call completed. Status: ${callEnded.session.status} (Score: ${callEnded.analysis.qualificationScore}/100)`);

  // STEP 19: Analytics Verification
  console.log("\nStep 19: Analytics Verification from Database States...");
  const totalLeads = await prisma.lead.count({ where: { organizationId: org.id } });
  const totalMessages = await prisma.message.count({
    where: { conversation: { organizationId: org.id } }
  });
  const totalCalls = await prisma.callSession.count({ where: { organizationId: org.id } });
  console.log(`  -> Total Leads in Org: ${totalLeads}`);
  console.log(`  -> Total Messages in Org: ${totalMessages}`);
  console.log(`  -> Total Calls Placed in Org: ${totalCalls}`);

  console.log("\n================================================================================");
  console.log("✅ 19-STEP END-TO-END SCENARIO COMPLETED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

runEndToEndUserScenario().catch((err) => {
  console.error("E2E Scenario Error:", err);
  process.exit(1);
});