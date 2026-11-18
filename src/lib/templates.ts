import { db } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { ValidationError, NotFoundError } from "@/server/errors";

export interface UserMessageTemplate {
  id: string;
  user_id: string;
  title: string;
  command: string;
  content: string;
  category: string;
  is_predefined: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Generates initial predefined templates tailored for the user and their organization.
 */
export function seedUserPredefinedTemplates(userId: string): UserMessageTemplate[] {
  const userRow = db
    .prepare(`
      SELECT u.id, u.name, u.role, o.name AS org_name, o.industry
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = ?
    `)
    .get(userId) as {
      id: string;
      name: string;
      role: string;
      org_name: string | null;
      industry: string | null;
    } | undefined;

  const staffName = userRow?.name || "Front Desk";
  const orgName = userRow?.org_name || "Our Practice";
  const industry = userRow?.industry || "clinic";

  let defaultTemplates: Array<{ title: string; command: string; content: string; category: string }> = [];

  if (industry === "ecommerce") {
    defaultTemplates = [
      {
        title: "Personal Welcome & Greeting",
        command: "/greeting",
        content: `Hi there! I'm ${staffName} with ${orgName} Customer Care. How can I help you with your order or inquiry today?`,
        category: "Greeting",
      },
      {
        title: "Track Package Delivery",
        command: "/track",
        content: "Your order is currently in transit with express carrier tracking. Delivery is on schedule for tomorrow before 4:00 PM.",
        category: "Shipping",
      },
      {
        title: "Returns & Exchanges",
        command: "/return",
        content: "We provide 30-day hassle-free returns on all eligible items. Would you like me to generate a prepaid return postage label?",
        category: "Returns",
      },
      {
        title: "Shipping Rates & Times",
        command: "/shipping",
        content: "Standard delivery takes 3-5 business days ($8.95), and priority express takes 1-2 business days ($14.95). Free standard shipping on orders over $100.",
        category: "Shipping",
      },
      {
        title: "Customer Support Hours",
        command: "/hours",
        content: "Our customer success desk is available Monday through Friday 9:00 AM – 5:00 PM AEST.",
        category: "General",
      },
      {
        title: "Supervisor Escalation",
        command: "/escalate",
        content: "I have escalated your inquiry to our senior resolution team. A team lead will review your order history and reply within 1 hour.",
        category: "Support",
      },
    ];
  } else if (industry === "realestate") {
    defaultTemplates = [
      {
        title: "Personal Welcome & Greeting",
        command: "/greeting",
        content: `Hello! I'm ${staffName} from ${orgName}. How can I assist you with your property search or viewing schedule today?`,
        category: "Greeting",
      },
      {
        title: "Property Open Inspection",
        command: "/viewing",
        content: "Open inspection is scheduled for Thursday at 5:30 PM and Saturday at 11:00 AM. May I register your full name and contact number for entry?",
        category: "Inspection",
      },
      {
        title: "Rental & Lease Terms",
        command: "/rent",
        content: "The lease rate is $650 per week with a 4-week bond lodged with the RTBA. Water consumption is included.",
        category: "Leasing",
      },
      {
        title: "Pet Policy Notice",
        command: "/pets",
        content: "Pets are warmly considered with landlord approval. Please include your pet's breed and references in your application.",
        category: "Leasing",
      },
      {
        title: "Agency Operating Hours",
        command: "/hours",
        content: "Our agency office is open Monday through Friday 9:00 AM – 5:30 PM, and Saturdays by inspection appointment.",
        category: "General",
      },
    ];
  } else if (industry === "beauty") {
    defaultTemplates = [
      {
        title: "Personal Welcome & Greeting",
        command: "/greeting",
        content: `Hi there! I'm ${staffName} at ${orgName}. How can I help you choose your beauty treatments or reserve an appointment?`,
        category: "Greeting",
      },
      {
        title: "Cut, Colour & Balayage Pricing",
        command: "/pricing",
        content: "Our Signature Cut & Style is $85 (60 min). Full Balayage and colour transformations start from $160 including toner and gloss finish.",
        category: "Pricing",
      },
      {
        title: "Stylist Slot Reservation",
        command: "/booking",
        content: "We have openings with our senior stylists this Friday at 10:00 AM and 1:30 PM. Would either time suit your schedule?",
        category: "Bookings",
      },
      {
        title: "Treatment Pre-Care",
        command: "/precare",
        content: "For best results with your colour treatment, please arrive with dry hair washed 24-48 hours prior without heavy styling products.",
        category: "Care",
      },
      {
        title: "Salon Hours",
        command: "/hours",
        content: "Our studio is open Tuesday through Saturday 9:00 AM – 6:00 PM, with late appointments until 8:00 PM on Thursdays.",
        category: "General",
      },
    ];
  } else {
    // Default Healthcare / Clinic
    defaultTemplates = [
      {
        title: "Personal Welcome & Greeting",
        command: "/greeting",
        content: `Hi there! I'm ${staffName} from ${orgName}. How can I assist you with your appointment or consultation today?`,
        category: "Greeting",
      },
      {
        title: "Appointment Booking Options",
        command: "/booking",
        content: "I can help you reserve that right away! We have available consultation slots tomorrow at 10:30 AM and 2:15 PM. Which time suits you best?",
        category: "Bookings",
      },
      {
        title: "Fee Schedule & Consultation Pricing",
        command: "/fees",
        content: "Our consultation fees are $120 for an Initial Assessment (60 min) and $90 for Standard Follow-ups (30 min). On-the-spot health fund rebates apply.",
        category: "Billing",
      },
      {
        title: "HICAPS & Health Fund Rebates",
        command: "/hicaps",
        content: "We provide immediate on-the-spot electronic HICAPS claiming for Bupa, Medibank, NIB, and all major private healthcare funds.",
        category: "Insurance",
      },
      {
        title: "Clinic Location & Parking",
        command: "/location",
        content: "We are located at 45 Commercial Rd, South Yarra. Dedicated free patient parking is available at the rear of the clinic building.",
        category: "Directions",
      },
      {
        title: "Practice Operating Hours",
        command: "/hours",
        content: "Our clinic is open Monday through Friday 7:30 AM – 6:00 PM and Saturday 8:00 AM – 1:00 PM. Closed Sundays and Public Holidays.",
        category: "General",
      },
      {
        title: "Senior Clinical Handoff",
        command: "/handoff",
        content: "I have documented your inquiry and notified our senior practitioner on duty. A clinician will review your file and respond shortly.",
        category: "Handoff",
      },
    ];
  }

  const insertStmt = db.prepare(`
    INSERT INTO user_message_templates (id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  for (const t of defaultTemplates) {
    const id = "tpl_" + randomBytes(8).toString("hex");
    insertStmt.run(id, userId, t.title, t.command, t.content, t.category);
  }

  return getUserTemplates(userId);
}

/**
 * Retrieves all message templates for a given user.
 * Automatically seeds predefined messages if none exist.
 */
export function getUserTemplates(userId: string): UserMessageTemplate[] {
  let rows = db
    .prepare(`
      SELECT id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at
      FROM user_message_templates
      WHERE user_id = ?
      ORDER BY is_predefined DESC, created_at ASC
    `)
    .all(userId) as unknown as UserMessageTemplate[];

  if (rows.length === 0) {
    rows = seedUserPredefinedTemplates(userId);
  }

  return rows;
}

/**
 * Saves a user template (creates a custom template or updates an existing one).
 */
export function saveUserTemplate(
  userId: string,
  data: {
    id?: string;
    title: string;
    command: string;
    content: string;
    category?: string;
    is_active?: boolean | number;
  }
): UserMessageTemplate {
  const title = (data.title || "").trim();
  let command = (data.command || "").trim().toLowerCase();
  const content = (data.content || "").trim();
  const category = (data.category || "General").trim();
  const isActive = data.is_active === false || data.is_active === 0 ? 0 : 1;

  if (title.length < 2) {
    throw new ValidationError("Template title must be at least 2 characters.");
  }

  if (!command) {
    throw new ValidationError("Template command shortcut is required.");
  }

  if (!command.startsWith("/")) {
    command = `/${command}`;
  }

  if (command.includes(" ") || command.length < 2) {
    throw new ValidationError("Command shortcut must start with '/' and contain no spaces (e.g. /greeting).");
  }

  if (content.length < 2) {
    throw new ValidationError("Template message content must be at least 2 characters.");
  }

  if (data.id) {
    // Update existing template
    const existing = db
      .prepare("SELECT id, user_id, is_predefined FROM user_message_templates WHERE id = ? AND user_id = ?")
      .get(data.id, userId) as { id: string; user_id: string; is_predefined: number } | undefined;

    if (!existing) {
      throw new NotFoundError("Template not found or unauthorized to edit.");
    }

    db.prepare(`
      UPDATE user_message_templates
      SET title = ?, command = ?, content = ?, category = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(title, command, content, category, isActive, data.id, userId);

    const updated = db
      .prepare("SELECT * FROM user_message_templates WHERE id = ?")
      .get(data.id) as unknown as UserMessageTemplate;

    return updated;
  } else {
    // Check if command already in use by this user
    const conflict = db
      .prepare("SELECT id FROM user_message_templates WHERE user_id = ? AND command = ?")
      .get(userId, command) as { id: string } | undefined;

    if (conflict) {
      throw new ValidationError(`Command shortcut '${command}' is already in use by another template.`);
    }

    const id = "tpl_" + randomBytes(8).toString("hex");
    db.prepare(`
      INSERT INTO user_message_templates (id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, userId, title, command, content, category);

    const created = db
      .prepare("SELECT * FROM user_message_templates WHERE id = ?")
      .get(id) as unknown as UserMessageTemplate;

    return created;
  }
}

/**
 * Deletes a template owned by the user.
 */
export function deleteUserTemplate(userId: string, templateId: string): void {
  const existing = db
    .prepare("SELECT id, user_id, is_predefined FROM user_message_templates WHERE id = ? AND user_id = ?")
    .get(templateId, userId) as { id: string; user_id: string; is_predefined: number } | undefined;

  if (!existing) {
    throw new NotFoundError("Template not found.");
  }

  db.prepare("DELETE FROM user_message_templates WHERE id = ? AND user_id = ?").run(templateId, userId);
}

/**
 * Resets predefined templates for the user back to standard clinic/industry defaults.
 */
export function resetUserTemplates(userId: string): UserMessageTemplate[] {
  db.prepare("DELETE FROM user_message_templates WHERE user_id = ?").run(userId);
  return seedUserPredefinedTemplates(userId);
}
