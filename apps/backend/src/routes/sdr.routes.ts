import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { UpdateSdrProfileSchema } from "@ai-sdr/shared";

export const sdrRouter = Router();
sdrRouter.use(authMiddleware);

sdrRouter.get("/", async (req, res, next) => {
  try {
    let sdr = await prisma.sdrProfile.findFirst({
      where: { organizationId: req.organizationId! }
    });
    if (!sdr) {
      sdr = await prisma.sdrProfile.create({
        data: { organizationId: req.organizationId! }
      });
    }
    res.json({ success: true, sdrProfile: sdr });
  } catch (err) {
    next(err);
  }
});

sdrRouter.put("/", validateBody(UpdateSdrProfileSchema), async (req, res, next) => {
  try {
    const sdr = await prisma.sdrProfile.findFirst({
      where: { organizationId: req.organizationId! }
    });
    if (!sdr) return res.status(404).json({ success: false, error: "SDR Profile not found" });

    const updated = await prisma.sdrProfile.update({
      where: { id: sdr.id },
      data: req.body
    });
    res.json({ success: true, sdrProfile: updated });
  } catch (err) {
    next(err);
  }
});