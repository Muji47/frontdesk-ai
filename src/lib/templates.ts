import { db } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { ValidationError, NotFoundError, ForbiddenError } from "@/server/errors";

export interface UserMessageTemplate {
  id: string;
  organization_id: string;
  user_id: string | null;
  title: string;
  command: string;
  content: string;
  category: string;
  is_predefined: number; // 1 = Company-wide Predefined, 0 = Personal Custom
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Returns default template blueprints tailored for a practice industry.
 */
function getIndustryDefaultTemplates(orgName: string, industry: string): Array<{
  title: string;
  command: string;
  content: string;
  category: string;
}> {
  if (industry === "ecommerce") {
    return [
      {
        title: "Company Welcome & Greeting",
        command: "/greeting",
        content: `Hi there! Welcome to ${orgName} Customer Care. How can I assist you with your order or inquiry today?`,
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
  }

  if (industry === "realestate") {
    return [
      {
        title: "Agency Welcome & Greeting",
        command: "/greeting",
        content: `Hello! Welcome to ${orgName}. How can I assist you with your property search or viewing schedule today?`,
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
  }

  if (industry === "beauty") {
    return [
      {
        title: "Salon Welcome & Greeting",
        command: "/greeting",
        content: `Hi there! Welcome to ${orgName}. How can I help you choose your beauty treatments or reserve an appointment?`,
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
  }

  // Default Healthcare / Medical Clinic
  return [
    {
      title: "Clinic Welcome & Greeting",
      command: "/greeting",
      content: `Hello! Thank you for contacting ${orgName}. How can our front desk assist you with your appointment or inquiry today?`,
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

/**
 * Seeds predefined standard messages assigned to the company / organization.
 * Predefined templates belong to the entire practice, not individual users.
 */
export function seedOrgPredefinedTemplates(orgId: string): UserMessageTemplate[] {
  const orgRow = db
    .prepare("SELECT id, name, industry FROM organizations WHERE id = ?")
    .get(orgId) as { id: string; name: string; industry: string | null } | undefined;

  const orgName = orgRow?.name || "Our Practice";
  const industry = orgRow?.industry || "clinic";

  const defaultTemplates = getIndustryDefaultTemplates(orgName, industry);

  // Find owner to associate or leave user_id as null
  const ownerRow = db
    .prepare("SELECT id FROM users WHERE organization_id = ? AND role = 'owner' LIMIT 1")
    .get(orgId) as { id: string } | undefined;
  const ownerUserId = ownerRow?.id || null;

  const insertStmt = db.prepare(`
    INSERT INTO user_message_templates (id, organization_id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  for (const t of defaultTemplates) {
    const id = "tpl_" + randomBytes(8).toString("hex");
    insertStmt.run(id, orgId, ownerUserId, t.title, t.command, t.content, t.category);
  }

  return db
    .prepare(`
      SELECT id, organization_id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at
      FROM user_message_templates
      WHERE organization_id = ? AND is_predefined = 1
      ORDER BY created_at ASC
    `)
    .all(orgId) as unknown as UserMessageTemplate[];
}

/**
 * Retrieves company-wide predefined templates and personal custom templates for a user.
 * Automatically seeds company predefined templates if none exist for the organization.
 */
export function getTemplatesForUser(
  orgId: string,
  userId: string
): {
  companyTemplates: UserMessageTemplate[];
  personalTemplates: UserMessageTemplate[];
  allTemplates: UserMessageTemplate[];
} {
  // 1. Fetch company predefined templates
  let companyTemplates = db
    .prepare(`
      SELECT id, organization_id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at
      FROM user_message_templates
      WHERE organization_id = ? AND is_predefined = 1
      ORDER BY created_at ASC
    `)
    .all(orgId) as unknown as UserMessageTemplate[];

  if (companyTemplates.length === 0) {
    companyTemplates = seedOrgPredefinedTemplates(orgId);
  }

  // 2. Fetch user's personal custom templates
  const personalTemplates = db
    .prepare(`
      SELECT id, organization_id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at
      FROM user_message_templates
      WHERE organization_id = ? AND user_id = ? AND is_predefined = 0
      ORDER BY created_at ASC
    `)
    .all(orgId, userId) as unknown as UserMessageTemplate[];

  // 3. Combined templates for live chat triage (company predefined first, then personal)
  const allTemplates = [...companyTemplates, ...personalTemplates];

  return { companyTemplates, personalTemplates, allTemplates };
}

/**
 * Backward-compatible helper to retrieve all message templates for a given user.
 */
export function getUserTemplates(userId: string, explicitOrgId?: string): UserMessageTemplate[] {
  let orgId = explicitOrgId;
  if (!orgId) {
    const userRow = db.prepare("SELECT organization_id FROM users WHERE id = ?").get(userId) as
      | { organization_id: string }
      | undefined;
    orgId = userRow?.organization_id || "org_demo_101";
  }

  const { allTemplates } = getTemplatesForUser(orgId, userId);
  return allTemplates;
}

/**
 * Saves a message template with RBAC permissions:
 * - Company Predefined Templates (is_predefined = 1): Only Owners & Admins can edit or create.
 * - Personal Custom Templates (is_predefined = 0): Any staff member can create/edit for themselves.
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
    is_predefined?: boolean | number;
  },
  explicitOrgId?: string,
  explicitRole?: string
): UserMessageTemplate {
  // Determine organization and role
  const userRow = db
    .prepare("SELECT organization_id, role FROM users WHERE id = ?")
    .get(userId) as { organization_id: string; role: string } | undefined;

  const orgId = explicitOrgId || userRow?.organization_id;
  const userRole = explicitRole || userRow?.role || "receptionist";

  if (!orgId) {
    throw new ValidationError("User organization not found.");
  }

  const isManagement = userRole === "owner" || userRole === "admin";

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
    // Updating existing template
    const existing = db
      .prepare(`
        SELECT id, organization_id, user_id, is_predefined
        FROM user_message_templates
        WHERE id = ? AND organization_id = ?
      `)
      .get(data.id, orgId) as { id: string; organization_id: string; user_id: string | null; is_predefined: number } | undefined;

    if (!existing) {
      throw new NotFoundError("Template not found in your organization.");
    }

    // Permission check
    if (existing.is_predefined === 1) {
      if (!isManagement) {
        throw new ForbiddenError("Company standard templates can only be edited by Practice Owners and Administrators.");
      }
    } else {
      if (existing.user_id !== userId && !isManagement) {
        throw new ForbiddenError("You are only permitted to edit your own personal templates.");
      }
    }

    // Check shortcut conflict if command changed
    const conflict = db
      .prepare(`
        SELECT id, title FROM user_message_templates
        WHERE organization_id = ? AND command = ? AND id != ?
        AND (is_predefined = 1 OR user_id = ?)
      `)
      .get(orgId, command, data.id, userId) as { id: string; title: string } | undefined;

    if (conflict) {
      throw new ValidationError(`Shortcut '${command}' is already in use by '${conflict.title}'.`);
    }

    db.prepare(`
      UPDATE user_message_templates
      SET title = ?, command = ?, content = ?, category = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(title, command, content, category, isActive, data.id, orgId);

    return db
      .prepare("SELECT * FROM user_message_templates WHERE id = ?")
      .get(data.id) as unknown as UserMessageTemplate;
  } else {
    // Creating new template
    const createAsPredefined = (data.is_predefined === 1 || data.is_predefined === true) && isManagement;

    // Check shortcut conflict within organization
    const conflict = db
      .prepare(`
        SELECT id, title, is_predefined FROM user_message_templates
        WHERE organization_id = ? AND command = ?
        AND (is_predefined = 1 OR user_id = ?)
      `)
      .get(orgId, command, userId) as { id: string; title: string; is_predefined: number } | undefined;

    if (conflict) {
      const typeLabel = conflict.is_predefined === 1 ? "company predefined message" : "personal custom template";
      throw new ValidationError(`Shortcut '${command}' is already in use by ${typeLabel} '${conflict.title}'.`);
    }

    const id = "tpl_" + randomBytes(8).toString("hex");
    db.prepare(`
      INSERT INTO user_message_templates (id, organization_id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      id,
      orgId,
      createAsPredefined ? null : userId,
      title,
      command,
      content,
      category,
      createAsPredefined ? 1 : 0
    );

    return db
      .prepare("SELECT * FROM user_message_templates WHERE id = ?")
      .get(id) as unknown as UserMessageTemplate;
  }
}

/**
 * Deletes a template with role enforcement:
 * - Company Predefined Templates: Only Owners and Admins can delete.
 * - Personal Custom Templates: Owning user or Admins can delete.
 */
export function deleteUserTemplate(
  userId: string,
  templateId: string,
  explicitOrgId?: string,
  explicitRole?: string
): void {
  const userRow = db
    .prepare("SELECT organization_id, role FROM users WHERE id = ?")
    .get(userId) as { organization_id: string; role: string } | undefined;

  const orgId = explicitOrgId || userRow?.organization_id;
  const userRole = explicitRole || userRow?.role || "receptionist";

  if (!orgId) {
    throw new ValidationError("User organization not found.");
  }

  const isManagement = userRole === "owner" || userRole === "admin";

  const existing = db
    .prepare(`
      SELECT id, organization_id, user_id, is_predefined
      FROM user_message_templates
      WHERE id = ? AND organization_id = ?
    `)
    .get(templateId, orgId) as { id: string; organization_id: string; user_id: string | null; is_predefined: number } | undefined;

  if (!existing) {
    throw new NotFoundError("Template not found in your organization.");
  }

  if (existing.is_predefined === 1) {
    if (!isManagement) {
      throw new ForbiddenError("Only Practice Owners and Administrators can delete company standard templates.");
    }
  } else {
    if (existing.user_id !== userId && !isManagement) {
      throw new ForbiddenError("You can only delete your own personal custom templates.");
    }
  }

  db.prepare("DELETE FROM user_message_templates WHERE id = ? AND organization_id = ?").run(templateId, orgId);
}

/**
 * Resets COMPANY predefined templates for an organization back to standard clinic/industry defaults.
 * Personal custom templates created by staff members are kept untouched!
 */
export function resetOrgPredefinedTemplates(orgId: string, userRole: string): UserMessageTemplate[] {
  if (userRole !== "owner" && userRole !== "admin") {
    throw new ForbiddenError("Only Practice Owners and Administrators have permission to reset company standard templates.");
  }

  // Delete only company predefined templates for this organization
  db.prepare("DELETE FROM user_message_templates WHERE organization_id = ? AND is_predefined = 1").run(orgId);

  // Seed fresh standard templates for this organization
  return seedOrgPredefinedTemplates(orgId);
}

/**
 * Backward-compatible reset handler.
 */
export function resetUserTemplates(userId: string, explicitOrgId?: string, explicitRole?: string): UserMessageTemplate[] {
  const userRow = db
    .prepare("SELECT organization_id, role FROM users WHERE id = ?")
    .get(userId) as { organization_id: string; role: string } | undefined;

  const orgId = explicitOrgId || userRow?.organization_id || "org_demo_101";
  const userRole = explicitRole || userRow?.role || "receptionist";

  resetOrgPredefinedTemplates(orgId, userRole);
  return getUserTemplates(userId, orgId);
}
