import { aiService } from "../services/ai/aiService.js";
import { SdrContext, LeadContext, ConversationTurn } from "../services/ai/types.js";
import { execSync } from "child_process";

function getGpuVram(): { usedMb: number; totalMb: number } | null {
  try {
    const out = execSync("nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits", { encoding: "utf-8" });
    const [used, total] = out.trim().split(",").map(s => parseInt(s.trim(), 10));
    return { usedMb: used, totalMb: total };
  } catch {
    return null;
  }
}

const mockSdrContext: SdrContext = {
  organizationName: "Nexus AI SDR",
  industry: "B2B SaaS / Sales Acceleration",
  valueProposition: "Autonomous AI sales agents that qualify inbound and outbound pipeline 24/7",
  targetCustomerIcp: "VP of Sales and Heads of Revenue at high-growth tech companies",
  knowledgeBase: "Nexus integrates with HubSpot, Salesforce, and Apollo. Security includes SOC2 Type II compliance.",
  objectionRules: "If prospect mentions competitors, emphasize 3x higher meeting conversion and native CRM auto-sync.",
  personaName: "Morgan Vance",
  personaTitle: "Senior Enterprise Sales Representative",
  tone: "Professional, consultative, crisp",
  qualificationFramework: "BANT"
};

const mockLeadContext: LeadContext = {
  leadId: "bench_lead_01",
  firstName: "Elena",
  lastName: "Rostova",
  email: "elena@acme-corp.com",
  companyName: "Acme Corp",
  jobTitle: "VP of Revenue Operations",
  industry: "Enterprise Software",
  status: "IN_CONVERSATION",
  intentScore: 65
};

const mockHistory: ConversationTurn[] = [
  { speaker: "sdr", channel: "EMAIL", content: "Hi Elena, noticed Acme Corp is scaling its SDR team. Would you be open to an AI agent handling tier-1 outreach?" },
  { speaker: "lead", channel: "EMAIL", content: "We are currently evaluating Outreach and Apollo. What makes your platform different, and can we schedule a demo?" }
];

async function runConcurrencyLevel(concurrency: number) {
  console.log(`\n========================================`);
  console.log(`Testing Concurrency Level: ${concurrency} parallel SDR streams`);
  console.log(`========================================`);

  const initialVram = getGpuVram();
  const initialMem = process.memoryUsage();
  const startTime = Date.now();

  const promises = Array.from({ length: concurrency }).map(async (_, idx) => {
    const reqStart = Date.now();
    try {
      const response = await aiService.respondToMessage(
        mockSdrContext,
        { ...mockLeadContext, leadId: `bench_lead_${idx}` },
        mockHistory,
        "What makes your platform different, and can we schedule a demo this Thursday?"
      );
      const reqLatency = Date.now() - reqStart;
      return {
        success: true,
        latencyMs: reqLatency,
        tokens: response.tokensUsed || 60,
        toolDecision: response.toolDecision?.tool || "none",
        error: null
      };
    } catch (err: any) {
      const reqLatency = Date.now() - reqStart;
      return {
        success: false,
        latencyMs: reqLatency,
        tokens: 0,
        toolDecision: "none",
        error: err.message
      };
    }
  });

  const results = await Promise.all(promises);
  const wallClockMs = Date.now() - startTime;
  const endVram = getGpuVram();
  const endMem = process.memoryUsage();

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalTokens = successful.reduce((sum, r) => sum + r.tokens, 0);

  const latencies = successful.map(r => r.latencyMs).sort((a, b) => a - b);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const minLat = latencies[0] || 0;
  const maxLat = latencies[latencies.length - 1] || 0;

  const effectiveTokensPerSec = wallClockMs > 0 ? Number(((totalTokens / (wallClockMs / 1000))).toFixed(1)) : 0;
  const rps = wallClockMs > 0 ? Number(((successful.length / (wallClockMs / 1000))).toFixed(2)) : 0;

  console.log(`Results for ${concurrency} concurrent streams:`);
  console.log(`  Successful requests: ${successful.length}/${concurrency} (${failed.length} failed)`);
  console.log(`  Wall-Clock Duration: ${(wallClockMs / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${rps} RPS | ${effectiveTokensPerSec} tokens/sec`);
  console.log(`  Avg Latency: ${avgLatency}ms (Min: ${minLat}ms, Max: ${maxLat}ms)`);
  console.log(`  P50: ${p50}ms | P95: ${p95}ms`);
  console.log(`  Total Tokens: ${totalTokens} tokens`);
  if (endVram) {
    console.log(`  GPU VRAM: ${endVram.usedMb} MB / ${endVram.totalMb} MB (Delta: +${endVram.usedMb - (initialVram?.usedMb || 0)} MB)`);
  }
  console.log(`  Process RAM: ${(endMem.rss / 1024 / 1024).toFixed(1)} MB`);

  return {
    concurrency,
    successful: successful.length,
    failed: failed.length,
    wallClockMs,
    rps,
    avgLatency,
    p50,
    p95,
    totalTokens,
    tokensPerSec: effectiveTokensPerSec,
    vramUsedMb: endVram?.usedMb || 0,
    ramRssMb: Math.round(endMem.rss / 1024 / 1024)
  };
}

async function main() {
  console.log("==========================================================");
  console.log("NEXUSSDR PRODUCTION CONCURRENCY & STRESS BENCHMARK");
  console.log("Hardware: Host GPU + Local Ollama Inference (qwen2.5:3b)");
  console.log("==========================================================");

  const levels = [1, 5, 10, 20];
  const summary: any[] = [];

  for (const lvl of levels) {
    const res = await runConcurrencyLevel(lvl);
    summary.push(res);
    // 2-second cooldown
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n=========================================================================================");
  console.log("CONCURRENCY BENCHMARK SUMMARY TABLE");
  console.log("=========================================================================================");
  console.log("| Concurrency | Success Rate | Wall Time | RPS  | Avg Latency | P95 Latency | Tokens/sec | VRAM (MB) |");
  console.log("|-------------|--------------|-----------|------|-------------|-------------|------------|-----------|");
  for (const s of summary) {
    const successRate = `${Math.round((s.successful / s.concurrency) * 100)}%`;
    const wallSec = `${(s.wallClockMs / 1000).toFixed(2)}s`;
    console.log(`| ${s.concurrency.toString().padEnd(11)} | ${successRate.padEnd(12)} | ${wallSec.padEnd(9)} | ${s.rps.toString().padEnd(4)} | ${(s.avgLatency + "ms").padEnd(11)} | ${(s.p95 + "ms").padEnd(11)} | ${s.tokensPerSec.toString().padEnd(10)} | ${s.vramUsedMb.toString().padEnd(9)} |`);
  }
  console.log("=========================================================================================\n");
}

main().catch(console.error);