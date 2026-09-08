import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with canonical NexSDR business identities...");

  // Clean existing tables in reverse dependency order
  await prisma.activityLog.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.followUpTask.deleteMany();
  await prisma.followUpRule.deleteMany();
  await prisma.callSession.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.sdrProfile.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 1. Organization: CloudFlow AI
  const org = await prisma.organization.create({
    data: {
      name: "CloudFlow AI",
      industry: "B2B SaaS / Autonomous Sales Engagement",
      website: "https://cloudflow.ai",
      valueProposition: "Autonomous AI SDR platform for qualifying inbound and outbound enterprise pipeline with verified ROI.",
      targetCustomerIcp: "Heads of Revenue Operations, VPs of Sales, and SDR Leaders at B2B software companies.",
      knowledgeBase: `PRODUCT OVERVIEW:
CloudFlow AI is an enterprise sales development platform that connects CRMs, calendar scheduling, and autonomous conversational AI agents.
- Integrations: Native two-way sync with Salesforce, HubSpot, and PostgreSQL.
- Security & Compliance: SOC2 Type II certified, GDPR compliant, role-based access control.
- Pricing Tiers:
  * Starter Plan: $199/month (Includes 1 AI SDR, 500 active leads, email and SMS channels).
  * Growth Plan: $499/month (Includes 3 AI SDRs, unlimited leads, WhatsApp and browser Voice Studio).
  * Enterprise Plan: Custom SLA and dedicated technical account manager.
- Note: No unverified discounts or custom packages are offered. SAP ERP integration is not supported.`,
      objectionRules: `PRICING OBJECTION:
Quote only verified pricing: Starter ($199/mo) and Growth ($499/mo). State directly that unverified discounts are not available.

COMPETITOR OBJECTION:
Acknowledge tool cost differences respectfully. Highlight verified native CRM sync and autonomous BANT qualification without disparaging competitors.

TIMING / BUSY OBJECTION:
Offer a low-friction 10-minute discovery demo call without pressure.`
    }
  });

  // 2. Customer / Workspace Owner: Tanish
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      name: "Tanish",
      email: "tanish@cloudflow.ai",
      passwordHash,
      role: "OWNER",
      organizationId: org.id
    }
  });

  // 3. AI SDR Persona: Alex Rivers
  const sdr = await prisma.sdrProfile.create({
    data: {
      organizationId: org.id,
      personaName: "Alex Rivers",
      email: "alex@nexsdr.in",
      replyTo: "alex@nexsdr.in",
      title: "AI Sales Development Representative",
      tone: "Professional, consultative, and concise",
      qualificationFramework: "BANT",
      customInstructions: "Always qualify for authority and current workflow pain points before scheduling deep technical demos.",
      maxFollowUps: 4,
      autoHandoffBudget: true,
      autoHandoffMeeting: true,
      isActive: true
    }
  });

  // 4. Follow-up Cadence Rules
  const cadenceRules = [
    { stepNumber: 1, channel: "EMAIL", delayDays: 0, condition: "INITIAL_OUTREACH" },
    { stepNumber: 2, channel: "EMAIL", delayDays: 3, condition: "NO_REPLY" },
    { stepNumber: 3, channel: "PHONE", delayDays: 3, condition: "NO_REPLY" },
    { stepNumber: 4, channel: "EMAIL", delayDays: 5, condition: "BREAKUP" }
  ];

  for (const rule of cadenceRules) {
    await prisma.followUpRule.create({
      data: {
        organizationId: org.id,
        stepNumber: rule.stepNumber,
        channel: rule.channel,
        delayDays: rule.delayDays,
        condition: rule.condition
      }
    });
  }

  // 5. Subscription & Usage
  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      tier: "GROWTH",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 28 * 86400000)
    }
  });

  await prisma.usageRecord.createMany({
    data: [
      { organizationId: org.id, metricType: "AI_EMAIL_SENT", quantity: 18 },
      { organizationId: org.id, metricType: "AI_CALL_INITIATED", quantity: 6 }
    ]
  });

  // 6. Test Leads with Distinct External Identities
  // Lead 1: Rahul Sharma (CTO, ABC Technologies) - Primary test lead (NEW)
  const leadRahul = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Rahul",
      lastName: "Sharma",
      email: "rahul@test.example",
      phone: "+91 98765 43210",
      companyName: "ABC Technologies",
      jobTitle: "CTO",
      industry: "Information Technology & Services",
      location: "Bengaluru, India",
      status: "NEW",
      source: "MANUAL_TEST",
      notes: "Primary test lead for external communication and voice simulation.",
      tags: "Enterprise, Cloud, High-Priority",
      intentScore: 25
    }
  });

  // Lead 2: Aman Verma (VP Sales, XYZ Software) - CONTACTED
  const leadAman = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Aman",
      lastName: "Verma",
      email: "aman@test.example",
      phone: "+91 98765 43211",
      companyName: "XYZ Software",
      jobTitle: "VP of Sales",
      industry: "Enterprise Software",
      location: "Delhi, India",
      status: "CONTACTED",
      source: "CSV_IMPORT",
      tags: "SalesOps, Mid-Market",
      intentScore: 45
    }
  });

  const convAman = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: leadAman.id,
      channel: "EMAIL",
      subject: "Accelerating enterprise pipeline at XYZ Software",
      isAiActive: true
    }
  });

  await prisma.message.create({
    data: {
      conversationId: convAman.id,
      channel: "EMAIL",
      direction: "OUTBOUND",
      senderRole: "AI",
      senderId: sdr.id,
      recipientId: leadAman.id,
      content: "Hi Aman, I noticed your sales team expanding outreach at XYZ Software. CloudFlow AI automates cross-pipeline lead qualification and cuts response times by 65%. Would you have 10 minutes next week for a brief discovery call?",
      senderName: "Alex",
      status: "SENT",
      aiReasoning: "Initial outbound cold outreach generated by AI SDR"
    }
  });

  await prisma.followUpTask.create({
    data: {
      organizationId: org.id,
      leadId: leadAman.id,
      stepNumber: 2,
      channel: "EMAIL",
      scheduledFor: new Date(Date.now() + 2 * 86400000),
      status: "SCHEDULED"
    }
  });

  // Lead 3: Priya Mehta (Founder, DemoCorp) - IN_CONVERSATION
  const leadPriya = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Priya",
      lastName: "Mehta",
      email: "priya@test.example",
      phone: "+91 98765 43212",
      companyName: "DemoCorp",
      jobTitle: "Founder & CEO",
      industry: "SaaS Startups",
      location: "Mumbai, India",
      status: "IN_CONVERSATION",
      source: "INBOUND_WEB",
      tags: "Founder, Inbound",
      intentScore: 75
    }
  });

  const convPriya = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: leadPriya.id,
      channel: "EMAIL",
      subject: "Autonomous sales engagement for DemoCorp",
      isAiActive: true
    }
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: convPriya.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        senderRole: "AI",
        senderId: sdr.id,
        recipientId: leadPriya.id,
        content: "Hi Priya, congrats on DemoCorp's recent product launch! I wanted to share how CloudFlow AI helps early-stage tech founders qualify inbound inquiries 24/7 without adding headcount.",
        senderName: "Alex",
        status: "DELIVERED",
        createdAt: new Date(Date.now() - 86400000 * 2)
      },
      {
        conversationId: convPriya.id,
        channel: "EMAIL",
        direction: "INBOUND",
        senderRole: "LEAD",
        senderId: leadPriya.id,
        recipientId: sdr.id,
        content: "Hi Alex, thanks for reaching out. What does pricing look like for growing startups, and do you offer monthly billing?",
        senderName: "Priya Mehta",
        status: "READ",
        createdAt: new Date(Date.now() - 86400000)
      },
      {
        conversationId: convPriya.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        senderRole: "AI",
        senderId: sdr.id,
        recipientId: leadPriya.id,
        content: "Our Starter Plan is $199/month, and the Growth Plan is $499/month with full multi-channel automation and monthly billing. How does that align with your current requirements?",
        senderName: "Alex",
        status: "SENT",
        aiReasoning: "Grounded pricing quote provided directly from knowledge base",
        createdAt: new Date()
      }
    ]
  });

  // 7. Seed Initial Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        organizationId: org.id,
        category: "OUTREACH",
        action: "AI_OUTREACH_SENT",
        detailsJson: JSON.stringify({ leadId: leadAman.id, leadName: "Aman Verma", sdrName: "Alex" }),
        createdAt: new Date(Date.now() - 86400000 * 2)
      },
      {
        organizationId: org.id,
        category: "CONVERSATION",
        action: "LEAD_REPLIED",
        detailsJson: JSON.stringify({ leadId: leadPriya.id, leadName: "Priya Mehta", reply: "What does pricing look like?" }),
        createdAt: new Date(Date.now() - 86400000)
      },
      {
        organizationId: org.id,
        category: "AI",
        action: "AI_REPLY_SENT",
        detailsJson: JSON.stringify({ leadId: leadPriya.id, leadName: "Priya Mehta", intent: "pricing" }),
        createdAt: new Date()
      }
    ]
  });

  console.log("Database seeded successfully with:");
  console.log(`- Customer: Tanish (email: tanish@cloudflow.ai, password: password123)`);
  console.log(`- Organization: CloudFlow AI`);
  console.log(`- AI SDR: Alex`);
  console.log(`- Leads: Rahul Sharma (${leadRahul.id}), Aman Verma (${leadAman.id}), Priya Mehta (${leadPriya.id})`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
