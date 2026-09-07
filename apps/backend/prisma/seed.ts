import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with production demo business...");

  // Clean existing
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

  // 1. Organization
  const org = await prisma.organization.create({
    data: {
      name: "NexusSDR AI",
      industry: "B2B SaaS / Autonomous Sales Engagement",
      website: "https://nexussdr.com",
      valueProposition: "Autonomous AI SDR platform for qualifying inbound and outbound enterprise pipeline.",
      targetCustomerIcp: "Heads of Revenue Operations, VPs of Sales, and SDR Leaders at B2B software companies.",
      knowledgeBase: `PRODUCT OVERVIEW:
NexusSDR is an enterprise sales development platform that connects CRMs, calendar systems, and conversational AI.
- Integrations: Native two-way sync with Salesforce, HubSpot, and PostgreSQL.
- Security & Compliance: SOC2 Type II certified, GDPR compliant, role-based access control.
- Pricing: Starter ($199/month), Growth ($499/month).
- Note: No unverified discounts or custom packages are offered. SAP ERP integration is not supported.`,
      objectionRules: `PRICING OBJECTION:
Quote only verified pricing: Starter ($199/mo) and Growth ($499/mo). State that unverified discounts are not available.

COMPETITOR OBJECTION:
Acknowledge tool cost differences. Highlight verified native CRM sync and autonomous BANT qualification without disparaging competitors.

TIMING / BUSY OBJECTION:
Offer a low-friction 10-minute discovery demo call without pressure.`
    }
  });

  // 2. Demo User
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      name: "Devon Vance",
      email: "demo@nexus-sdr.com",
      passwordHash,
      role: "OWNER",
      organizationId: org.id
    }
  });

  // 3. SDR Profile
  await prisma.sdrProfile.create({
    data: {
      organizationId: org.id,
      personaName: "Alex Rivers",
      title: "Strategic Sales Development Representative",
      tone: "Professional, consultative, high-energy, concise, and ROI-focused",
      qualificationFramework: "BANT",
      customInstructions: "Always qualify for authority and existing workflow pain points before scheduling deep technical demos.",
      maxFollowUps: 4,
      autoHandoffBudget: true,
      autoHandoffMeeting: true,
      isActive: true
    }
  });

  // 4. Cadence Rules
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
      { organizationId: org.id, metricType: "AI_EMAIL_SENT", quantity: 24 },
      { organizationId: org.id, metricType: "AI_CALL_INITIATED", quantity: 8 }
    ]
  });

  // 6. Test Leads across different funnel stages
  // Lead 1: NEW
  await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Sarah",
      lastName: "Jenkins",
      email: "sarah.jenkins@fintechops.com",
      phone: "+1 (555) 234-5678",
      companyName: "FinTech Ops Inc",
      jobTitle: "Head of Operations",
      industry: "Financial Services",
      location: "New York, USA",
      status: "NEW",
      intentScore: 20
    }
  });

  // Lead 2: CONTACTED
  const lead2 = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Marcus",
      lastName: "Vance",
      email: "marcus.vance@retailscale.io",
      phone: "+1 (555) 345-6789",
      companyName: "RetailScale Systems",
      jobTitle: "VP of Logistics",
      industry: "E-Commerce Logistics",
      location: "Chicago, USA",
      status: "CONTACTED",
      intentScore: 40
    }
  });

  const conv2 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: lead2.id,
      channel: "EMAIL",
      subject: "Streamlining logistics routing for RetailScale Systems"
    }
  });

  await prisma.message.create({
    data: {
      conversationId: conv2.id,
      channel: "EMAIL",
      direction: "OUTBOUND",
      content: "Hi Marcus, I noticed your team expanding fulfillment routes at RetailScale. NexusSDR automates cross-warehouse compliance and cut routing delays by 60% for similar supply networks. Would you have 10 minutes next Tuesday to review how it works?",
      senderName: "Alex Rivers",
      status: "SENT"
    }
  });

  await prisma.followUpTask.create({
    data: {
      organizationId: org.id,
      leadId: lead2.id,
      stepNumber: 2,
      channel: "EMAIL",
      scheduledFor: new Date(Date.now() + 2 * 86400000),
      status: "SCHEDULED"
    }
  });

  // Lead 3: IN_CONVERSATION
  const lead3 = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena.rostova@healthguard.org",
      phone: "+1 (555) 456-7890",
      companyName: "HealthGuard Analytics",
      jobTitle: "Director of Clinical Tech",
      industry: "Healthcare SaaS",
      location: "Boston, USA",
      status: "IN_CONVERSATION",
      intentScore: 70
    }
  });

  const conv3 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: lead3.id,
      channel: "EMAIL",
      subject: "Automated HIPAA compliance workflows for HealthGuard"
    }
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv3.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        content: "Hi Elena, Given HealthGuard's rapid growth in clinical analytics, I wanted to share how NexusSDR maintains continuous HIPAA audit validation without manual reviews.",
        senderName: "Alex Rivers",
        status: "DELIVERED",
        createdAt: new Date(Date.now() - 86400000 * 2)
      },
      {
        conversationId: conv3.id,
        channel: "EMAIL",
        direction: "INBOUND",
        content: "Hi Alex, this is interesting. Does your system integrate directly with Salesforce Health Cloud, and what does implementation typically look like?",
        senderName: "Elena Rostova",
        status: "READ",
        createdAt: new Date(Date.now() - 86400000)
      },
      {
        conversationId: conv3.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        content: "Yes Elena, NexusSDR provides an out-of-the-box bi-directional integration with Salesforce Health Cloud. Typical onboarding takes under 15 minutes with no custom engineering required. What specific data entities are you routing most frequently?",
        senderName: "Alex Rivers",
        status: "SENT",
        createdAt: new Date()
      }
    ]
  });

  // Lead 4: QUALIFIED (With Appointment)
  const lead4 = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "David",
      lastName: "Chen",
      email: "david.chen@apexlogistics.com",
      phone: "+1 (555) 789-0123",
      companyName: "Apex Logistics Global",
      jobTitle: "VP of Engineering",
      industry: "Freight & Shipping",
      location: "Seattle, USA",
      status: "QUALIFIED",
      intentScore: 90,
      bantScorecard: JSON.stringify({
        budget: "$25,000 annual approved SaaS budget",
        authority: "VP of Engineering with sole technical sign-off",
        need: "Replace legacy custom scripts causing shipment tracking timeouts",
        timeline: "Q4 immediate deployment",
        notes: "High enthusiasm. VP wants to test Salesforce connector on live demo."
      })
    }
  });

  await prisma.appointment.create({
    data: {
      organizationId: org.id,
      leadId: lead4.id,
      title: "NexusSDR Architecture Demo & Connector Walkthrough",
      scheduledAt: new Date(Date.now() + 86400000 * 3),
      durationMinutes: 30,
      attendeeEmail: lead4.email,
      notes: "Lead requested Salesforce connector deep-dive with solutions engineer."
    }
  });

  await prisma.callSession.create({
    data: {
      organizationId: org.id,
      leadId: lead4.id,
      callSid: "call_demo_david_apex",
      direction: "OUTBOUND",
      status: "COMPLETED",
      durationSeconds: 184,
      aiSummary: "David confirmed $25k budget allocation and engineering sign-off. Wants to eliminate legacy routing scripts before Q4 peak season. Scheduled live demo.",
      qualificationScore: 92,
      transcriptJson: JSON.stringify([
        { speaker: "sdr", text: "Hi David, Alex from NexusSDR here. Thanks for taking my call!", timestamp: Date.now() - 184000 },
        { speaker: "lead", text: "Hey Alex, good timing. We've been having continuous failures with our custom dispatch scripts.", timestamp: Date.now() - 150000 },
        { speaker: "sdr", text: "I hear that often from shipping leaders. NexusSDR handles automated failover with sub-second retry logic.", timestamp: Date.now() - 110000 },
        { speaker: "lead", text: "Sounds perfect. Let's schedule a demo for Thursday so I can see the API specs.", timestamp: Date.now() - 40000 },
        { speaker: "sdr", text: "Awesome! I've sent the calendar invite for Thursday at 2 PM. Looking forward to it!", timestamp: Date.now() }
      ])
    }
  });

  // Lead 5: HANDOFF_REQUIRED (Escalation)
  const lead5 = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Rachel",
      lastName: "Zane",
      email: "rachel.zane@globalbankcorp.com",
      phone: "+1 (555) 890-1234",
      companyName: "Global Bankcorp Financial",
      jobTitle: "Senior Managing Director of Procurement",
      industry: "Investment Banking",
      location: "San Francisco, USA",
      status: "HANDOFF_REQUIRED",
      intentScore: 98,
      bantScorecard: JSON.stringify({
        budget: "Enterprise $100k+ Tier",
        authority: "Head of Procurement & Legal Steering Committee",
        need: "Full SOC2 Type II, custom Master Service Agreement, and private VPC deployment for 5,000 bankers",
        timeline: "Immediate Q3 RFP cycle",
        notes: "Enterprise whale prospect. Requires immediate human account executive consultation."
      })
    }
  });

  const conv5 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      leadId: lead5.id,
      channel: "EMAIL",
      subject: "Urgent Enterprise RFP: NexusSDR <> Global Bankcorp",
      isEscalated: true,
      escalationReason: "Prospect requires custom SOC2 compliance audit, custom MSA legal review, and dedicated on-prem VPC rollout for 5,000 users.",
      escalatedAt: new Date(Date.now() - 3600000 * 4)
    }
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv5.id,
        channel: "EMAIL",
        direction: "INBOUND",
        content: "We are evaluating NexusSDR for 5,000 corporate seats. We require your VP of Sales and Security Counsel on a call tomorrow to review our custom SOC2 audit requirements and master service agreement terms.",
        senderName: "Rachel Zane",
        status: "READ"
      },
      {
        conversationId: conv5.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        content: "Thank you Rachel. Given your enterprise scale and compliance specifications, I am escalating your account immediately to our Senior Solutions Director who will coordinate directly with your legal steering committee.",
        senderName: "Alex Rivers",
        status: "SENT",
        aiReasoning: "Triggered human_handoff tool: enterprise scale and custom contract terms require human Account Executive."
      }
    ]
  });

  console.log("Database seeded successfully with complete enterprise demo state!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });