import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { UpdateOrganizationSchema } from "@ai-sdr/shared";

export const organizationRouter = Router();
organizationRouter.use(authMiddleware);

organizationRouter.get("/", async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! }
    });
    res.json({ success: true, organization: org });
  } catch (err) {
    next(err);
  }
});

organizationRouter.put("/", validateBody(UpdateOrganizationSchema), async (req, res, next) => {
  try {
    const updated = await prisma.organization.update({
      where: { id: req.organizationId! },
      data: req.body
    });
    res.json({ success: true, organization: updated });
  } catch (err) {
    next(err);
  }
});