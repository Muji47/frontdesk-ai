import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const runtimeRoot = process.env.INIT_CWD || [process.cwd()].join("");
const legacyDataDir = [runtimeRoot, "data"].join(path.sep);
// Store active SQLite DB inside node_modules/.cache so Next.js 16 Turbopack watcher never triggers HMR reload loops on SQLite WAL writes
const dataDir = [runtimeRoot, "node_modules", ".cache", "frontdesk-sqlite"].join(path.sep);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = [dataDir, "frontdesk.sqlite"].join(path.sep);
const legacyDbPath = [legacyDataDir, "frontdesk.sqlite"].join(path.sep);
if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
  try {
    fs.copyFileSync(legacyDbPath, dbPath);
  } catch {
    // ignore copy error
  }
}
const globalForDb = globalThis as unknown as {
  __echoSqliteDb?: DatabaseSync;
  __echoSqliteInitialized?: boolean;
};

const db = globalForDb.__echoSqliteDb ?? new DatabaseSync(dbPath);
globalForDb.__echoSqliteDb = db;

// Enforce foreign key constraints and Write-Ahead Logging once per process
if (!globalForDb.__echoSqliteInitialized) {
  globalForDb.__echoSqliteInitialized = true;
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

// Idempotent column migrations for Sprint 2.1 (AI Handover & Escalation tracking)
try {
  const convColumns = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
  const colNames = new Set(convColumns.map((c) => c.name));

  if (!colNames.has("is_ai_muted")) {
    db.exec("ALTER TABLE conversations ADD COLUMN is_ai_muted INTEGER NOT NULL DEFAULT 0");
  }
  if (!colNames.has("escalation_reason")) {
    db.exec("ALTER TABLE conversations ADD COLUMN escalation_reason TEXT");
  }
  if (!colNames.has("escalation_summary")) {
    db.exec("ALTER TABLE conversations ADD COLUMN escalation_summary TEXT");
  }
} catch (err) {
  console.error("Migration warning on conversations:", err);
}
}

// Ensure Billing tables & columns exist (safe to run idempotently across hot reloads)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT 'VISA',
      last4 TEXT NOT NULL,
      exp_month TEXT NOT NULL,
      exp_year TEXT NOT NULL,
      cardholder_name TEXT NOT NULL DEFAULT 'Clinic Account',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON payment_methods(organization_id);

    CREATE TABLE IF NOT EXISTS billing_invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      amount_cents INTEGER NOT NULL,
      amount_formatted TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Paid',
      card_summary TEXT,
      failure_reason TEXT,
      invoice_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON billing_invoices(organization_id, created_at DESC);
  `);

  const orgCols = db.prepare("PRAGMA table_info(organizations)").all() as { name: string }[];
  const orgColNames = new Set(orgCols.map((c) => c.name));
  if (!orgColNames.has("billing_cycle")) {
    db.exec("ALTER TABLE organizations ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly'");
  }
  if (!orgColNames.has("billing_currency")) {
    db.exec("ALTER TABLE organizations ADD COLUMN billing_currency TEXT NOT NULL DEFAULT 'AUD'");
  }
  if (!orgColNames.has("billing_provider")) {
    db.exec("ALTER TABLE organizations ADD COLUMN billing_provider TEXT NOT NULL DEFAULT 'lemonsqueezy'");
  }
  if (!orgColNames.has("external_customer_id")) {
    db.exec("ALTER TABLE organizations ADD COLUMN external_customer_id TEXT");
  }
  if (!orgColNames.has("external_subscription_id")) {
    db.exec("ALTER TABLE organizations ADD COLUMN external_subscription_id TEXT");
  }
  if (!orgColNames.has("customer_portal_url")) {
    db.exec("ALTER TABLE organizations ADD COLUMN customer_portal_url TEXT");
  }

  const invCols = db.prepare("PRAGMA table_info(billing_invoices)").all() as { name: string }[];
  const invColNames = new Set(invCols.map((c) => c.name));
  if (!invColNames.has("currency")) {
    db.exec("ALTER TABLE billing_invoices ADD COLUMN currency TEXT NOT NULL DEFAULT 'AUD'");
  }
  if (!invColNames.has("external_invoice_id")) {
    db.exec("ALTER TABLE billing_invoices ADD COLUMN external_invoice_id TEXT");
  }
} catch (err) {
  console.error("Billing schema migration warning:", err);
}

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
 * No-op seed function: all organizations (including Healing Hands Physio) start with a clean, empty state.
 */
export function seedOrganizationData(_orgId: string, _industry: string, _businessName: string) {
  return;
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
    `).run(userId, orgId, "demo@echo.ai", "Dr. Sarah Lee", hash, salt, "owner");

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
