import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { CalendarService } from "../services/calendarService.js";
import { authMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validator.js";
import { AppointmentCreateSchema } from "@ai-sdr/shared";

export const appointmentRouter = Router();
appointmentRouter.use(authMiddleware);

appointmentRouter.get("/", async (req, res, next) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { scheduledAt: "asc" },
      include: { lead: true }
    });
    res.json({ success: true, appointments });
  } catch (err) {
    next(err);
  }
});

appointmentRouter.post("/", validateBody(AppointmentCreateSchema), async (req, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.body.leadId, organizationId: req.organizationId! }
    });
    if (!lead) {
      return res.status(404).json({ success: false, error: "Lead not found or unauthorized" });
    }

    const startTime = new Date(req.body.scheduledAt);
    const durationMinutes = req.body.durationMinutes || 30;

    const hasConflict = await CalendarService.hasConflict(req.organizationId!, startTime, durationMinutes);
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        error: "Time slot conflict. The requested slot is already booked."
      });
    }

    const appt = await prisma.appointment.create({
      data: {
        organizationId: req.organizationId!,
        leadId: req.body.leadId,
        title: req.body.title,
        scheduledAt: startTime,
        durationMinutes,
        attendeeEmail: req.body.attendeeEmail,
        notes: req.body.notes
      }
    });
    res.status(201).json({ success: true, appointment: appt });
  } catch (err) {
    next(err);
  }
});