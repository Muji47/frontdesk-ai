import { randomBytes } from "node:crypto";
import { db, withTransaction } from "@/lib/db";
import { dashboardEventBus } from "@/lib/events";

export interface BookingParsedIntent {
  isBookingIntent: boolean;
  hasTimeSlot: boolean;
  patientName?: string;
  patientContact?: string;
  practitionerName: string;
  serviceName: string;
  targetTime?: Date;
  formattedSlot?: string;
}

export interface SlotAvailabilityResult {
  isAvailable: boolean;
  conflictingAppointment?: {
    id: string;
    patientName: string;
    startTime: string;
  };
}

export interface AlternativeSlot {
  time: Date;
  isoString: string;
  label: string;
  chip: string;
}

export class AppointmentService {
  /**
   * Helper to format a slot date like "Friday, Nov 13"
   */
  public static formatSlotDay(date: Date): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  }

  /**
   * Helper to format time like "3:00 PM"
   */
  public static formatSlotTime(date: Date): string {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minStr} ${ampm}`;
  }

  /**
   * Parses booking intent and extracts key entities (patient, contact, doctor, service, time)
   * from the current message and past conversation messages.
   */
  public static parseBookingIntentAndEntities(
    currentMessage: string,
    history: Array<{ sender: string; content: string }> = [],
    fallbackVisitorName?: string,
    fallbackVisitorContact?: string
  ): BookingParsedIntent {
    const combinedText = [...history.map((h) => h.content), currentMessage].join(" ");
    const currentLower = currentMessage.toLowerCase();
    const combinedLower = combinedText.toLowerCase();

    // 1. Booking intent keywords
    const isBookingIntent =
      /\b(book|appointment|booking|schedule|reserve|slot|see doctor|see a doctor|consultation|physio|visit|available times?|check in)\b/i.test(
        combinedLower
      ) ||
      /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon)\b/i.test(currentLower);

    // 2. Extract Phone Number
    const phoneMatch = combinedText.match(
      /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/
    );
    let patientContact: string | undefined = phoneMatch ? phoneMatch[0].trim() : undefined;

    // 3. Extract Email if no phone
    if (!patientContact) {
      const emailMatch = combinedText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      if (emailMatch) patientContact = emailMatch[0].trim();
    }

    if (!patientContact && fallbackVisitorContact && !fallbackVisitorContact.startsWith("visitor_")) {
      patientContact = fallbackVisitorContact;
    }

    // 4. Extract Patient Name
    let patientName: string | undefined;
    if (fallbackVisitorName && fallbackVisitorName !== "Website Visitor" && !fallbackVisitorName.startsWith("Visitor #")) {
      patientName = fallbackVisitorName;
    } else {
      const nameIntroMatch = combinedText.match(
        /\b(?:my name is|name is|i am|this is|name:|patient:)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/i
      );
      const forNameMatch = combinedText.match(/\bfor\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/);
      const startsWithNameMatch = currentMessage.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[,\s]/);

      if (nameIntroMatch) {
        patientName = nameIntroMatch[1].replace(/^(?:is|a|the)\s+/i, "").trim();
      } else if (forNameMatch) {
        patientName = forNameMatch[1].trim();
      } else if (startsWithNameMatch) {
        patientName = startsWithNameMatch[1].trim();
      }
    }

    // 5. Extract Practitioner
    let practitionerName = "Dr. Sarah Lee";
    if (/\b(?:dr\.?\s+)?michael\s+chen\b/i.test(combinedText)) {
      practitionerName = "Dr. Michael Chen";
    } else if (/\b(?:dr\.?\s+)?alex(?:\s+taylor)?\b/i.test(combinedText)) {
      practitionerName = "Dr. Alex Taylor";
    } else if (/\b(?:dr\.?\s+)?sarah(?:\s+lee)?\b/i.test(combinedText)) {
      practitionerName = "Dr. Sarah Lee";
    }

    // 6. Extract Service
    let serviceName = "Initial Physiotherapy Consultation";
    if (/sports\s+injury/i.test(combinedText)) {
      serviceName = "Sports Injury Assessment";
    } else if (/dry\s+needling/i.test(combinedText)) {
      serviceName = "Dry Needling & Myofascial Release";
    } else if (/follow[\s-]?up/i.test(combinedText)) {
      serviceName = "Standard Follow-Up Consultation";
    } else if (/telehealth/i.test(combinedText)) {
      serviceName = "Telehealth Video Consultation";
    } else if (/back\s+pain|neck\s+pain|physio/i.test(combinedText)) {
      serviceName = "Musculoskeletal Assessment";
    }

    // 7. Extract Target Date & Time Slot
    const { hasTimeSlot, targetTime } = this.parseTargetDateTime(currentMessage, combinedText);

    return {
      isBookingIntent,
      hasTimeSlot,
      patientName,
      patientContact,
      practitionerName,
      serviceName,
      targetTime,
      formattedSlot: targetTime ? `${this.formatSlotDay(targetTime)} at ${this.formatSlotTime(targetTime)}` : undefined,
    };
  }

  /**
   * Parses concrete target date and time from natural phrases
   */
  private static parseTargetDateTime(
    currentMessage: string,
    combinedText: string
  ): { hasTimeSlot: boolean; targetTime?: Date } {
    const text = currentMessage;
    const lower = text.toLowerCase();
    const combinedLower = combinedText.toLowerCase();

    const daysMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    let targetDayIndex = -1;
    for (const [dayName, dayIndex] of Object.entries(daysMap)) {
      if (lower.includes(dayName)) {
        targetDayIndex = dayIndex;
        break;
      }
    }

    // If day was not in current message, look back in combined text
    if (targetDayIndex === -1) {
      for (const [dayName, dayIndex] of Object.entries(daysMap)) {
        if (combinedLower.includes(dayName)) {
          targetDayIndex = dayIndex;
          break;
        }
      }
    }

    let hour = -1;
    let minute = 0;
    let foundTime = false;

    // Check 12-hour match: 3pm, 3:00pm, 2:15 pm, 10am
    const time12Match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    // Check 24-hour match: 14:00, 15:30
    const time24Match = lower.match(/\b(\d{1,2}):(\d{2})\b/);
    // Check "at 3"
    const atHourMatch = lower.match(/\bat\s+(\d{1,2})\b/);

    if (time12Match) {
      let h = parseInt(time12Match[1], 10);
      const m = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
      const isPm = time12Match[3] === "pm";
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      hour = h;
      minute = m;
      foundTime = true;
    } else if (time24Match) {
      hour = parseInt(time24Match[1], 10);
      minute = parseInt(time24Match[2], 10);
      foundTime = true;
    } else if (atHourMatch) {
      let h = parseInt(atHourMatch[1], 10);
      if (h < 8) h += 12; // Assume PM if at 2, at 3, at 4
      hour = h;
      minute = 0;
      foundTime = true;
    } else if (lower.includes("morning")) {
      hour = 10;
      minute = 0;
      foundTime = true;
    } else if (lower.includes("afternoon")) {
      hour = 14;
      minute = 0;
      foundTime = true;
    } else if (lower.includes("evening")) {
      hour = 17;
      minute = 0;
      foundTime = true;
    }

    if (!foundTime && targetDayIndex === -1) {
      return { hasTimeSlot: false };
    }

    // Default to 15:00 if day is known but hour wasn't specified
    if (!foundTime) {
      hour = 15;
      minute = 0;
    }

    const date = new Date();
    if (lower.includes("tomorrow") || combinedLower.includes("tomorrow")) {
      date.setDate(date.getDate() + 1);
    } else if (targetDayIndex !== -1) {
      const currentDay = date.getDay();
      let distance = targetDayIndex - currentDay;
      if (distance <= 0) distance += 7;
      date.setDate(date.getDate() + distance);
    } else {
      date.setDate(date.getDate() + 2);
    }

    date.setHours(hour, minute, 0, 0);
    return { hasTimeSlot: true, targetTime: date };
  }

  /**
   * Conflict Detection: checks if an overlapping active appointment already exists in SQLite
   */
  public static checkSlotAvailability(
    orgId: string,
    practitionerName: string,
    targetTime: Date,
    durationMinutes = 45
  ): SlotAvailabilityResult {
    const targetMs = targetTime.getTime();
    // Allow window check: any appointment within durationMinutes is an overlap conflict
    const startWindow = new Date(targetMs - durationMinutes * 60 * 1000).toISOString();
    const endWindow = new Date(targetMs + durationMinutes * 60 * 1000).toISOString();

    const existing = db.prepare(`
      SELECT id, patient_name, start_time FROM appointments
      WHERE organization_id = ?
        AND practitioner_name = ?
        AND status != 'cancelled'
        AND start_time > ?
        AND start_time < ?
      LIMIT 1
    `).get(orgId, practitionerName, startWindow, endWindow) as any;

    if (existing) {
      return {
        isAvailable: false,
        conflictingAppointment: {
          id: existing.id,
          patientName: existing.patient_name,
          startTime: existing.start_time,
        },
      };
    }

    return { isAvailable: true };
  }

  /**
   * Computes up to 3 verified available alternative slots when requested slot is busy
   */
  public static findAlternativeSlots(
    orgId: string,
    practitionerName: string,
    requestedTime: Date,
    durationMinutes = 45
  ): AlternativeSlot[] {
    const alternatives: AlternativeSlot[] = [];
    const reqMs = requestedTime.getTime();

    // 1. 60 minutes earlier (if >= 9:00 AM)
    const earlier = new Date(reqMs - 60 * 60 * 1000);
    if (earlier.getHours() >= 9) {
      const check = this.checkSlotAvailability(orgId, practitionerName, earlier, durationMinutes);
      if (check.isAvailable) {
        alternatives.push({
          time: earlier,
          isoString: earlier.toISOString(),
          label: `${this.formatSlotDay(earlier)} at ${this.formatSlotTime(earlier)}`,
          chip: `${this.formatSlotDay(earlier)} ${this.formatSlotTime(earlier)}`,
        });
      }
    }

    // 2. 60 minutes later (if <= 5:00 PM)
    const later = new Date(reqMs + 60 * 60 * 1000);
    if (later.getHours() <= 17) {
      const check = this.checkSlotAvailability(orgId, practitionerName, later, durationMinutes);
      if (check.isAvailable) {
        alternatives.push({
          time: later,
          isoString: later.toISOString(),
          label: `${this.formatSlotDay(later)} at ${this.formatSlotTime(later)}`,
          chip: `${this.formatSlotDay(later)} ${this.formatSlotTime(later)}`,
        });
      }
    }

    // 3. 120 minutes later (if <= 5:00 PM)
    const later2 = new Date(reqMs + 120 * 60 * 1000);
    if (later2.getHours() <= 17) {
      const check = this.checkSlotAvailability(orgId, practitionerName, later2, durationMinutes);
      if (check.isAvailable) {
        alternatives.push({
          time: later2,
          isoString: later2.toISOString(),
          label: `${this.formatSlotDay(later2)} at ${this.formatSlotTime(later2)}`,
          chip: `${this.formatSlotDay(later2)} ${this.formatSlotTime(later2)}`,
        });
      }
    }

    // 4. If fewer than 3, try next business day at 10:00 AM or 2:00 PM
    let nextDayOffset = 1;
    while (alternatives.length < 3 && nextDayOffset <= 5) {
      const nextDay = new Date(reqMs + nextDayOffset * 24 * 60 * 60 * 1000);
      if (nextDay.getDay() !== 0 && nextDay.getDay() !== 6) {
        nextDay.setHours(10, 0, 0, 0);
        let check = this.checkSlotAvailability(orgId, practitionerName, nextDay, durationMinutes);
        if (check.isAvailable && !alternatives.some((a) => a.time.getTime() === nextDay.getTime())) {
          alternatives.push({
            time: nextDay,
            isoString: nextDay.toISOString(),
            label: `${this.formatSlotDay(nextDay)} at 10:00 AM`,
            chip: `${this.formatSlotDay(nextDay)} 10:00 AM`,
          });
        }

        if (alternatives.length < 3) {
          const nextDayAft = new Date(nextDay);
          nextDayAft.setHours(14, 0, 0, 0);
          check = this.checkSlotAvailability(orgId, practitionerName, nextDayAft, durationMinutes);
          if (check.isAvailable && !alternatives.some((a) => a.time.getTime() === nextDayAft.getTime())) {
            alternatives.push({
              time: nextDayAft,
              isoString: nextDayAft.toISOString(),
              label: `${this.formatSlotDay(nextDayAft)} at 2:00 PM`,
              chip: `${this.formatSlotDay(nextDayAft)} 2:00 PM`,
            });
          }
        }
      }
      nextDayOffset++;
    }

    return alternatives.slice(0, 3);
  }

  /**
   * Confirms and atomically writes the appointment and lead records into SQLite,
   * then broadcasts a real-time SSE event to the dashboard.
   */
  public static bookAppointment(params: {
    orgId: string;
    conversationId: string;
    patientName: string;
    patientContact: string;
    practitionerName: string;
    serviceName: string;
    startTime: Date;
  }) {
    const aptId = "apt_" + randomBytes(6).toString("hex");
    const extRef = "APT-" + new Date().getFullYear() + "-" + randomBytes(2).toString("hex").toUpperCase();
    const startTimeIso = params.startTime.toISOString();
    const nowIso = new Date().toISOString();

    withTransaction(() => {
      // 1. Insert into appointments
      db.prepare(`
        INSERT INTO appointments (
          id, organization_id, conversation_id, patient_name, patient_contact,
          practitioner_name, service_name, start_time, status, source, external_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'ai_booked', ?, ?)
      `).run(
        aptId,
        params.orgId,
        params.conversationId,
        params.patientName,
        params.patientContact,
        params.practitionerName,
        params.serviceName,
        startTimeIso,
        extRef,
        nowIso
      );

      // 2. Check if a lead already exists for this conversation; update or insert
      const existingLead = db.prepare(`
        SELECT id FROM leads WHERE organization_id = ? AND conversation_id = ? LIMIT 1
      `).get(params.orgId, params.conversationId) as any;

      const isEmail = params.patientContact.includes("@");

      if (existingLead) {
        db.prepare(`
          UPDATE leads
          SET name = ?, email = COALESCE(?, email), phone = COALESCE(?, phone), status = 'converted'
          WHERE id = ?
        `).run(
          params.patientName,
          isEmail ? params.patientContact : null,
          !isEmail ? params.patientContact : null,
          existingLead.id
        );
      } else {
        const leadId = "lead_" + randomBytes(6).toString("hex");
        db.prepare(`
          INSERT INTO leads (
            id, organization_id, conversation_id, name, email, phone, intent, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'booking', 'converted', ?)
        `).run(
          leadId,
          params.orgId,
          params.conversationId,
          params.patientName,
          isEmail ? params.patientContact : null,
          !isEmail ? params.patientContact : null,
          nowIso
        );
      }
    });

    const appointmentObj = {
      id: aptId,
      patientName: params.patientName,
      patientContact: params.patientContact,
      practitionerName: params.practitionerName,
      serviceName: params.serviceName,
      startTime: startTimeIso,
      status: "confirmed",
      source: "ai_booked",
      externalId: extRef,
    };

    const leadObj = {
      id: "lead_" + aptId.slice(4),
      name: params.patientName,
      email: params.patientContact.includes("@") ? params.patientContact : null,
      phone: !params.patientContact.includes("@") ? params.patientContact : null,
      intent: "booking",
      status: "converted",
      createdAt: nowIso,
    };

    // Emit live SSE event
    dashboardEventBus.emitToOrg(params.orgId, {
      type: "new_appointment",
      title: "New Appointment Booked 📅",
      message: `${params.patientName} — ${params.serviceName} with ${params.practitionerName} (${this.formatSlotDay(params.startTime)} at ${this.formatSlotTime(params.startTime)})`,
      icon: "📅",
      targetTab: "appointments",
      targetId: aptId,
      data: {
        appointment: appointmentObj,
        lead: leadObj,
      },
    });

    return {
      appointment: appointmentObj,
      lead: leadObj,
      externalRef: extRef,
    };
  }

  /**
   * Records an inbound warm inquiry lead when a patient requests a booking but encounters
   * a conflict or hasn't finished selecting a time.
   */
  public static recordInquiryLead(params: {
    orgId: string;
    conversationId: string;
    patientName: string;
    patientContact: string;
    note?: string;
  }) {
    const isEmail = params.patientContact.includes("@");
    const nowIso = new Date().toISOString();

    const existingLead = db.prepare(`
      SELECT id FROM leads WHERE organization_id = ? AND conversation_id = ? LIMIT 1
    `).get(params.orgId, params.conversationId) as any;

    if (existingLead) {
      db.prepare(`
        UPDATE leads
        SET name = ?, email = COALESCE(?, email), phone = COALESCE(?, phone)
        WHERE id = ?
      `).run(
        params.patientName,
        isEmail ? params.patientContact : null,
        !isEmail ? params.patientContact : null,
        existingLead.id
      );
      return;
    }

    const leadId = "lead_" + randomBytes(6).toString("hex");
    db.prepare(`
      INSERT INTO leads (
        id, organization_id, conversation_id, name, email, phone, intent, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'booking', 'new', ?)
    `).run(
      leadId,
      params.orgId,
      params.conversationId,
      params.patientName,
      isEmail ? params.patientContact : null,
      !isEmail ? params.patientContact : null,
      nowIso
    );

    const createdLead = {
      id: leadId,
      name: params.patientName,
      email: isEmail ? params.patientContact : null,
      phone: !isEmail ? params.patientContact : null,
      intent: "booking",
      status: "new",
      createdAt: nowIso,
    };

    dashboardEventBus.emitToOrg(params.orgId, {
      type: "new_lead",
      title: "New Inbound Lead 🎯",
      message: `${params.patientName} (${params.patientContact}) — Inquiry for appointment`,
      icon: "🎯",
      targetTab: "leads",
      targetId: leadId,
      data: { lead: createdLead },
    });
  }
}
