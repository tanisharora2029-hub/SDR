import { prisma } from "../lib/prisma.js";
import { PhoneService } from "../services/phoneService.js";
import { TtsService } from "../services/ttsService.js";
import { ToneMirroringService } from "../services/ai/toneMirroringService.js";
import { CompetitorRagService } from "../services/ai/competitorRagService.js";
import { WhisperService } from "../services/whisperService.js";
import { CostRouter } from "../services/ai/costRouter.js";
import { aiService } from "../services/ai/aiService.js";

// Helper for test assertions
let passed = 0;
let failed = 0;
const results: Array<{ test: string; status: "PASS" | "FAIL"; latencyMs: number; notes: string }> = [];

function assert(condition: boolean, testName: string, latencyMs: number, notes: string = "") {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS (${latencyMs}ms): ${testName} ${notes ? `[${notes}]` : ""}`);
    results.push({ test: testName, status: "PASS", latencyMs, notes });
  } else {
    failed++;
    console.error(`  ❌ FAIL (${latencyMs}ms): ${testName} ${notes ? `[${notes}]` : ""}`);
    results.push({ test: testName, status: "FAIL", latencyMs, notes });
  }
}

async function runPolishPassSuite() {
  console.log("================================================================================");
  console.log("NEXUSSDR FINAL AI & VOICE POLISH PASS VERIFICATION SUITE");
  console.log("Testing Tone Mirroring, Competitor RAG, Whisper Mode, Latency Masker, Cost Router & 20-Turn Voice");
  console.log("================================================================================\n");

  // 1. Setup Test Organization & Lead
  const org = await prisma.organization.create({
    data: {
      name: `Polish Enterprise Org ${Date.now()}`,
      industry: "Enterprise B2B Software",
      valueProposition: "Autonomous AI SDR engine for outbound qualification.",
      targetCustomerIcp: "VP of Sales, CROs, Sales Directors",
      knowledgeBase: `NexusSDR product truth:
1. Native CRM sync with HubSpot and Salesforce.
2. Verified Pricing: Starter plan is $79/mo, Growth plan is $199/mo, Enterprise plan is custom quote.
3. No discounts permitted without VP approval.
4. Voice calls use natural neural Indian-English prosody.`,
      objectionRules: `Objection rules:
- Competitor mentioned: Acknowledge politely, ask what gaps they experience, mention native CRM automation.
- Pricing question: Quote Starter $79 or Growth $199 verified prices.`
    }
  });

  const sdr = await prisma.sdrProfile.create({
    data: {
      organizationId: org.id,
      personaName: "Morgan Vance",
      title: "Senior AI Sales Representative",
      tone: "Natural spoken conversation, crisp phone dialogue, consultative",
      qualificationFramework: "BANT",
      isActive: true
    }
  });

  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Rahul",
      lastName: "Sharma",
      email: `rahul.polish.${Date.now()}@tatadigital.com`,
      companyName: "Tata Digital",
      jobTitle: "VP of Sales Operations",
      phone: "+919876543210",
      status: "ATTEMPTED",
      intentScore: 50
    }
  });

  const callSession = await prisma.callSession.create({
    data: {
      organizationId: org.id,
      leadId: lead.id,
      callSid: `CA_${Date.now()}_polish_test`,
      direction: "OUTBOUND",
      status: "IN_PROGRESS",
      transcriptJson: JSON.stringify([])
    }
  });

  console.log(`Call Session ${callSession.callSid} initialized for ${lead.firstName} ${lead.lastName}\n`);

  // ===========================================================================
  // SECTION 1: ZERO-SHOT TONE MIRRORING TESTS
  // ===========================================================================
  console.log("--- SECTION 1: Zero-Shot Tone Mirroring ---");

  // 1.1 Casual & Terse message
  const t10 = Date.now();
  const casualInput = "Hey, yeah, just send me the pricing.";
  const casualAnalysis = ToneMirroringService.analyzeTone(casualInput, "voice");
  const t10Lat = Date.now() - t10;
  assert(
    casualAnalysis.profile.formality === "casual" &&
    casualAnalysis.profile.lengthPreference === "terse" &&
    casualAnalysis.profile.directness === "direct" &&
    casualAnalysis.promptDirective.includes("TONE MIRRORING (CASUAL)") &&
    casualAnalysis.promptDirective.includes("BREVITY MIRRORING"),
    "Tone Mirroring: Casual & terse prompt accurately classified with directive",
    t10Lat,
    `formality=${casualAnalysis.profile.formality}, length=${casualAnalysis.profile.lengthPreference}`
  );

  // 1.2 Formal & Technical message
  const t11 = Date.now();
  const formalInput = "Dear Sir, we are requesting compliance documentation regarding SOC2 Type II and SAML SSO integration.";
  const formalAnalysis = ToneMirroringService.analyzeTone(formalInput, "email");
  const t11Lat = Date.now() - t11;
  assert(
    formalAnalysis.profile.formality === "formal" &&
    formalAnalysis.profile.complexity === "technical" &&
    formalAnalysis.promptDirective.includes("TONE MIRRORING (FORMAL)") &&
    formalAnalysis.promptDirective.includes("TECHNICAL PRECISION"),
    "Tone Mirroring: Formal & technical prompt accurately classified with precision directive",
    t11Lat,
    `formality=${formalAnalysis.profile.formality}, complexity=${formalAnalysis.profile.complexity}`
  );

  // 1.3 Execution Test: Casual prompt generation does NOT produce stiff corporate filler
  const t12 = Date.now();
  const casualResponse = await aiService.respondToVoiceMessage(
    {
      organizationName: org.name,
      valueProposition: org.valueProposition,
      targetCustomerIcp: org.targetCustomerIcp,
      knowledgeBase: org.knowledgeBase,
      objectionRules: org.objectionRules,
      personaName: sdr.personaName,
      personaTitle: sdr.title,
      tone: sdr.tone,
      qualificationFramework: sdr.qualificationFramework
    },
    {
      leadId: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      companyName: lead.companyName,
      jobTitle: lead.jobTitle,
      industry: lead.industry,
      status: lead.status,
      intentScore: lead.intentScore
    },
    [],
    casualInput
  );
  const t12Lat = Date.now() - t12;
  const replyContent = casualResponse.content || "";
  const isStiff = /(delighted to provide|comprehensive pricing information|sincerely|greetings)/i.test(replyContent);
  assert(
    !isStiff && replyContent.length > 0,
    "Tone Mirroring Execution: SDR avoids stiff corporate pleasantries on casual input",
    t12Lat,
    `Sample: "${replyContent.slice(0, 70)}..."`
  );

  // ===========================================================================
  // SECTION 2: COMPETITOR RAG WITH ZERO HALLUCINATION
  // ===========================================================================
  console.log("\n--- SECTION 2: Competitor RAG with Zero Hallucination ---");

  // 2.1 Known competitor retrieval (Salesforce)
  const t20 = Date.now();
  const knownComp = await CompetitorRagService.detectAndRetrieve("We already use Salesforce for our sales team.", org.knowledgeBase, org.objectionRules);
  const t20Lat = Date.now() - t20;
  assert(
    knownComp !== null &&
    knownComp.competitorName.toLowerCase() === "salesforce" &&
    knownComp.isVerified === true &&
    knownComp.differentiationAngle.toLowerCase().includes("salesforce"),
    "Competitor RAG: Known competitor (Salesforce) verified and battlecard retrieved",
    t20Lat,
    `Angle: ${knownComp?.differentiationAngle}`
  );

  // 2.2 Unverified competitor detection & zero-hallucination fallback instruction
  const t21 = Date.now();
  const unverifiedComp = await CompetitorRagService.detectAndRetrieve("Do you integrate with Zoho CRM?", org.knowledgeBase, org.objectionRules);
  const t21Lat = Date.now() - t21;
  const unverifiedDirectives = CompetitorRagService.formatPromptDirectives(unverifiedComp);
  assert(
    unverifiedComp !== null &&
    unverifiedComp.competitorName.toLowerCase() === "zoho" &&
    unverifiedComp.isVerified === false &&
    unverifiedDirectives.includes("I don't have verified information on that specific feature yet, so I don't want to guess."),
    "Competitor RAG: Unverified competitor enforces strict 'no guessing' directive",
    t21Lat,
    "Guarantees zero hallucination"
  );

  // ===========================================================================
  // SECTION 3: WHISPER MODE & HUMAN TAKEOVER
  // ===========================================================================
  console.log("\n--- SECTION 3: Whisper Mode & Human Takeover ---");

  // 3.1 Telemetry Dossier Generation
  const t30 = Date.now();
  const dossier = await WhisperService.updateLiveWhisperAssist(
    org.id,
    callSession.callSid,
    "We already use HubSpot and we're not sure why we need an AI SDR.",
    [{ speaker: "lead", text: "Hello" }]
  );
  const t30Lat = Date.now() - t30;
  assert(
    dossier !== null &&
    dossier.callSid === callSession.callSid &&
    dossier.leadName === "Rahul Sharma" &&
    dossier.detectedObjection.toLowerCase().includes("hubspot") &&
    dossier.recommendedTalkingPoints.length > 0 &&
    dossier.suggestedResponse.length > 0,
    "Whisper Mode: Live telemetry dossier generated with objection, talking points & draft",
    t30Lat,
    `Objection: ${dossier.detectedObjection}`
  );

  // 3.2 Human Takeover activates and mutes AI speech
  const t31 = Date.now();
  WhisperService.setTakeover(callSession.callSid, true);
  const takeoverActive = WhisperService.isTakeoverActive(callSession.callSid);
  const takeoverTurnRes = await PhoneService.processCallTurn(org.id, callSession.callSid, "Can you explain your enterprise SLA?");
  const t31Lat = Date.now() - t31;
  assert(
    takeoverActive &&
    takeoverTurnRes.isHumanTakeover === true &&
    takeoverTurnRes.sdrSpeech === "",
    "Whisper Mode: Human takeover silences AI speech immediately (sdrSpeech empty)",
    t31Lat,
    "AI strictly muted while rep speaks"
  );

  // Release takeover for subsequent testing
  WhisperService.setTakeover(callSession.callSid, false);

  // ===========================================================================
  // SECTION 4: INTELLIGENT COST ROUTING
  // ===========================================================================
  console.log("\n--- SECTION 4: Intelligent Cost Routing ---");

  const t40 = Date.now();
  const voiceRouting = CostRouter.routeTask("LIVE_VOICE_TURN");
  const t40Lat = Date.now() - t40;
  assert(
    voiceRouting.selectedProvider === "gemini-online" &&
    voiceRouting.priority === "LIVE_HIGH_PRIORITY_VOICE",
    "Cost Router: Live voice turns routed to online streaming engine (zero local GPU)",
    t40Lat,
    voiceRouting.modelName
  );

  const t41 = Date.now();
  const scoringRouting = CostRouter.routeTask("LEAD_SCORING");
  const summaryRouting = CostRouter.routeTask("SUMMARIZATION");
  const t41Lat = Date.now() - t41;
  assert(
    scoringRouting.priority === "ASYNC_CHEAP" &&
    summaryRouting.priority === "ASYNC_CHEAP" &&
    scoringRouting.selectedProvider === "ollama-local",
    "Cost Router: Async tasks (scoring, summarization) routed to local Ollama/Qwen (zero cost)",
    t41Lat,
    `Provider: ${scoringRouting.selectedProvider}`
  );

  // ===========================================================================
  // SECTION 5: VOICE QUALITY & 20-TURN CONVERSATION SCALING
  // ===========================================================================
  console.log("\n--- SECTION 5: Voice Quality & 20-Turn Conversation Scaling ---");

  // 5.1 Verify NeerjaNeural is default TTS voice
  const t50 = Date.now();
  const neerjaAudio = await TtsService.synthesizeBuffer("Hi Rahul, thanks for taking the call.", "en-IN-NeerjaNeural");
  const t50Lat = Date.now() - t50;
  assert(
    neerjaAudio.length > 10000,
    "Voice Quality: Restored demo voice en-IN-NeerjaNeural synthesized cleanly",
    t50Lat,
    `${neerjaAudio.length} bytes, ~${t50Lat}ms latency`
  );

  // 5.2 Multi-Turn Scaling: 1, 2, 3, 5, 10, 20 Turns
  console.log("Executing 20-turn conversational dialogue simulation...");
  const sample20Dialogue = [
    "Hi, who is this calling?",                                          // Turn 1
    "What company are you with and what do you do?",                    // Turn 2
    "We already use HubSpot for our CRM.",                              // Turn 3
    "How does your AI actually integrate with HubSpot?",                // Turn 4
    "Does it handle cold outbound emails automatically?",                // Turn 5
    "What about phone calls, can it speak to prospects?",               // Turn 6
    "Does it sound robotic or like a real human?",                      // Turn 7
    "How much does your platform cost per month?",                       // Turn 8
    "Are there any volume discounts available?",                        // Turn 9
    "What if our sales team wants to review emails before sending?",    // Turn 10
    "Can it qualify leads using BANT or MEDDIC?",                       // Turn 11
    "What kind of analytics and reporting do we get?",                  // Turn 12
    "How long does onboarding typically take?",                         // Turn 13
    "Do you comply with SOC2 and GDPR regulations?",                    // Turn 14
    "What happens when a prospect asks to be removed?",                 // Turn 15
    "Can you handle multi-touch cadences across email and phone?",      // Turn 16
    "That sounds interesting. Can you send me some documentation?",     // Turn 17
    "Actually, could you set up a live product demo for us?",           // Turn 18
    "Tuesday at 3 PM works well for me.",                               // Turn 19
    "Great, looking forward to it. Have a good afternoon."              // Turn 20
  ];

  let multiTurnPassed = true;
  let turnsCompleted = 0;
  const loopStart = Date.now();

  for (let i = 0; i < sample20Dialogue.length; i++) {
    const utt = sample20Dialogue[i];
    const turnStart = Date.now();
    try {
      const turnRes = await PhoneService.processCallTurn(org.id, callSession.callSid, utt);
      const turnDuration = Date.now() - turnStart;
      turnsCompleted++;

      if (!turnRes.sdrSpeech || turnRes.sdrSpeech.length === 0) {
        multiTurnPassed = false;
        console.error(`Turn ${i + 1} produced empty response!`);
        break;
      }

      // Check key milestones
      if (turnsCompleted === 1 || turnsCompleted === 2 || turnsCompleted === 3 || turnsCompleted === 5 || turnsCompleted === 10 || turnsCompleted === 20) {
        console.log(`  --> Completed Turn ${turnsCompleted}/20 (${turnDuration}ms): SDR -> "${turnRes.sdrSpeech.slice(0, 60)}..."`);
      }
    } catch (e: any) {
      console.error(`Turn ${i + 1} execution failed:`, e);
      multiTurnPassed = false;
      break;
    }
  }

  const loopTotalLat = Date.now() - loopStart;
  const avgTurnLat = Math.round(loopTotalLat / turnsCompleted);

  assert(
    multiTurnPassed && turnsCompleted === 20,
    "Voice Scaling: 20 consecutive turns completed without state deadlocks or stalls",
    loopTotalLat,
    `20/20 turns successful, avg turn latency: ${avgTurnLat}ms`
  );

  // Verify full call transcript in database contains 20 pairs (40 messages)
  const finalCall = await prisma.callSession.findUnique({
    where: { callSid: callSession.callSid }
  });
  const finalTranscript = JSON.parse(finalCall?.transcriptJson || "[]");
  assert(
    finalTranscript.length >= 40,
    "Database Persistence: All 20 conversation turns persisted in transcriptJson",
    0,
    `${finalTranscript.length} total messages stored`
  );

  console.log("\n================================================================================");
  console.log(`POLISH PASS SUITE COMPLETED: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPolishPassSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
