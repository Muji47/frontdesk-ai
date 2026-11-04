import { randomBytes } from "node:crypto";
import { db, hashPassword, verifyPassword, dummyPasswordCheck, withTransaction } from "@/lib/db";
import {
  RegisterInputSchema,
  LoginInputSchema,
  type RegisterInput,
  type LoginInput,
} from "@/server/validators/auth";
import { ConflictError, UnauthorizedError } from "@/server/errors";

export interface AuthSessionUser {
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

export interface AuthResult {
  user: AuthSessionUser;
  token: string;
  expiresAt: Date;
}

export class AuthService {
  /**
   * Registers a new tenant: Atomic creation of Organization, User (Owner), and Default Agent.
   */
  public static register(rawInput: unknown): AuthResult {
    const input: RegisterInput = RegisterInputSchema.parse(rawInput);

    // 1. Conflict check
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(input.email);
    if (existing) {
      throw new ConflictError("An account with this email address already exists. Please log in instead.");
    }

    const orgId = "org_" + randomBytes(8).toString("hex");
    const userId = "usr_" + randomBytes(8).toString("hex");
    const agentId = "agt_" + randomBytes(8).toString("hex");

    const { hash, salt } = hashPassword(input.password);

    // 2. Atomic database transaction
    withTransaction(() => {
      db.prepare(`
        INSERT INTO organizations (id, name, industry, plan)
        VALUES (?, ?, ?, 'growth')
      `).run(orgId, input.businessName, input.industry);

      db.prepare(`
        INSERT INTO users (id, organization_id, email, name, password_hash, salt, role)
        VALUES (?, ?, ?, ?, ?, ?, 'owner')
      `).run(userId, orgId, input.email, input.name, hash, salt);

      const defaultGreeting =
        input.industry === "ecommerce"
          ? `Hi! Welcome to ${input.businessName}. Looking for a product or need to track an order?`
          : `Hi! Welcome to ${input.businessName}. How can I assist you with appointment bookings or questions today?`;

      const defaultColor = input.industry === "ecommerce" ? "#4f46e5" : "#0d9488";
      const defaultAgentName = input.industry === "ecommerce" ? "Aria" : "Maya";

      db.prepare(`
        INSERT INTO agents (id, organization_id, name, greeting, color, position, tone)
        VALUES (?, ?, ?, ?, ?, 'right', 'Friendly')
      `).run(agentId, orgId, defaultAgentName, defaultGreeting, defaultColor);
    });

    // 3. Issue Session Token
    const { token, expiresAt } = this.createSession(userId);

    return {
      token,
      expiresAt,
      user: {
        userId,
        email: input.email,
        name: input.name,
        role: "owner",
        orgId,
        orgName: input.businessName,
        industry: input.industry,
        plan: "growth",
        agentId,
        agentName: input.industry === "ecommerce" ? "Aria" : "Maya",
      },
    };
  }

  /**
   * Authenticates an existing user and issues a session token.
   * Includes timing defense against user enumeration.
   */
  public static login(rawInput: unknown): AuthResult {
    const input: LoginInput = LoginInputSchema.parse(rawInput);

    const user = db.prepare(`
      SELECT 
        u.id as userId,
        u.email,
        u.name,
        u.password_hash,
        u.salt,
        u.role,
        o.id as orgId,
        o.name as orgName,
        o.industry,
        o.plan,
        a.id as agentId,
        a.name as agentName
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN agents a ON a.organization_id = o.id
      WHERE u.email = ?
    `).get(input.email) as (AuthSessionUser & { password_hash: string; salt: string }) | undefined;

    if (!user) {
      dummyPasswordCheck();
      throw new UnauthorizedError("Incorrect email or password.");
    }

    const isValid = verifyPassword(input.password, user.password_hash, user.salt);
    if (!isValid) {
      throw new UnauthorizedError("Incorrect email or password.");
    }

    const { token, expiresAt } = this.createSession(user.userId);

    return {
      token,
      expiresAt,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        orgName: user.orgName,
        industry: user.industry,
        plan: user.plan,
        agentId: user.agentId,
        agentName: user.agentName,
      },
    };
  }

  /**
   * Verifies and fetches user details from an active session token.
   */
  public static getSessionUser(token: string): AuthSessionUser | null {
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
        a.name as agentName
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN agents a ON a.organization_id = o.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token) as AuthSessionUser | undefined;

    return row || null;
  }

  /**
   * Invalidates a session token.
   */
  public static revokeSession(token: string): void {
    if (token) {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    }
  }

  private static createSession(userId: string): { token: string; expiresAt: Date } {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days expiration

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, userId, expiresAt.toISOString());

    return { token, expiresAt };
  }
}
