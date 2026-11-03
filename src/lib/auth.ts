import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db, hashPassword, verifyPassword } from "./db";

export const SESSION_COOKIE_NAME = "frontdesk_session";

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
  orgName: string;
  industry: string;
  plan: string;
  agentId?: string;
  agentName?: string;
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const row = db.prepare(`
    SELECT 
      u.id as userId,
      u.email,
      u.name,
      u.role,
      o.id as orgId,
      o.name as orgName,
      o.industry,
      o.plan,
      a.id as agentId,
      a.name as agentName,
      s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    JOIN organizations o ON u.organization_id = o.id
    LEFT JOIN agents a ON a.organization_id = o.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as (UserSession & { expires_at: string }) | undefined;

  if (!row) return null;

  return {
    userId: row.userId,
    email: row.email,
    name: row.name,
    role: row.role,
    orgId: row.orgId,
    orgName: row.orgName,
    industry: row.industry,
    plan: row.plan,
    agentId: row.agentId,
    agentName: row.agentName,
  };
}

export function createSession(userId: string): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt.toISOString());

  return { token, expiresAt };
}

export function deleteSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function registerUser(params: {
  businessName: string;
  industry: string;
  name: string;
  email: string;
  password: string;
}): { userId: string; orgId: string } {
  const orgId = "org_" + randomBytes(8).toString("hex");
  const userId = "usr_" + randomBytes(8).toString("hex");
  const agentId = "agt_" + randomBytes(8).toString("hex");

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(params.email);
  if (existing) {
    throw new Error("An account with this email already exists");
  }

  db.prepare(`
    INSERT INTO organizations (id, name, industry, plan)
    VALUES (?, ?, ?, 'growth')
  `).run(orgId, params.businessName, params.industry);

  const { hash, salt } = hashPassword(params.password);
  db.prepare(`
    INSERT INTO users (id, organization_id, email, name, password_hash, salt, role)
    VALUES (?, ?, ?, ?, ?, ?, 'owner')
  `).run(userId, orgId, params.email, params.name, hash, salt);

  const defaultGreeting = params.industry === "ecommerce"
    ? `Hi! Welcome to ${params.businessName}. Looking for a product or need to track an order?`
    : `Hi! Welcome to ${params.businessName}. How can I assist you with appointment bookings or questions today?`;

  const defaultColor = params.industry === "ecommerce" ? "#4f46e5" : "#0d9488";

  db.prepare(`
    INSERT INTO agents (id, organization_id, name, greeting, color, position, tone)
    VALUES (?, ?, 'Alex', ?, ?, 'right', 'Friendly')
  `).run(agentId, orgId, defaultGreeting, defaultColor);

  return { userId, orgId };
}

export function loginUser(email: string, password: string): { userId: string } {
  const user = db.prepare(`
    SELECT id, password_hash, salt
    FROM users
    WHERE email = ?
  `).get(email) as { id: string; password_hash: string; salt: string } | undefined;

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  return { userId: user.id };
}
