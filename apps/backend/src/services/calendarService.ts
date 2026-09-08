import { createEvent, EventAttributes } from "ics";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export interface CreateEventParams {
  organizationId: string;
  leadId: string;
  title: string;
  description?: string;
  startTime: Date;
  durationMinutes: number;
  attendeeEmail: string;
  attendeeName?: string;
  organizerName?: string;
  organizerEmail?: string;
}

export interface ParsedMeetingRequest {
  hasMeetingIntent: boolean;
  missing: "none" | "date" | "time" | "both";
  date: Date | null;
  formattedDate: string | null;
  formattedTime: string | null;
  timezone: string | null;
  rawRequestedText: string;
}

export class CalendarService {
  /**
   * Check if a specific time slot has conflicts with existing appointments
   */
  static async hasConflict(
    organizationId: string,
    startTime: Date,
    durationMinutes: number,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    const newStart = startTime.getTime();
    const newEnd = newStart + durationMinutes * 60000;

    // Retrieve appointments within a 24-hour window to inspect exact intervals
    const candidates = await prisma.appointment.findMany({
      where: {
        organizationId,
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        scheduledAt: {
          gte: new Date(newStart - 24 * 3600000),
          lte: new Date(newEnd + 24 * 3600000)
        }
      }
    });

    for (const appt of candidates) {
      const apptStart = new Date(appt.scheduledAt).getTime();
      const apptEnd = apptStart + (appt.durationMinutes || 30) * 60000;
      // Exact interval overlap check: A_start < B_end && A_end > B_start
      if (apptStart < newEnd && apptEnd > newStart) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check slot availability and propose alternatives if conflicting
   */
  static async checkAvailability(
    organizationId: string,
    startTime: Date,
    durationMinutes: number = 30
  ): Promise<{ available: boolean; suggestedAlternatives: Date[] }> {
    const conflict = await this.hasConflict(organizationId, startTime, durationMinutes);
    if (!conflict) {
      return { available: true, suggestedAlternatives: [] };
    }

    const alternatives: Date[] = [];
    const candidateOffsets = [60, 120, 1440, 1500]; // +1h, +2h, +24h, +25h in minutes

    for (const offset of candidateOffsets) {
      const candidateDate = new Date(startTime.getTime() + offset * 60000);
      const isConflicting = await this.hasConflict(organizationId, candidateDate, durationMinutes);
      if (!isConflicting) {
        alternatives.push(candidateDate);
        if (alternatives.length >= 2) break;
      }
    }

    return { available: false, suggestedAlternatives: alternatives };
  }

  /**
   * Generate an RFC 5545 compliant .ics string for the appointment
   */
  static generateIcsString(params: {
    title: string;
    description?: string;
    startTime: Date;
    durationMinutes: number;
    attendeeEmail: string;
    attendeeName?: string;
    organizerName?: string;
    organizerEmail?: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const d = params.startTime;
      const startArray: [number, number, number, number, number] = [
        d.getFullYear(),
        d.getMonth() + 1,
        d.getDate(),
        d.getHours(),
        d.getMinutes()
      ];

      const eventAttrs: EventAttributes = {
        start: startArray,
        duration: { minutes: params.durationMinutes },
        title: params.title,
        description: params.description || "Introductory discovery and demo call scheduled by AI SDR",
        status: "CONFIRMED",
        busyStatus: "BUSY",
        organizer: {
          name: params.organizerName || "AI SDR Representative",
          email: params.organizerEmail || "sdr@company.com"
        },
        attendees: [
          {
            name: params.attendeeName || params.attendeeEmail,
            email: params.attendeeEmail,
            rsvp: true
          }
        ]
      };

      createEvent(eventAttrs, (err, val) => {
        if (err) {
          logger.error("Failed to generate ICS file content", err);
          return reject(err);
        }
        resolve(val);
      });
    });
  }

  /**
   * Schedule appointment in DB and produce .ics calendar invite
   */
  static async scheduleAppointment(params: CreateEventParams) {
    // Check double-booking conflict
    const conflict = await this.hasConflict(params.organizationId, params.startTime, params.durationMinutes);
    if (conflict) {
      throw new Error(`Time slot conflict at ${params.startTime.toISOString()}. Please choose an alternate slot.`);
    }

    const icsContent = await this.generateIcsString({
      title: params.title,
      description: params.description,
      startTime: params.startTime,
      durationMinutes: params.durationMinutes,
      attendeeEmail: params.attendeeEmail,
      attendeeName: params.attendeeName,
      organizerName: params.organizerName,
      organizerEmail: params.organizerEmail
    });

    const appointment = await prisma.appointment.create({
      data: {
        organizationId: params.organizationId,
        leadId: params.leadId,
        title: params.title,
        scheduledAt: params.startTime,
        durationMinutes: params.durationMinutes,
        attendeeEmail: params.attendeeEmail,
        notes: params.description || "Booked by AI SDR"
      }
    });

    return {
      appointment,
      icsContent
    };
  }

  /**
   * Intelligent natural language date/time parser for prospect meeting requests
   */
  static parseMeetingDateTime(text: string, referenceDate: Date = new Date()): ParsedMeetingRequest {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // False positive filters: words like "meet" used as satisfying a requirement, or past demos, or busy schedules
    const isFalsePositive =
      /\b(?:does it|to|will it|can it)\s+meet\b/i.test(lower) ||
      /\bmeet\s+(?:our|the|your|compliance|requirements|criteria|needs|standards|goals)\b/i.test(lower) ||
      /\b(?:saw|watched|tried|received|seen)\s+(?:a|the)\s+demo\b/i.test(lower) ||
      /\bdemo\s+(?:video|link|account|environment|recording)\b/i.test(lower) ||
      /\b(?:in\s+a\s+meeting|before\s+my\s+meeting|after\s+(?:the|my)\s+meeting)\b/i.test(lower) ||
      /\b(?:too busy|not right now|next quarter|later|not ready|don'?t call|no time)\b/i.test(lower);

    // Explicit scheduling agreement patterns
    const explicitAgreement =
      /(?:let'?s\s+(?:schedule|book|meet|set up)|book\s+(?:me|a|an)|schedule\s+(?:me|a|an)|set\s+up\s+a\s+(?:call|demo|meeting)|can\s+we\s+(?:schedule|book|meet)|happy\s+to\s+(?:meet|hop on a call|do a demo)|available\s+to\s+meet|let'?s\s+do\s+(?:tomorrow|\w+day)|works\s+for\s+me|works\s+best\s+for\s+me)/i.test(lower) ||
      (/(?:yes|sure|sounds good|definitely|let'?s do it)[,\s]+.*(?:tomorrow|next\s+week|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/i.test(lower) && /\b(?:schedule|book|meet|call|demo)\b/i.test(lower));

    const hasMeetingIntent = !isFalsePositive && explicitAgreement;

    if (!hasMeetingIntent) {
      return {
        hasMeetingIntent: false,
        missing: "both",
        date: null,
        formattedDate: null,
        formattedTime: null,
        timezone: null,
        rawRequestedText: raw
      };
    }

    // 1. Time extraction
    // Matches "3 PM", "3:30 PM", "15:00", "2 pm", "10am"
    const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
    const timeMatch = raw.match(timeRegex);

    let extractedHours: number | null = null;
    let extractedMinutes: number | null = null;
    let rawTimePhrase: string | null = null;

    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3].toLowerCase();

      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;

      extractedHours = hours;
      extractedMinutes = minutes;
      rawTimePhrase = timeMatch[0];
    } else {
      // 24h format fallback: "at 15:00"
      const h24Match = raw.match(/\bat\s+([01]?\d|2[0-3]):([0-5]\d)\b/i);
      if (h24Match) {
        extractedHours = parseInt(h24Match[1], 10);
        extractedMinutes = parseInt(h24Match[2], 10);
        rawTimePhrase = h24Match[0];
      } else if (/\bafternoon\b/i.test(raw)) {
        extractedHours = 14;
        extractedMinutes = 0;
        rawTimePhrase = "2:00 PM";
      } else if (/\bmorning\b/i.test(raw)) {
        extractedHours = 10;
        extractedMinutes = 0;
        rawTimePhrase = "10:00 AM";
      } else if (/\bevening\b/i.test(raw)) {
        extractedHours = 17;
        extractedMinutes = 0;
        rawTimePhrase = "5:00 PM";
      }
    }

    // 2. Timezone extraction
    const tzMatch = raw.match(/\b(EST|EDT|PST|PDT|CST|CDT|IST|UTC|GMT)\b/i);
    const timezone = tzMatch ? tzMatch[1].toUpperCase() : null;

    // 3. Date extraction
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let targetDate: Date | null = null;
    let rawDatePhrase: string | null = null;

    // ISO timestamp match
    const isoMatch = raw.match(/\b\d{4}-\d{2}-\d{2}(?:T|\s)\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?\b/);
    if (isoMatch) {
      const parsedIso = new Date(isoMatch[0]);
      if (!isNaN(parsedIso.getTime())) {
        return {
          hasMeetingIntent: true,
          missing: "none",
          date: parsedIso,
          formattedDate: parsedIso.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
          formattedTime: parsedIso.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          timezone,
          rawRequestedText: raw
        };
      }
    }

    // Relative day patterns
    if (/\btomorrow\b/i.test(raw)) {
      targetDate = new Date(referenceDate);
      targetDate.setDate(targetDate.getDate() + 1);
      rawDatePhrase = "tomorrow";
    } else if (/\btoday\b/i.test(raw)) {
      targetDate = new Date(referenceDate);
      rawDatePhrase = "today";
    } else {
      // Weekday matching: "next Tuesday", "this Thursday", "Tuesday"
      for (let i = 0; i < weekdays.length; i++) {
        const dayName = weekdays[i];
        const dayRegex = new RegExp(`\\b(next\\s+|this\\s+)?${dayName}\\b`, "i");
        const match = raw.match(dayRegex);
        if (match) {
          rawDatePhrase = match[0];
          const isNext = match[1] && match[1].toLowerCase().includes("next");
          const currentDayOfWeek = referenceDate.getDay();
          let daysToAdd = (i - currentDayOfWeek + 7) % 7;
          if (daysToAdd === 0 || isNext) {
            daysToAdd += 7;
          }
          targetDate = new Date(referenceDate);
          targetDate.setDate(targetDate.getDate() + daysToAdd);
          break;
        }
      }
    }

    const hasTime = extractedHours !== null;
    const hasDate = targetDate !== null;

    if (hasDate && hasTime) {
      targetDate!.setHours(extractedHours!, extractedMinutes || 0, 0, 0);

      // Handle timezone offset if provided
      if (timezone) {
        // e.g. EST is UTC-5, PST is UTC-8, IST is UTC+5:30
      }

      return {
        hasMeetingIntent: true,
        missing: "none",
        date: targetDate,
        formattedDate: targetDate!.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        formattedTime: targetDate!.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        timezone,
        rawRequestedText: raw
      };
    }

    if (hasTime && !hasDate) {
      return {
        hasMeetingIntent: true,
        missing: "date",
        date: null,
        formattedDate: null,
        formattedTime: rawTimePhrase,
        timezone,
        rawRequestedText: raw
      };
    }

    if (hasDate && !hasTime) {
      return {
        hasMeetingIntent: true,
        missing: "time",
        date: targetDate,
        formattedDate: rawDatePhrase,
        formattedTime: null,
        timezone,
        rawRequestedText: raw
      };
    }

    return {
      hasMeetingIntent,
      missing: "both",
      date: null,
      formattedDate: null,
      formattedTime: null,
      timezone,
      rawRequestedText: raw
    };
  }
}