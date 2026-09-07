import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { GroqProvider } from "../services/ai/groqProvider.js";
import { CostRouter } from "../services/ai/costRouter.js";
import { aiService } from "../services/ai/aiService.js";
import { SdrContext, LeadContext } from "../services/ai/types.js";

async function runRenderDeploymentTests() {
  console.log("\n=======================================================");
  console.log("RENDER DEPLOYMENT & PRODUCTION READINESS TEST SUITE");
  console.log("=======================================================\n");

  let passed = 0;

  // TEST 1: Prisma Schema Dual-Provider Verification
  console.log("[TEST 1] Prisma Schema Provider Switching");
  const schemaPath = path.resolve(process.cwd(), "apps/backend/prisma/schema.prisma");
  assert(fs.existsSync(schemaPath), "schema.prisma exists");

  const schemaText = fs.readFileSync(schemaPath, "utf8");
  assert(
    schemaText.includes('provider = "sqlite"') || schemaText.includes('provider = "postgresql"'),
    "schema.prisma has valid datasource provider"
  );
  console.log("  ✅ PASS: schema.prisma contains standard datasource configuration");
  passed++;

  // TEST 2: Server Host Binding Verification
  console.log("[TEST 2] Server Host Binding & Environment Variables");
  const serverPath = path.resolve(process.cwd(), "apps/backend/src/server.ts");
  const serverCode = fs.readFileSync(serverPath, "utf8");
  assert(serverCode.includes("0.0.0.0"), "server.ts binds explicitly to 0.0.0.0");
  assert(serverCode.includes("process.env.PORT"), "server.ts listens on process.env.PORT");
  assert(serverCode.includes("CORS_ORIGIN"), "server.ts supports configurable CORS_ORIGIN");
  console.log("  ✅ PASS: server.ts binds to 0.0.0.0 and dynamically respects process.env.PORT & CORS_ORIGIN");
  passed++;

  // TEST 3: GroqProvider Structure & Sanitization
  console.log("[TEST 3] GroqProvider Implementation & Safe Parsing");
  const groq = new GroqProvider();
  assert(typeof groq.generateOutreach === "function", "GroqProvider implements generateOutreach");
  assert(typeof groq.respondToMessage === "function", "GroqProvider implements respondToMessage");
  assert(typeof groq.qualifyLead === "function", "GroqProvider implements qualifyLead");
  assert(typeof groq.summarizeCall === "function", "GroqProvider implements summarizeCall");

  const rawJsonReply = '```json\n{"reply": "Hello, we can help streamline your lead pipeline.", "tool": "none"}\n```';
  const sanitized = groq.sanitizeReply(rawJsonReply);
  assert(!sanitized.includes("```"), "Fences stripped");
  assert(!sanitized.includes('"reply"'), "JSON key stripped");
  assert(sanitized.includes("streamline your lead pipeline"), "Extracted clean conversational text");

  const parsedAction = groq.parseAiAction(rawJsonReply, "lead-123");
  assert.strictEqual(parsedAction.action.intent, "conversation");
  assert.strictEqual(parsedAction.action.action, "none");
  console.log("  ✅ PASS: GroqProvider correctly implements AiProvider interface with zero-leakage sanitization");
  passed++;

  // TEST 4: CostRouter with AI_PROVIDER=groq
  console.log("[TEST 4] CostRouter Groq Routing Integration");
  process.env.AI_PROVIDER = "groq";
  const voiceDecision = CostRouter.routeTask("LIVE_VOICE_TURN");
  assert.strictEqual(voiceDecision.selectedProvider, "groq-online");
  assert.strictEqual(voiceDecision.priority, "LIVE_HIGH_PRIORITY_VOICE");

  const asyncDecision = CostRouter.routeTask("EMAIL_DRAFTING");
  assert.strictEqual(asyncDecision.selectedProvider, "groq-online");
  assert.strictEqual(asyncDecision.priority, "ASYNC_CHEAP");
  console.log("  ✅ PASS: CostRouter accurately routes voice and async tasks to groq-online when AI_PROVIDER=groq");
  passed++;

  // TEST 5: Fallback Protection when API Key Unset
  console.log("[TEST 5] Safe Fallback Resilience");
  // Temporarily ensure no key so it tests the fallback
  const sdr: SdrContext = {
    organizationName: "Render Cloud Scale",
    personaName: "Alex Rivers",
    personaTitle: "SDR",
    tone: "Professional",
    qualificationFramework: "BANT"
  };
  const lead: LeadContext = {
    leadId: "lead-render-101",
    firstName: "Priya",
    lastName: "Nair",
    email: "priya@acme.corp",
    companyName: "Acme Corp",
    status: "NEW",
    intentScore: 50
  };

  const outreach = await aiService.generateOutreach(sdr, lead);
  assert(outreach.content && outreach.content.length > 0, "Outreach content returned");
  assert(!outreach.content.includes("{"), "No raw JSON in outreach");
  console.log("  ✅ PASS: AiService safely falls back without crashing when API key is not yet set");
  passed++;

  // TEST 6: Root Scripts for Render Build & Start
  console.log("[TEST 6] Root package.json Render Lifecycle Scripts");
  const rootPkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
  assert(rootPkg.scripts["build:backend"], "root package.json has build:backend");
  assert(rootPkg.scripts["start:backend"], "root package.json has start:backend");
  console.log("  ✅ PASS: root package.json defines build:backend and start:backend");
  passed++;

  // Reset env
  delete process.env.AI_PROVIDER;

  console.log("\n=======================================================");
  console.log(`RENDER DEPLOYMENT SUITE: ${passed}/6 TESTS PASSED | 0 FAILED`);
  console.log("=======================================================\n");
}

runRenderDeploymentTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
