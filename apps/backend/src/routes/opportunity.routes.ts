import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { OpportunityService } from "../services/opportunity/opportunityService.js";
import { logger } from "../lib/logger.js";

import { territoryProvider } from "../services/opportunity/territory.js";
import { z } from "zod";

export const opportunityRouter = Router();

const areaSchema = z.object({ lat: z.number().min(6).max(38), lng: z.number().min(68).max(98),
  radius: z.union([z.literal(2000), z.literal(5000), z.literal(10000)]), industry: z.enum(["salon","property"]) });
opportunityRouter.post("/territory", authenticate, async (req, res) => {
  const area = areaSchema.safeParse(req.body);
  if (!area.success) return res.status(400).json({error:"Select a supported Indian territory and radius."});
  try { res.json({listings: await territoryProvider.search(area.data)}); }
  catch { res.status(503).json({error:"Map directory temporarily unavailable. Retry shortly."}); }
});

// 1. List opportunities
opportunityRouter.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { status, tier, search } = req.query;
    const opportunities = await OpportunityService.getOpportunities(req.organizationId!, {
      status: status ? String(status) : undefined,
      tier: tier ? String(tier) : undefined,
      search: search ? String(search) : undefined
    });
    res.json({ success: true, count: opportunities.length, opportunities });
  } catch (err: any) {
    logger.error(`Error fetching opportunities: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get single deep opportunity analysis
opportunityRouter.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const opp = await OpportunityService.getOpportunityById(req.organizationId!, req.params.id);
    if (!opp) {
      return res.status(404).json({ success: false, error: "Opportunity not found" });
    }
    res.json({ success: true, opportunity: opp });
  } catch (err: any) {
    logger.error(`Error fetching opportunity: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2b. Get latest research run telemetry
opportunityRouter.get("/research-runs/latest", authenticate, async (req: Request, res: Response) => {
  try {
    const run = await OpportunityService.getLatestResearchRun(req.organizationId!);
    res.json({ success: true, run });
  } catch (err: any) {
    logger.error(`Error fetching latest research run: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Mode 1: Run Autopilot discovery
opportunityRouter.post("/autopilot", authenticate, async (req: Request, res: Response) => {
  try {
    const opportunities = await OpportunityService.runAutopilot(req.organizationId!);
    const count = Array.isArray(opportunities) ? opportunities.length : 0;
    const discoveryStatus = (opportunities as any).discoveryStatus || (count > 0 ? "SUCCESS" : "NO_RESULTS");
    const metrics = (opportunities as any).metrics || null;
    const message =
      (opportunities as any).message ||
      (count > 0
        ? `Autopilot discovery completed. Found ${count} opportunities.`
        : "No real businesses discovered matching MachineMind ICP.");

    res.json({
      success: true,
      count,
      discoveryStatus,
      message,
      metrics,
      opportunities
    });
  } catch (err: any) {
    logger.error(`Autopilot run failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Mode 2: Analyze Business URL
opportunityRouter.post("/analyze-url", authenticate, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "Missing required 'url' string parameter." });
    }

    const opportunity = await OpportunityService.analyzeBusinessUrl(req.organizationId!, url);
    res.json({
      success: true,
      message: "Business research and opportunity analysis completed.",
      opportunity
    });
  } catch (err: any) {
    logger.error(`Analyze URL failed: ${err.message}`);
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Generate 10 Leads
opportunityRouter.post("/generate-top-10", authenticate, async (req: Request, res: Response) => {
  try {
    const result = await OpportunityService.generateTop10Leads(req.organizationId!);
    res.json({
      success: true,
      message: `Generated ${result.count} vetted leads from top opportunities into CRM.`,
      count: result.count,
      leads: result.leads
    });
  } catch (err: any) {
    logger.error(`Generate top 10 leads failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Approve opportunity & prepare for outreach
opportunityRouter.post("/:id/approve", authenticate, async (req: Request, res: Response) => {
  try {
    const { subject, email } = req.body;
    const opp = await OpportunityService.approveOpportunity(req.organizationId!, req.params.id, {
      subject,
      email
    });
    res.json({ success: true, message: "Opportunity approved and synced to CRM.", opportunity: opp });
  } catch (err: any) {
    logger.error(`Approve opportunity failed: ${err.message}`);
    res.status(400).json({ success: false, error: err.message });
  }
});

// 7. Reject opportunity
opportunityRouter.post("/:id/reject", authenticate, async (req: Request, res: Response) => {
  try {
    await OpportunityService.rejectOpportunity(req.organizationId!, req.params.id);
    res.json({ success: true, message: "Opportunity rejected." });
  } catch (err: any) {
    logger.error(`Reject opportunity failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Dispatch approved outreach via existing SDR pipeline
opportunityRouter.post("/:id/send", authenticate, async (req: Request, res: Response) => {
  try {
    const result = await OpportunityService.sendApprovedOutreach(req.organizationId!, req.params.id);
    res.json({
      success: true,
      message: "Outreach successfully sent through NexSDR SDR pipeline.",
      result
    });
  } catch (err: any) {
    logger.error(`Send outreach failed: ${err.message}`);
    res.status(400).json({ success: false, error: err.message });
  }
});
