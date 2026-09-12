import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { LeadService } from "../services/leadService.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { CreateLeadSchema, UpdateLeadSchema } from "@ai-sdr/shared";

export const leadRouter = Router();
leadRouter.use(authMiddleware);

leadRouter.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const leads = await LeadService.getLeads(req.organizationId!, status);
    res.json({ success: true, leads });
  } catch (err) {
    next(err);
  }
});

leadRouter.get("/:id", async (req, res, next) => {
  try {
    const lead = await LeadService.getLeadById(req.organizationId!, req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: "Lead not found" });
    res.json({ success: true, lead });
  } catch (err) {
    next(err);
  }
});

leadRouter.post("/", validateBody(CreateLeadSchema), async (req, res, next) => {
  try {
    const lead = await LeadService.createLead(req.organizationId!, req.body);
    res.status(201).json({ success: true, lead });
  } catch (err) {
    next(err);
  }
});

leadRouter.post("/import-csv", async (req, res, next) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ success: false, error: "Expected an array of leads" });
    }
    const result = await LeadService.importLeadsCsv(req.organizationId!, leads);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

leadRouter.post("/:id/outreach", async (req, res, next) => {
  try {
    const result = await LeadService.triggerAiOutreach(req.organizationId!, req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

leadRouter.put("/:id", validateBody(UpdateLeadSchema), async (req, res, next) => {
  try {
    const existing = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! }
    });
    if (!existing) return res.status(404).json({ success: false, error: "Lead not found" });

    const updateData = { ...req.body };
    delete updateData.organizationId;
    delete updateData.id;
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json({ success: true, lead: updated });
  } catch (err) {
    next(err);
  }
});

leadRouter.delete("/:id", async (req, res, next) => {
  try {
    const result = await LeadService.deleteLead(req.organizationId!, req.params.id);
    res.json(result);
  } catch (err: any) {
    if (err.message && err.message.includes("not found")) {
      return res.status(404).json({ success: false, error: err.message });
    }
    next(err);
  }
});