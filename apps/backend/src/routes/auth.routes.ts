import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { RegisterSchema, LoginSchema, DEFAULT_SDR_PERSONA, DEFAULT_CADENCE_STEPS } from "@ai-sdr/shared";

export const authRouter = Router();

authRouter.post("/register", validateBody(RegisterSchema), async (req, res, next) => {
  try {
    const { name, email, password, organizationName } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          valueProposition: "Autonomous AI Sales Development Representative platform that prospects, qualifies, and books meetings 24/7.",
          targetCustomerIcp: "B2B tech companies, revenue leaders, and sales teams looking to scale qualified pipeline.",
          knowledgeBase: "NexusSDR delivers autonomous AI sales outreach, multi-channel lead qualification (BANT/MEDDIC), RFC 5545 calendar booking, and consultative objection handling.",
          objectionRules: "Acknowledge the prospect's current provider respectfully, inquire about what they like and wish could be improved, and highlight verified NexusSDR automation capabilities without attacking competitors."
        }
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "OWNER",
          organizationId: org.id
        }
      });

      await tx.sdrProfile.create({
        data: {
          organizationId: org.id,
          ...DEFAULT_SDR_PERSONA
        }
      });

      await tx.subscription.create({
        data: {
          organizationId: org.id,
          tier: "FREE",
          status: "ACTIVE"
        }
      });

      for (const step of DEFAULT_CADENCE_STEPS) {
        await tx.followUpRule.create({
          data: {
            organizationId: org.id,
            stepNumber: step.stepNumber,
            channel: step.channel,
            delayDays: step.delayDays,
            condition: step.condition
          }
        });
      }

      return { user, org };
    });

    const token = signToken({
      userId: result.user.id,
      email: result.user.email,
      organizationId: result.org.id,
      role: result.user.role
    });

    res.status(201).json({
      success: true,
      token,
      user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
      organization: result.org
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", validateBody(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role
    });

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: user.organization
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { organization: true }
    });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: user.organization
    });
  } catch (err) {
    next(err);
  }
});