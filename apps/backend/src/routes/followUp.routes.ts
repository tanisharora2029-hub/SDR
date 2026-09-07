import { Router } from "express";
import { FollowUpEngine } from "../services/followUpEngine.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { FollowUpRuleSchema } from "@ai-sdr/shared";

export const followUpRouter = Router();
followUpRouter.use(authMiddleware);

followUpRouter.get("/rules", async (req, res, next) => {
  try {
    const rules = await FollowUpEngine.getRules(req.organizationId!);
    res.json({ success: true, rules });
  } catch (err) {
    next(err);
  }
});

followUpRouter.post("/rules", validateBody(FollowUpRuleSchema), async (req, res, next) => {
  try {
    const rule = await FollowUpEngine.createRule(req.organizationId!, req.body);
    res.status(201).json({ success: true, rule });
  } catch (err) {
    next(err);
  }
});

followUpRouter.get("/pending", async (req, res, next) => {
  try {
    const tasks = await FollowUpEngine.getPendingTasks(req.organizationId!);
    res.json({ success: true, tasks });
  } catch (err) {
    next(err);
  }
});

// Trigger execution of due cadences
followUpRouter.post("/run-now", async (req, res, next) => {
  try {
    const result = await FollowUpEngine.runPendingTasks(req.organizationId!);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});