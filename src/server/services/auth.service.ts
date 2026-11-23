import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { db, hashPassword, verifyPassword, dummyPasswordCheck, withTransaction, seedOrganizationData } from "@/lib/db";
import {
  RegisterInputSchema,
  LoginInputSchema,
  type RegisterInput,
  type LoginInput,
} from "@/server/validators/auth";
import { ConflictError, UnauthorizedError } from "@/server/errors";

export interface VaultAccount {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: string;
  isSuperadmin: boolean;
  orgId: string;
  orgName: string;
  industry: string;
  plan: string;
  agentId: string;
  agentName: string;
}

const globalForAuth = globalThis as unknown as {
  __echoUserVault?: Map<string, VaultAccount>;
};
const globalUserVault = globalForAuth.__echoUserVault ?? new Map<string, VaultAccount>();
globalForAuth.__echoUserVault = globalUserVault;

export interface AuthSessionUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  isSuperadmin?: boolean;
  impersonatedBy?: {
    userId: string;
    email: string;
    name: string;
  };
  orgId: string;
  orgName: string;
  industry: string;
  plan: string;
  canEditCompanyTemplates?: boolean;
  agentId?: string;
  agentName?: string;
}

export interface AuthResult {
  user: AuthSessionUser;
  token: string;
  expiresAt: Date;
}

export class AuthService {
  private static getSessionSecret(): string {
    return process.env.SESSION_SECRET || "echo-frontdesk-secure-secret-key-2026";
  }

  public static signVaultPayload(accounts: Record<string, VaultAccount>): string {
    const json = JSON.stringify(accounts);
    const hmac = createHmac("sha256", this.getSessionSecret()).update(json).digest("hex");
    return `v_${Buffer.from(json).toString("base64url")}.${hmac}`;
  }

  public static verifyVaultPayload(token: string): Record<string, VaultAccount> | null {
    if (!token || !token.startsWith("v_")) return null;
    const parts = token.slice(2).split(".");
    if (parts.length !== 2) return null;
    const [encodedPayload, receivedHmac] = parts;
    try {
      const json = Buffer.from(encodedPayload, "base64url").toString("utf-8");
      const expectedHmac = createHmac("sha256", this.getSessionSecret()).update(json).digest("hex");
      const receivedBuf = Buffer.from(receivedHmac);
      const expectedBuf = Buffer.from(expectedHmac);
      if (receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf)) {
        return JSON.parse(json);
      }
    } catch {
      return null;
    }
    return null;
  }

  private static signTokenPayload(payload: string): string {
    const hmac = createHmac("sha256", this.getSessionSecret()).update(payload).digest("hex");
    return `s_${Buffer.from(payload).toString("base64url")}.${hmac}`;
  }

  private static verifyTokenPayload(token: string): string | null {
    if (!token.startsWith("s_")) return null;
    const parts = token.slice(2).split(".");
    if (parts.length !== 2) return null;

    const [encodedPayload, receivedHmac] = parts;
    try {
      const payload = Buffer.from(encodedPayload, "base64url").toString("utf-8");
      const expectedHmac = createHmac("sha256", this.getSessionSecret()).update(payload).digest("hex");

      const receivedBuf = Buffer.from(receivedHmac);
      const expectedBuf = Buffer.from(expectedHmac);
      if (receivedBuf.length === expectedBuf.length && timingSafeEqual(receivedBuf, expectedBuf)) {
        return payload;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Registers a new tenant: Atomic creation of Organization, User (Owner), and Default Agent.
   */
  public static register(rawInput: unknown, existingVaultToken?: string | null): AuthResult & { vaultToken: string } {
    const input: RegisterInput = RegisterInputSchema.parse(rawInput);
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Conflict check
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(normalizedEmail);
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
      `).run(userId, orgId, normalizedEmail, input.name, hash, salt);

      const defaultGreeting =
        input.industry === "ecommerce"
          ? `Hi! Welcome to ${input.businessName}. Looking for a product or need to track an order?`
          : input.industry === "realestate"
          ? `Hi! Welcome to ${input.businessName}. Looking to buy, rent, or schedule a property inspection?`
          : input.industry === "beauty"
          ? `Hi! Welcome to ${input.businessName}. Looking to book a treatment or view our service menu?`
          : `Hi! Welcome to ${input.businessName}. How can I assist you with appointment bookings or questions today?`;

      const defaultColor =
        input.industry === "ecommerce"
          ? "#4f46e5"
          : input.industry === "realestate"
          ? "#2563eb"
          : input.industry === "beauty"
          ? "#9333ea"
          : "#0d9488";

      const defaultAgentName =
        input.industry === "ecommerce"
          ? "Aria"
          : input.industry === "realestate"
          ? "Sam"
          : input.industry === "beauty"
          ? "Lexi"
          : "Maya";

      db.prepare(`
        INSERT INTO agents (id, organization_id, name, greeting, color, position, tone)
        VALUES (?, ?, ?, ?, ?, 'right', 'Friendly')
      `).run(agentId, orgId, defaultAgentName, defaultGreeting, defaultColor);
    });

    // Seed realistic initial operational data for the new organization
    seedOrganizationData(orgId, input.industry, input.businessName);

    const agentName =
      input.industry === "ecommerce"
        ? "Aria"
        : input.industry === "realestate"
        ? "Sam"
        : input.industry === "beauty"
        ? "Lexi"
        : "Maya";

    // 3. Update vault accounts
    let accounts: Record<string, VaultAccount> = {};
    if (existingVaultToken) {
      accounts = this.verifyVaultPayload(existingVaultToken) || {};
    }
    const vaultAccount: VaultAccount = {
      userId,
      email: normalizedEmail,
      name: input.name,
      passwordHash: hash,
      salt,
      role: "owner",
      isSuperadmin: false,
      orgId,
      orgName: input.businessName,
      industry: input.industry,
      plan: "growth",
      agentId,
      agentName,
    };
    accounts[normalizedEmail] = vaultAccount;
    globalUserVault.set(normalizedEmail, vaultAccount);
    const vaultToken = this.signVaultPayload(accounts);

    // 4. Issue Self-Contained Session Token
    const userSession: AuthSessionUser = {
      userId,
      email: normalizedEmail,
      name: input.name,
      role: "owner",
      isSuperadmin: false,
      orgId,
      orgName: input.businessName,
      industry: input.industry,
      plan: "growth",
      agentId,
      agentName,
    };
    const { token, expiresAt } = this.createSession(userId, userSession);

    return {
      token,
      expiresAt,
      vaultToken,
      user: userSession,
    };
  }

  /**
   * Authenticates an existing user and issues a session token.
   * Includes timing defense against user enumeration.
   */
  public static login(rawInput: unknown, existingVaultToken?: string | null): AuthResult & { vaultToken?: string } {
    const input: LoginInput = LoginInputSchema.parse(rawInput);
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Try local SQLite query first
    let user = db.prepare(`
      SELECT 
        u.id as userId,
        u.email,
        u.name,
        u.password_hash,
        u.salt,
        u.role,
        u.is_superadmin as isSuperadmin,
        o.id as orgId,
        o.name as orgName,
        o.industry,
        o.plan,
        a.id as agentId,
        a.name as agentName
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN agents a ON a.organization_id = o.id
      WHERE LOWER(u.email) = ?
    `).get(normalizedEmail) as any;

    let updatedVaultToken: string | undefined = undefined;

    // 2. If not found in local SQLite, check global memory vault or vault cookie
    if (!user) {
      let vaultAccount = globalUserVault.get(normalizedEmail);
      if (!vaultAccount && existingVaultToken) {
        const accounts = this.verifyVaultPayload(existingVaultToken);
        if (accounts && accounts[normalizedEmail]) {
          vaultAccount = accounts[normalizedEmail];
          globalUserVault.set(normalizedEmail, vaultAccount);
        }
      }

      if (vaultAccount) {
        const isValid = verifyPassword(input.password, vaultAccount.passwordHash, vaultAccount.salt);
        if (!isValid) {
          throw new UnauthorizedError("Incorrect email or password.");
        }

        // Auto-provision into local SQLite container
        withTransaction(() => {
          db.prepare(`
            INSERT OR IGNORE INTO organizations (id, name, industry, plan)
            VALUES (?, ?, ?, ?)
          `).run(vaultAccount.orgId, vaultAccount.orgName, vaultAccount.industry, vaultAccount.plan);

          db.prepare(`
            INSERT OR IGNORE INTO users (id, organization_id, email, name, password_hash, salt, role, is_superadmin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            vaultAccount.userId,
            vaultAccount.orgId,
            vaultAccount.email,
            vaultAccount.name,
            vaultAccount.passwordHash,
            vaultAccount.salt,
            vaultAccount.role,
            vaultAccount.isSuperadmin ? 1 : 0
          );

          db.prepare(`
            INSERT OR IGNORE INTO agents (id, organization_id, name, greeting, color, position, tone)
            VALUES (?, ?, ?, ?, ?, 'right', 'Friendly')
          `).run(
            vaultAccount.agentId,
            vaultAccount.orgId,
            vaultAccount.agentName,
            `Hi! Welcome to ${vaultAccount.orgName}. How can I assist you today?`,
            vaultAccount.industry === "ecommerce" ? "#4f46e5" : "#0d9488"
          );

          seedOrganizationData(vaultAccount.orgId, vaultAccount.industry, vaultAccount.orgName);
        });

        user = {
          userId: vaultAccount.userId,
          email: vaultAccount.email,
          name: vaultAccount.name,
          password_hash: vaultAccount.passwordHash,
          salt: vaultAccount.salt,
          role: vaultAccount.role,
          isSuperadmin: vaultAccount.isSuperadmin ? 1 : 0,
          orgId: vaultAccount.orgId,
          orgName: vaultAccount.orgName,
          industry: vaultAccount.industry,
          plan: vaultAccount.plan,
          agentId: vaultAccount.agentId,
          agentName: vaultAccount.agentName,
        };
      }
    }

    if (!user) {
      dummyPasswordCheck();
      throw new UnauthorizedError("Incorrect email or password.");
    }

    const isValid = verifyPassword(input.password, user.password_hash, user.salt);
    if (!isValid) {
      throw new UnauthorizedError("Incorrect email or password.");
    }

    // Refresh memory vault and vault token
    if (!globalUserVault.has(normalizedEmail)) {
      const vAcc: VaultAccount = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        passwordHash: user.password_hash,
        salt: user.salt,
        role: user.role,
        isSuperadmin: Boolean(user.isSuperadmin === 1 || user.role === "superadmin"),
        orgId: user.orgId,
        orgName: user.orgName,
        industry: user.industry,
        plan: user.plan,
        agentId: user.agentId,
        agentName: user.agentName,
      };
      globalUserVault.set(normalizedEmail, vAcc);
      let accounts: Record<string, VaultAccount> = {};
      if (existingVaultToken) {
        accounts = this.verifyVaultPayload(existingVaultToken) || {};
      }
      accounts[normalizedEmail] = vAcc;
      updatedVaultToken = this.signVaultPayload(accounts);
    }

    const sessionUser: AuthSessionUser = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperadmin: Boolean(user.isSuperadmin === 1 || user.role === "superadmin"),
      orgId: user.orgId,
      orgName: user.orgName,
      industry: user.industry,
      plan: user.plan,
      agentId: user.agentId,
      agentName: user.agentName,
    };

    const { token, expiresAt } = this.createSession(user.userId, sessionUser);

    return {
      token,
      expiresAt,
      vaultToken: updatedVaultToken,
      user: sessionUser,
    };
  }

  private static formatSessionUser(row: {
    userId: string;
    email: string;
    name: string;
    role: string;
    isSuperadmin?: number;
    userCanEditTemplates?: number;
    orgAllowTemplates?: number;
    impersonatedByUserId?: string | null;
    orgId: string;
    orgName: string;
    industry: string;
    plan: string;
    agentId?: string;
    agentName?: string;
  }): AuthSessionUser {
    let impersonatedBy: AuthSessionUser["impersonatedBy"] = undefined;
    if (row.impersonatedByUserId) {
      const superadminRow = db
        .prepare("SELECT id, name, email FROM users WHERE id = ?")
        .get(row.impersonatedByUserId) as { id: string; name: string; email: string } | undefined;
      if (superadminRow) {
        impersonatedBy = {
          userId: superadminRow.id,
          name: superadminRow.name,
          email: superadminRow.email,
        };
      }
    }

    const canEditCompanyTemplates =
      row.role === "owner" ||
      row.role === "admin" ||
      row.userCanEditTemplates === 1 ||
      row.orgAllowTemplates === 1;

    const isSuperadmin = Boolean(
      row.isSuperadmin === 1 ||
      row.role === "superadmin" ||
      impersonatedBy !== undefined
    );

    return {
      userId: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      isSuperadmin,
      impersonatedBy,
      orgId: row.orgId,
      orgName: row.orgName,
      industry: row.industry,
      plan: row.plan,
      canEditCompanyTemplates,
      agentId: row.agentId,
      agentName: row.agentName,
    };
  }

  private static fetchSessionUserById(
    userId: string,
    impersonatedByUserId: string | null,
    token?: string,
    expiresAt?: Date
  ): AuthSessionUser | null {
    const row = db.prepare(`
      SELECT 
        u.id as userId,
        u.email,
        u.name,
        u.role,
        u.is_superadmin as isSuperadmin,
        u.can_edit_company_templates as userCanEditTemplates,
        o.id as orgId,
        o.name as orgName,
        o.industry,
        o.plan,
        o.allow_subuser_template_editing as orgAllowTemplates,
        a.id as agentId,
        a.name as agentName
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN agents a ON a.organization_id = o.id
      WHERE u.id = ?
    `).get(userId) as any;

    if (!row) return null;

    if (token && expiresAt) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO sessions (token, user_id, expires_at, impersonated_by_user_id)
          VALUES (?, ?, ?, ?)
        `).run(token, userId, expiresAt.toISOString(), impersonatedByUserId);
      } catch {
        // Cache insert fail is safe to ignore
      }
    }

    return this.formatSessionUser({
      ...row,
      impersonatedByUserId,
    });
  }

  /**
   * Verifies and fetches user details from an active session token.
   */
  public static getSessionUser(token: string): AuthSessionUser | null {
    if (!token) return null;

    // 1. Try querying local container sessions table
    try {
      const row = db.prepare(`
        SELECT 
          u.id as userId,
          u.email,
          u.name,
          u.role,
          u.is_superadmin as isSuperadmin,
          u.can_edit_company_templates as userCanEditTemplates,
          s.impersonated_by_user_id as impersonatedByUserId,
          o.id as orgId,
          o.name as orgName,
          o.industry,
          o.plan,
          o.allow_subuser_template_editing as orgAllowTemplates,
          a.id as agentId,
          a.name as agentName
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN agents a ON a.organization_id = o.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `).get(token) as any;

      if (row) {
        return this.formatSessionUser(row);
      }
    } catch (err) {
      console.warn("Error querying local sessions table:", err);
    }

    // 2. If not found in local container sessions table, verify signed payload
    const rawPayload = this.verifyTokenPayload(token);
    if (!rawPayload) return null;

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      // Legacy format parsing: usr:userId:expiresAtMs:nonce or shw:targetUserId:superadminUserId:expiresAtMs:nonce
      const parts = rawPayload.split(":");
      if (parts[0] === "usr" && parts.length >= 4) {
        const userId = parts[1];
        const expiresAtMs = parseInt(parts[2], 10);
        if (expiresAtMs > Date.now()) {
          return this.fetchSessionUserById(userId, null, token, new Date(expiresAtMs));
        }
      } else if (parts[0] === "shw" && parts.length >= 5) {
        const targetUserId = parts[1];
        const superadminUserId = parts[2];
        const expiresAtMs = parseInt(parts[3], 10);
        if (expiresAtMs > Date.now()) {
          return this.fetchSessionUserById(targetUserId, superadminUserId, token, new Date(expiresAtMs));
        }
      }
      return null;
    }

    if (!parsed || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      return null;
    }

    // Ensure user & tenant exist in local SQLite container
    const localUser = db.prepare("SELECT id FROM users WHERE id = ?").get(parsed.userId);
    if (!localUser && parsed.orgId && parsed.email) {
      try {
        withTransaction(() => {
          db.prepare(`
            INSERT OR IGNORE INTO organizations (id, name, industry, plan)
            VALUES (?, ?, ?, ?)
          `).run(parsed.orgId, parsed.orgName || "Workspace", parsed.industry || "clinic", parsed.plan || "growth");

          db.prepare(`
            INSERT OR IGNORE INTO users (id, organization_id, email, name, password_hash, salt, role, is_superadmin)
            VALUES (?, ?, ?, ?, 'stateless_placeholder', 'stateless', ?, ?)
          `).run(parsed.userId, parsed.orgId, parsed.email, parsed.name, parsed.role || "owner", parsed.isSuperadmin ? 1 : 0);

          db.prepare(`
            INSERT OR IGNORE INTO agents (id, organization_id, name, greeting, color, position, tone)
            VALUES (?, ?, ?, ?, ?, 'right', 'Friendly')
          `).run(
            parsed.agentId || ("agt_" + parsed.orgId),
            parsed.orgId,
            parsed.agentName || "Maya",
            `Hi! Welcome to ${parsed.orgName}. How can I assist you today?`,
            parsed.industry === "ecommerce" ? "#4f46e5" : "#0d9488"
          );

          seedOrganizationData(parsed.orgId, parsed.industry || "clinic", parsed.orgName || "Workspace");
        });
      } catch (err) {
        console.warn("Could not auto-provision stateless user into local sqlite:", err);
      }
    }

    // Cache session in local sqlite
    try {
      db.prepare(`
        INSERT OR IGNORE INTO sessions (token, user_id, expires_at, impersonated_by_user_id)
        VALUES (?, ?, ?, ?)
      `).run(token, parsed.userId, new Date(parsed.expiresAt).toISOString(), parsed.impersonatedBy?.userId || null);
    } catch {
      // Ignore cache failure
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      isSuperadmin: Boolean(parsed.isSuperadmin || parsed.role === "superadmin" || parsed.impersonatedBy),
      impersonatedBy: parsed.impersonatedBy,
      orgId: parsed.orgId,
      orgName: parsed.orgName,
      industry: parsed.industry,
      plan: parsed.plan,
      canEditCompanyTemplates: parsed.role === "owner" || parsed.role === "admin",
      agentId: parsed.agentId,
      agentName: parsed.agentName,
    };
  }

  /**
   * Invalidates a session token.
   */
  public static revokeSession(token: string): void {
    if (token) {
      try {
        db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      } catch (err) {
        console.warn("Could not delete session from sqlite:", err);
      }
    }
  }

  public static createSession(userId: string, userDetails?: Partial<AuthSessionUser>): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days expiration
    const nonce = randomBytes(8).toString("hex");

    let userRow: any = userDetails;
    if (!userRow || !userRow.email || !userRow.orgId) {
      userRow = db.prepare(`
        SELECT 
          u.id as userId,
          u.email,
          u.name,
          u.role,
          u.is_superadmin as isSuperadmin,
          o.id as orgId,
          o.name as orgName,
          o.industry,
          o.plan,
          a.id as agentId,
          a.name as agentName
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN agents a ON a.organization_id = o.id
        WHERE u.id = ?
      `).get(userId);
    }

    const payloadObj = {
      type: "usr",
      userId,
      email: userRow?.email || "",
      name: userRow?.name || "User",
      role: userRow?.role || "owner",
      isSuperadmin: Boolean(userRow?.isSuperadmin === 1 || userRow?.isSuperadmin === true || userRow?.role === "superadmin"),
      orgId: userRow?.orgId || "",
      orgName: userRow?.orgName || "Workspace",
      industry: userRow?.industry || "clinic",
      plan: userRow?.plan || "growth",
      agentId: userRow?.agentId || ("agt_" + (userRow?.orgId || "")),
      agentName: userRow?.agentName || "Maya",
      expiresAt: expiresAt.getTime(),
      nonce,
    };

    const token = this.signTokenPayload(JSON.stringify(payloadObj));

    try {
      db.prepare(`
        INSERT INTO sessions (token, user_id, expires_at)
        VALUES (?, ?, ?)
      `).run(token, userId, expiresAt.toISOString());
    } catch (err) {
      console.warn("Could not insert session into local sqlite:", err);
    }

    return { token, expiresAt };
  }

  public static createShadowSession(targetUserId: string, superadminUserId: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 4); // 4 hours shadow session
    const nonce = randomBytes(8).toString("hex");

    const targetUser = db.prepare(`
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
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN agents a ON a.organization_id = o.id
      WHERE u.id = ?
    `).get(targetUserId) as any;

    const superadminUser = db.prepare(`
      SELECT id, name, email FROM users WHERE id = ?
    `).get(superadminUserId) as any;

    const payloadObj = {
      type: "shw",
      userId: targetUserId,
      email: targetUser?.email || "",
      name: targetUser?.name || "User",
      role: targetUser?.role || "owner",
      isSuperadmin: true,
      orgId: targetUser?.orgId || "",
      orgName: targetUser?.orgName || "Practice",
      industry: targetUser?.industry || "clinic",
      plan: targetUser?.plan || "growth",
      agentId: targetUser?.agentId || "",
      agentName: targetUser?.agentName || "Maya",
      impersonatedBy: superadminUser ? {
        userId: superadminUser.id,
        name: superadminUser.name,
        email: superadminUser.email,
      } : undefined,
      expiresAt: expiresAt.getTime(),
      nonce,
    };

    const token = this.signTokenPayload(JSON.stringify(payloadObj));

    try {
      db.prepare(`
        INSERT INTO sessions (token, user_id, expires_at, impersonated_by_user_id)
        VALUES (?, ?, ?, ?)
      `).run(token, targetUserId, expiresAt.toISOString(), superadminUserId);
    } catch (err) {
      console.warn("Could not insert shadow session into local sqlite:", err);
    }

    return { token, expiresAt };
  }
}
