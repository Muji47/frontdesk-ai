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

// Initialize tables
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT NOT NULL DEFAULT 'clinic',
    plan TEXT NOT NULL DEFAULT 'growth',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Maya',
    greeting TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#0d9488',
    position TEXT NOT NULL DEFAULT 'right',
    tone TEXT NOT NULL DEFAULT 'Friendly',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  );
`);

// Password utilities
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const hashedBuf = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const storedBuf = Buffer.from(hash, "hex");
  return timingSafeEqual(hashedBuf, storedBuf);
}

// Seed demo account if empty
const countUser = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
if (countUser.cnt === 0) {
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
}

export { db };
