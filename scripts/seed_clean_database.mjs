import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const runtimeRoot = process.cwd();
const dataDir = path.join(runtimeRoot, "node_modules", ".cache", "frontdesk-sqlite");
const legacyDataDir = path.join(runtimeRoot, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "frontdesk.sqlite");
const legacyDbPath = path.join(legacyDataDir, "frontdesk.sqlite");

console.log("Database path:", dbPath);

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function resetAndSeedDatabase() {
  const db = new DatabaseSync(dbPath);

  console.log("1. Emptying existing tables...");
  const tableNames = [
    "sessions",
    "dispatched_emails",
    "auth_tokens",
    "integration_logs",
    "billing_invoices",
    "payment_methods",
    "user_message_templates",
    "marketing_inquiries",
    "messages",
    "conversations",
    "leads",
    "appointments",
    "orders",
    "integrations",
    "unanswered_questions",
    "knowledge_chunks",
    "knowledge_sources",
    "agents",
    "users",
    "organizations",
  ];

  for (const table of tableNames) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (e) {
      // ignore if table doesn't exist
    }
  }

  // Also clean up SQLite sequences
  try {
    db.prepare("DELETE FROM sqlite_sequence").run();
  } catch {}

  console.log("2. Seeding Organizations...");
  const insertOrg = db.prepare(`
    INSERT INTO organizations (id, name, industry, plan, billing_cycle, billing_currency, billing_provider, allow_subuser_template_editing)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Platform HQ
  insertOrg.run("org_echo_platform", "Echo.ai Platform HQ", "other", "pro", "annual", "USD", "lemonsqueezy", 0);
  // Main Clinic
  insertOrg.run("org_demo_101", "Healing Hands Physio", "clinic", "growth", "monthly", "AUD", "lemonsqueezy", 0);
  // Echo Sales
  insertOrg.run("org_echo_sales", "Echo.ai", "other", "pro", "annual", "USD", "lemonsqueezy", 0);
  // Ecom Demo
  insertOrg.run("org_demo_ecom", "Aura Apparel", "ecommerce", "growth", "biannual", "USD", "lemonsqueezy", 0);
  // Real Estate Demo
  insertOrg.run("org_demo_realestate", "Harbour Realty", "realestate", "growth", "monthly", "AUD", "lemonsqueezy", 0);
  // Beauty Salon Demo
  insertOrg.run("org_demo_beauty", "Luna Studio", "beauty", "growth", "monthly", "USD", "lemonsqueezy", 0);

  console.log("3. Seeding Users...");
  const insertUser = db.prepare(`
    INSERT INTO users (id, organization_id, email, name, password_hash, salt, role, is_superadmin, can_edit_company_templates)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const { hash: superadminHash, salt: superadminSalt } = hashPassword("password123");
  const { hash: ownerHash, salt: ownerSalt } = hashPassword("password123");
  const { hash: recepHash, salt: recepSalt } = hashPassword("password123");
  const { hash: salesHash, salt: salesSalt } = hashPassword("password123");

  // Platform Superadmin (Alex Rivera)
  insertUser.run(
    "usr_superadmin",
    "org_echo_platform",
    "superadmin@echo.ai",
    "Alex Rivera (Project Owner)",
    superadminHash,
    superadminSalt,
    "superadmin",
    1,
    1
  );

  // Practice Owner (Dr. Sarah Lee)
  insertUser.run(
    "usr_demo_101",
    "org_demo_101",
    "demo@echo.ai",
    "Dr. Sarah Lee",
    ownerHash,
    ownerSalt,
    "owner",
    0,
    0
  );

  // Clinic Receptionist (Clara Receptionist)
  insertUser.run(
    "usr_recep_101",
    "org_demo_101",
    "receptionist@echo.ai",
    "Clara Receptionist",
    recepHash,
    recepSalt,
    "receptionist",
    0,
    0 // Default: not granted company template editing until owner grants it
  );

  // Echo Advisor
  insertUser.run(
    "usr_echo_sales",
    "org_echo_sales",
    "sales@echo.ai",
    "Echo Advisor",
    salesHash,
    salesSalt,
    "owner",
    0,
    0
  );

  // Ecom Owner
  insertUser.run(
    "usr_demo_ecom",
    "org_demo_ecom",
    "demo.ecom@echo.ai",
    "Aria Support",
    salesHash,
    salesSalt,
    "owner",
    0,
    0
  );

  // Real Estate Owner
  insertUser.run(
    "usr_demo_re",
    "org_demo_realestate",
    "demo.re@echo.ai",
    "Julian Thorne",
    salesHash,
    salesSalt,
    "owner",
    0,
    0
  );

  // Beauty Salon Owner
  insertUser.run(
    "usr_demo_beauty",
    "org_demo_beauty",
    "demo.beauty@echo.ai",
    "Elena Rostova",
    salesHash,
    salesSalt,
    "owner",
    0,
    0
  );

  console.log("4. Seeding Agents...");
  const insertAgent = db.prepare(`
    INSERT INTO agents (id, organization_id, name, greeting, color, position, tone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAgent.run(
    "agt_echo_platform",
    "org_echo_platform",
    "Echo Platform Assistant",
    "Echo.ai Platform Operations & Support Assistant.",
    "#4f46e5",
    "right",
    "Executive"
  );
  insertAgent.run(
    "agt_demo_101",
    "org_demo_101",
    "Maya",
    "Hi! Welcome to Healing Hands Physio. How can I help you today?",
    "#0d9488",
    "right",
    "Friendly"
  );
  insertAgent.run(
    "agt_echo_sales",
    "org_echo_sales",
    "Echo Advisor",
    "Hi! Welcome to Echo.ai. How can I help you explore our 24/7 AI front desk, pricing plans, or integrations today?",
    "#4f46e5",
    "right",
    "Friendly & Consultative"
  );
  insertAgent.run(
    "agt_demo_ecom",
    "org_demo_ecom",
    "Aria",
    "Hi! I’m Aria from Aura Apparel. Looking for something or tracking an order?",
    "#4f46e5",
    "right",
    "Friendly"
  );
  insertAgent.run(
    "agt_demo_re",
    "org_demo_realestate",
    "Sam",
    "Hi! I’m Sam from Harbour Realty. Looking to buy, rent or book a property inspection?",
    "#2563eb",
    "right",
    "Professional"
  );
  insertAgent.run(
    "agt_demo_beauty",
    "org_demo_beauty",
    "Lexi",
    "Hi! I’m Lexi from Luna Studio. Want to book a haircut or see our treatment prices?",
    "#9333ea",
    "right",
    "Friendly"
  );

  console.log("5. Seeding Knowledge Sources & Chunks...");
  const insertSource = db.prepare(`
    INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count, last_synced_at)
    VALUES (?, ?, ?, ?, ?, 'indexed', ?, CURRENT_TIMESTAMP)
  `);
  const insertChunk = db.prepare(`
    INSERT INTO knowledge_chunks (id, source_id, organization_id, chunk_index, title, content, token_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Clinic Knowledge
  insertSource.run("src_clinic_101", "org_demo_101", "Healing Hands Practice Guide & Pricing", "document", null, 4);
  const clinicChunks = [
    {
      title: "Clinic Services & Consultation Fees",
      content: "Healing Hands Physio offers Initial Physiotherapy Assessments ($120, 60 minutes) and Standard Follow-up Consultations ($90, 30 minutes). Sports injury rehabilitation, spinal care, and post-operative recovery plans are tailored to each patient.",
    },
    {
      title: "HICAPS Health Insurance Claiming",
      content: "We provide instant electronic on-the-spot HICAPS claiming for all major Australian private healthcare funds including Bupa, Medibank, NIB, HCF, and Teachers Health. EPC/CDM Medicare care plans from GPs are accepted with bulk-billing or minimal gap.",
    },
    {
      title: "Clinic Location & Patient Parking",
      content: "We are located at 45 Commercial Rd, South Yarra. Free dedicated patient parking is accessible at the rear of the clinic building via Garden Lane. Accessible ramp access is available at the front entrance.",
    },
    {
      title: "Operating Hours & Cancellation Policy",
      content: "Our clinic is open Monday to Friday 7:30 AM to 6:00 PM and Saturday 8:00 AM to 1:00 PM. We request 24 hours notice for appointment rescheduling or cancellations to avoid a late cancellation charge.",
    },
  ];
  clinicChunks.forEach((c, idx) => {
    insertChunk.run(`chk_clinic_${idx + 1}`, "src_clinic_101", "org_demo_101", idx + 1, c.title, c.content, Math.round(c.content.length / 4));
  });

  // Echo Platform & Sales Docs
  insertSource.run("src_echo_sales_docs", "org_echo_sales", "Echo.ai Platform & Pricing Docs", "document", null, 4);
  const echoChunks = [
    {
      title: "Pricing Plans & Free Trial",
      content: "Echo.ai offers three plans: Starter ($39/month for 1 website and 500 conversations), Growth ($99/month for 3 team members, live calendar booking and order sync, 2,000 conversations), and Pro ($199/month for 10 team members, custom actions, and priority support). Bi-Annual billing saves 10% and Annual billing saves 20%. Every plan includes a 14-day free trial with no credit card required.",
    },
    {
      title: "Website Setup & Installation",
      content: "Setup takes less than 2 minutes. Point Echo.ai to your website URL or upload PDFs to train your assistant. To install, paste our lightweight script before the closing </body> tag: <script src=\"https://cdn.echo.ai/widget.js\" data-org=\"YOUR_ORG_ID\" async></script>. Works on WordPress, Shopify, Webflow, Squarespace, Wix, and custom websites.",
    },
    {
      title: "Supported Practice Software & Integrations",
      content: "Echo.ai integrates natively with practice management software including Cliniko and Halaxy for live healthcare availability and appointment bookings. It connects to Google Calendar for schedule sync, and Shopify / WooCommerce for live order tracking, inventory queries, and return policies.",
    },
    {
      title: "Zero-Hallucination Safety & Human Handover",
      content: "Echo.ai operates under strict boundary guardrails: it answers only from your approved website content, PDFs, and FAQs. It never invents medical advice, availability, or prices. If a customer requests a person or asks an unverified question, Echo smoothly hands over to your staff dashboard and alerts your team.",
    },
  ];
  echoChunks.forEach((c, idx) => {
    insertChunk.run(`chk_echo_sales_${idx + 1}`, "src_echo_sales_docs", "org_echo_sales", idx + 1, c.title, c.content, Math.round(c.content.length / 4));
  });

  console.log("6. Seeding Predefined Message Templates (Company Assigned)...");
  const insertTemplate = db.prepare(`
    INSERT INTO user_message_templates (id, organization_id, user_id, title, command, content, category, is_predefined, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const clinicPredefined = [
    {
      title: "Clinic Welcome & Greeting",
      command: "/greeting",
      content: "Hello! Thank you for contacting Healing Hands Physio. How can our front desk assist you with your appointment or inquiry today?",
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

  clinicPredefined.forEach((t) => {
    insertTemplate.run(
      "tpl_" + randomBytes(6).toString("hex"),
      "org_demo_101",
      "usr_demo_101",
      t.title,
      t.command,
      t.content,
      t.category,
      1
    );
  });

  console.log("7. Seeding Conversations & Messages...");
  const insertConv = db.prepare(`
    INSERT INTO conversations (id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, created_at, last_activity_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const conv1 = "conv_demo_101_01";
  const now = Date.now();
  const t1 = new Date(now - 3600000 * 2).toISOString();
  const t2 = new Date(now - 3600000 * 1.9).toISOString();
  const t3 = new Date(now - 3600000 * 1.8).toISOString();

  insertConv.run(
    conv1,
    "org_demo_101",
    "Liam Parker",
    "liam.parker@example.com",
    "web",
    "ACTIVE",
    "AI Active",
    "Yes, 10:30 AM works perfectly. Do you accept Bupa private health?",
    t1,
    t3
  );
  insertMsg.run("msg_demo_01", conv1, "client", "Hi, I have lower back pain after playing tennis yesterday. Can I see someone tomorrow?", t1);
  insertMsg.run("msg_demo_02", conv1, "ai", "Hello Liam! I can certainly help with that. Dr. Sarah Lee has an opening tomorrow at 10:30 AM for an Initial Assessment (60 min, $120). Would that time suit you?", t2);
  insertMsg.run("msg_demo_03", conv1, "client", "Yes, 10:30 AM works perfectly. Do you accept Bupa private health?", t3);

  const conv2 = "conv_demo_101_02";
  const t4 = new Date(now - 3600000 * 5).toISOString();
  const t5 = new Date(now - 3600000 * 4.9).toISOString();
  insertConv.run(
    conv2,
    "org_demo_101",
    "Emma Watson",
    "emma.w@example.com",
    "web",
    "RESOLVED",
    "AI Resolved",
    "We are located at 45 Commercial Rd, South Yarra. Dedicated free patient parking is available at the rear of the building via Garden Lane!",
    t4,
    t5
  );
  insertMsg.run("msg_demo_04", conv2, "client", "Where should I park when coming in?", t4);
  insertMsg.run("msg_demo_05", conv2, "ai", "We are located at 45 Commercial Rd, South Yarra. Dedicated free patient parking is available at the rear of the building via Garden Lane!", t5);

  console.log("8. Seeding Leads & Appointments...");
  db.prepare(`
    INSERT INTO leads (id, organization_id, conversation_id, name, phone, email, intent, status, created_at)
    VALUES ('lead_01', 'org_demo_101', 'conv_demo_101_01', 'Liam Parker', '+61 412 345 678', 'liam.parker@example.com', 'Initial Consultation Booking', 'qualified', ?)
  `).run(t1);

  db.prepare(`
    INSERT INTO appointments (id, organization_id, conversation_id, patient_name, patient_contact, practitioner_name, service_name, start_time, status, source)
    VALUES ('apt_01', 'org_demo_101', 'conv_demo_101_01', 'Liam Parker', '+61 412 345 678', 'Dr. Sarah Lee', 'Initial Assessment (60 min)', 'Tomorrow, 10:30 AM', 'confirmed', 'ai_booked')
  `).run();

  console.log("9. Seeding Payment Methods & Invoices...");
  db.prepare(`
    INSERT INTO payment_methods (id, organization_id, brand, last4, exp_month, exp_year, cardholder_name, is_default)
    VALUES ('pm_demo_visa', 'org_demo_101', 'VISA', '4242', '08', '2029', 'Dr. Sarah Lee', 1)
  `).run();
  db.prepare(`
    INSERT INTO payment_methods (id, organization_id, brand, last4, exp_month, exp_year, cardholder_name, is_default)
    VALUES ('pm_demo_mc', 'org_demo_101', 'MASTERCARD', '8819', '11', '2028', 'Healing Hands Clinic', 0)
  `).run();

  db.prepare(`
    INSERT INTO billing_invoices (id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, created_at)
    VALUES ('INV-2026-1101-101', 'org_demo_101', 'Growth Plan (Monthly)', 'monthly', 9900, '$99.00 AUD', 'AUD', 'Paid', 'VISA •••• 4242', NULL, 'Nov 01, 2026', '2026-11-01T09:00:00.000Z')
  `).run();
  db.prepare(`
    INSERT INTO billing_invoices (id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, created_at)
    VALUES ('INV-2026-1001-101', 'org_demo_101', 'Growth Plan (Monthly)', 'monthly', 9900, '$99.00 AUD', 'AUD', 'Paid', 'VISA •••• 4242', NULL, 'Oct 01, 2026', '2026-10-01T09:00:00.000Z')
  `).run();

  console.log("10. Seeding Marketing Inquiries...");
  const insertInq = db.prepare(`
    INSERT INTO marketing_inquiries (id, name, email, business, industry, website, message, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInq.run(
    "inq_seed_001",
    "Dr. Marcus Vance",
    "marcus.vance@sydneychiro.com.au",
    "Sydney Spinal & Sports Chiro",
    "clinic",
    "https://sydneychiro.com.au",
    "We have 4 chiropractors across 2 clinic rooms. We need an automated receptionist to connect with Cliniko and book after-hours patients directly.",
    "contact_form",
    "new",
    new Date(now - 7200000).toISOString()
  );
  insertInq.run(
    "inq_seed_002",
    "Sophie Lin",
    "sophie@lumierejewels.com",
    "Lumière Fine Jewelry",
    "ecommerce",
    "https://lumierejewels.com",
    "Interested in the Growth plan for our Shopify boutique. Does it support custom ring sizing queries?",
    "contact_form",
    "contacted",
    new Date(now - 14400000).toISOString()
  );
  insertInq.run(
    "inq_seed_003",
    "Michael Thorne",
    "mthorne@thornelegal.com.au",
    "Thorne & Associates Law",
    "other",
    "https://thornelegal.com.au",
    "Can the virtual receptionist qualify commercial litigation leads before routing calls to our partners?",
    "contact_form",
    "qualified",
    new Date(now - 28800000).toISOString()
  );

  // Marketing live chat conversation for Echo Advisor
  const salesConvId = "conv_sales_prospect_01";
  insertConv.run(
    salesConvId,
    "org_echo_sales",
    "Dr. Alan Grant",
    "alan.grant@montanaspine.com",
    "+1 406 555 0192",
    "active",
    "widget",
    new Date(now - 1800000).toISOString(),
    new Date(now - 300000).toISOString()
  );
  insertMsg.run("msg_sales_01", salesConvId, "visitor", "Hello! Does Echo integrate with Cliniko for live appointments?", new Date(now - 1800000).toISOString());
  insertMsg.run("msg_sales_02", salesConvId, "agent", "Yes, absolutely! Echo.ai integrates natively with Cliniko and Halaxy for live 2-way calendar sync.", new Date(now - 1740000).toISOString());
  insertMsg.run("msg_sales_03", salesConvId, "visitor", "How much does that cost per month?", new Date(now - 1200000).toISOString());
  insertMsg.run("msg_sales_04", salesConvId, "agent", "Our Growth plan at $99/month includes live Cliniko sync for up to 3 team members, SMS confirmations, and 2,000 monthly patient conversations. We also offer Bi-Annual (Save 10%) and Annual (Save 20%) billing!", new Date(now - 1100000).toISOString());

  // Also ensure copy to legacyDbPath if legacy directory exists so old fallback doesn't overwrite with stale data
  try {
    fs.copyFileSync(dbPath, legacyDbPath);
  } catch {}

  console.log("Database reset and seeded successfully!");
}

resetAndSeedDatabase();
