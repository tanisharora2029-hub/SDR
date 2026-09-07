import { Router } from "express";
import { AnalyticsService } from "../services/analyticsService.js";
import { authMiddleware } from "../middleware/auth.js";

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

analyticsRouter.get("/overview", async (req, res, next) => {
  try {
    const overview = await AnalyticsService.getOverview(req.organizationId!);
    res.json({ success: true, overview });
  } catch (err) {
    next(err);
  }
});