import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "frontdesk.sqlite");
const db = new DatabaseSync(dbPath);

// Enforce foreign key constraints and Write-Ahead Logging
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  -- 1. Organizations (Tenants)
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT NOT NULL DEFAULT 'clinic',
    plan TEXT NOT NULL DEFAULT 'growth',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Users (RBAC)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  -- 3. Sessions (HttpOnly Cookie Auth)
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  -- 4. Agents (AI Receptionist Persona & Configuration)
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Maya',
    greeting TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#0d9488',
    position TEXT NOT NULL DEFAULT 'right',
    tone TEXT NOT NULL DEFAULT 'Friendly',
    system_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);

  -- 5. Knowledge Sources (Ingested URLs, PDFs, Documents)
  CREATE TABLE IF NOT EXISTS knowledge_sources (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'url' | 'pdf' | 'document'
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'indexed', -- 'indexed' | 'indexing' | 'failed'
    page_count INTEGER NOT NULL DEFAULT 1,
    last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_knowledge_org ON knowledge_sources(organization_id);

  -- 5b. Knowledge Chunks (Real extracted website & document text parameters)
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_source ON knowledge_chunks(source_id);
  CREATE INDEX IF NOT EXISTS idx_chunks_org ON knowledge_chunks(organization_id);

  -- 6. Unanswered Questions Queue (Human-In-The-Loop Self-Learning)
  CREATE TABLE IF NOT EXISTS unanswered_questions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    question TEXT NOT NULL,
    frequency_count INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'ignored'
    suggested_answer TEXT,
    approved_answer TEXT,
    approved_by TEXT,
    last_asked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_unanswered_org_status ON unanswered_questions(organization_id, status);

  -- 7. Conversations (Omnichannel visitor inbox)
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    visitor_name TEXT NOT NULL,
    visitor_contact TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'web',
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'WAITING_FOR_HUMAN' | 'RESOLVED'
    resolution_badge TEXT NOT NULL DEFAULT 'AI Active', -- 'AI Resolved' | 'Human needed'
    last_message TEXT NOT NULL,
    external_ref TEXT,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(organization_id, last_activity_at DESC);

  -- 8. Messages (Chat log items)
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'client' | 'ai' | 'staff'
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);

  -- 9. Appointments (Cliniko / Medical Practice Management Sync)
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    conversation_id TEXT,
    patient_name TEXT NOT NULL,
    patient_contact TEXT NOT NULL,
    practitioner_name TEXT NOT NULL,
    service_name TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'cancelled' | 'completed'
    source TEXT NOT NULL DEFAULT 'ai_booked', -- 'ai_booked' | 'receptionist'
    external_id TEXT, -- e.g. Cliniko #CL-48213
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(organization_id, start_time DESC);

  -- 10. Orders (Shopify / E-Commerce Sync)
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    total_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'AUD',
    tracking_carrier TEXT,
    tracking_status TEXT NOT NULL DEFAULT 'in_transit', -- 'in_transit' | 'delivered' | 'pending'
    external_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(organization_id, order_number);

  -- 11. Leads (Captured High-Intent Prospects)
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    conversation_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    intent TEXT NOT NULL DEFAULT 'booking', -- 'booking' | 'pricing' | 'partnership'
    status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'converted'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id, created_at DESC);

  -- 12. Integrations (Third-Party Connectivity)
  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'cliniko' | 'shopify' | 'google_calendar' | 'web_widget'
    status TEXT NOT NULL DEFAULT 'connected', -- 'connected' | 'disconnected' | 'error'
    config_json TEXT,
    last_sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id, provider);
`);

/**
 * Executes a function within an atomic SQLite transaction.
 * Automatically rolls back on uncaught errors.
 */
export function withTransaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// Password cryptographic helpers (scrypt key derivation)
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const hashedBuf = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
    const storedBuf = Buffer.from(hash, "hex");
    if (hashedBuf.length !== storedBuf.length) return false;
    return timingSafeEqual(hashedBuf, storedBuf);
  } catch {
    return false;
  }
}

// Constant-time dummy check to prevent timing attacks if user does not exist
const DUMMY_SALT = randomBytes(16).toString("hex");
export function dummyPasswordCheck() {
  scryptSync("dummy_password_timing_defense", DUMMY_SALT, 64);
  return false;
}

/**
 * Seed operational tables ONLY for the demo test organization (never inject fake files into real user accounts).
 */
export function seedOrganizationData(orgId: string, industry: string, businessName: string) {
  // Guardrail: Never inject category mock files or fake documents into real user accounts
  if (orgId !== "org_demo_101") return;

  const existingConv = db.prepare("SELECT COUNT(*) as cnt FROM conversations WHERE organization_id = ?").get(orgId) as { cnt: number };
  if (existingConv.cnt > 0) return;

  const isEcom = industry === "ecommerce";

  withTransaction(() => {
    // 1. Seed Knowledge Sources
    const src1Id = "src_" + randomBytes(6).toString("hex");
    const src2Id = "src_" + randomBytes(6).toString("hex");

    if (isEcom) {
      db.prepare(`
        INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(src1Id, orgId, `https://${businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com.au`, "url", `https://${businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com.au`, "indexed", 42);

      db.prepare(`
        INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(src2Id, orgId, "Shipping_And_Returns_Policy_2026.pdf", "pdf", "/docs/returns.pdf", "indexed", 6);
    } else {
      db.prepare(`
        INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(src1Id, orgId, `https://${businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com.au`, "url", `https://${businessName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com.au`, "indexed", 18);

      db.prepare(`
        INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(src2Id, orgId, "Pricing_And_Services_Schedule_2026.pdf", "pdf", "/docs/pricing.pdf", "indexed", 4);
    }

    // 2. Seed Unanswered Questions
    const questions = isEcom
      ? [
          { q: "Do you offer student discounts or loyalty rewards?", count: 14 },
          { q: "Can I change my shipping address after placing an order?", count: 8 },
          { q: "Do you ship internationally to New Zealand and UK?", count: 5 },
        ]
      : [
          { q: "Do you accept private health insurance and on-the-spot HICAPS claims?", count: 19 },
          { q: "Do you treat children and adolescents under 12 years old?", count: 7 },
          { q: "Is patient parking available onsite or on the street?", count: 4 },
        ];

    for (const item of questions) {
      const qId = "unq_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO unanswered_questions (id, organization_id, question, frequency_count, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(qId, orgId, item.q, item.count);
    }

    // 3. Seed Conversations & Messages
    if (isEcom) {
      const c1Id = "cnv_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO conversations (id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, external_ref)
        VALUES (?, ?, ?, ?, 'web', 'WAITING_FOR_HUMAN', 'Human needed', 'My jacket arrived damaged, I want a refund.', 'Order #10790')
      `).run(c1Id, orgId, "Daniel Ortiz", "daniel@mail.com");

      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c1Id, "client", "My jacket arrived damaged, I want a refund.");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c1Id, "ai", "I'm so sorry about that! Refund requests require our support team, so I am escalating you to staff right now.");

      const c2Id = "cnv_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO conversations (id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, external_ref)
        VALUES (?, ?, ?, ?, 'web', 'RESOLVED', 'AI Resolved', 'Order #10842 is in transit via FedEx Express and arrives tomorrow by 4:00 PM.', 'Order #10842')
      `).run(c2Id, orgId, "Priya Nair", "priya@mail.com");

      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c2Id, "client", "Where is my order #10842?");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c2Id, "ai", "Order #10842 is in transit via FedEx Express and arrives tomorrow by 4:00 PM.");

      // Seed Orders
      db.prepare(`
        INSERT INTO orders (id, organization_id, order_number, customer_name, customer_email, total_amount, currency, tracking_carrier, tracking_status, external_id)
        VALUES (?, ?, ?, ?, ?, ?, 'AUD', 'FedEx', 'in_transit', 'SH-84920')
      `).run("ord_" + randomBytes(6).toString("hex"), orgId, "#10842", "Priya Nair", "priya@mail.com", 158.00);

      db.prepare(`
        INSERT INTO orders (id, organization_id, order_number, customer_name, customer_email, total_amount, currency, tracking_carrier, tracking_status, external_id)
        VALUES (?, ?, ?, ?, ?, ?, 'AUD', 'Australia Post', 'delivered', 'SH-84711')
      `).run("ord_" + randomBytes(6).toString("hex"), orgId, "#10790", "Daniel Ortiz", "daniel@mail.com", 120.00);
    } else {
      const c1Id = "cnv_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO conversations (id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, external_ref)
        VALUES (?, ?, ?, ?, 'web', 'WAITING_FOR_HUMAN', 'Human needed', 'I want to discuss my treatment with someone.', 'Initial Consult Request')
      `).run(c1Id, orgId, "Anna Brooks", "anna@mail.com");

      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c1Id, "client", "Hi, I had knee surgery last month.");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c1Id, "ai", "Sorry to hear that! I can help with bookings and clinic info. Would you like to book a rehabilitation appointment?");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c1Id, "client", "I want to discuss my treatment with someone.");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c1Id, "ai", "Of course. I'll connect you with our reception team right away.");

      const c2Id = "cnv_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO conversations (id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, external_ref)
        VALUES (?, ?, ?, ?, 'web', 'RESOLVED', 'AI Resolved', 'Your appointment has been confirmed for tomorrow at 10:30 AM.', 'Cliniko #CL-48213')
      `).run(c2Id, orgId, "John Smith", "john@example.com");

      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c2Id, "client", "Can I book a physiotherapy appointment tomorrow?");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c2Id, "ai", "Sure! Tomorrow we have availability at 9:00 AM and 10:30 AM with Dr. Sarah Lee. Which would you prefer?");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c2Id, "client", "10:30 AM please.");
      db.prepare(`INSERT INTO messages (id, conversation_id, sender, content) VALUES (?, ?, ?, ?)`).run("msg_" + randomBytes(6).toString("hex"), c2Id, "ai", "✓ Your appointment has been confirmed in Cliniko for tomorrow at 10:30 AM.");

      // Seed Appointments
      db.prepare(`
        INSERT INTO appointments (id, organization_id, conversation_id, patient_name, patient_contact, practitioner_name, service_name, start_time, status, source, external_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'ai_booked', 'CL-48213')
      `).run("apt_" + randomBytes(6).toString("hex"), orgId, c2Id, "John Smith", "john@example.com", "Dr. Sarah Lee", "Initial Consultation (60 min)", new Date(Date.now() + 86400000).toISOString());

      db.prepare(`
        INSERT INTO appointments (id, organization_id, conversation_id, patient_name, patient_contact, practitioner_name, service_name, start_time, status, source, external_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'receptionist', 'CL-48190')
      `).run("apt_" + randomBytes(6).toString("hex"), orgId, null, "Emma Wilson", "emma@example.com", "Dr. Mark Howard", "Sports Injury Follow-up", new Date(Date.now() + 172800000).toISOString());
    }

    // 4. Seed Leads
    db.prepare(`
      INSERT INTO leads (id, organization_id, name, email, phone, intent, status)
      VALUES (?, ?, ?, ?, ?, ?, 'new')
    `).run("lead_" + randomBytes(6).toString("hex"), orgId, isEcom ? "Marcus Bell" : "David Vance", isEcom ? "marcus@supplyco.com" : "david.vance@gmail.com", "+61 412 884 912", isEcom ? "Bulk Wholesale Inquiry" : "Corporate Physio Package");

    // 5. Seed Integrations
    db.prepare(`
      INSERT INTO integrations (id, organization_id, provider, status, config_json)
      VALUES (?, ?, ?, 'connected', ?)
    `).run("int_" + randomBytes(6).toString("hex"), orgId, isEcom ? "shopify" : "cliniko", JSON.stringify({ syncedEntities: ["orders", "inventory", "appointments"] }));

    db.prepare(`
      INSERT INTO integrations (id, organization_id, provider, status, config_json)
      VALUES (?, ?, ?, 'connected', ?)
    `).run("int_" + randomBytes(6).toString("hex"), orgId, "web_widget", JSON.stringify({ version: "2.4.0", status: "active" }));
  });
}

// Seed default demo user if table is empty
const countUser = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
if (countUser.cnt === 0) {
  withTransaction(() => {
    const orgId = "org_demo_101";
    const userId = "usr_demo_101";
    const agentId = "agt_demo_101";

    db.prepare(`
      INSERT INTO organizations (id, name, industry, plan)
      VALUES (?, ?, ?, ?)
    `).run(orgId, "Healing Hands Physio", "clinic", "growth");

    const { hash, salt } = hashPassword("password123");
    db.prepare(`
      INSERT INTO users (id, organization_id, email, name, password_hash, salt, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, orgId, "demo@frontdesk.ai", "Dr. Sarah Lee", hash, salt, "owner");

    db.prepare(`
      INSERT INTO agents (id, organization_id, name, greeting, color, position, tone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(agentId, orgId, "Maya", "Hi! Welcome to Healing Hands Physio. How can I help you today?", "#0d9488", "right", "Friendly");
  });

  seedOrganizationData("org_demo_101", "clinic", "Healing Hands Physio");
} else {
  // Ensure demo org data is seeded if tables were added later
  seedOrganizationData("org_demo_101", "clinic", "Healing Hands Physio");
}

export { db };
