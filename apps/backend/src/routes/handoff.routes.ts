import { Router } from "express";
import { HandoffService } from "../services/handoffService.js";
import { authMiddleware } from "../middleware/auth.js";

export const handoffRouter = Router();
handoffRouter.use(authMiddleware);

handoffRouter.get("/", async (req, res, next) => {
  try {
    const escalations = await HandoffService.getEscalations(req.organizationId!);
    res.json({ success: true, escalations });
  } catch (err) {
    next(err);
  }
});

handoffRouter.get("/:leadId/dossier", async (req, res, next) => {
  try {
    const dossier = await HandoffService.getLeadDossier(req.organizationId!, req.params.leadId);
    res.json({ success: true, dossier });
  } catch (err) {
    next(err);
  }
});

handoffRouter.post("/:leadId/resolve", async (req, res, next) => {
  try {
    const { resolution } = req.body;
    if (!resolution) return res.status(400).json({ success: false, error: "resolution is required" });

    const result = await HandoffService.resolveEscalation(req.organizationId!, req.params.leadId, resolution);
    res.json(result);
  } catch (err) {
    next(err);
  }
});