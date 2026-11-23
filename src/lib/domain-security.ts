import { db } from "@/lib/db";

export interface DomainSecurityCheckResult {
  allowed: boolean;
  reason?: string;
  origin: string | null;
  allowedDomains: string[];
}

/**
 * Parses raw comma-, space-, or newline-separated domains into a sanitized array.
 * If empty or contains "*", returns ["*"].
 */
export function parseAllowedDomains(raw: string | null | undefined): string[] {
  if (!raw || raw.trim() === "") return ["*"];
  const list = raw
    .split(/[\n,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : ["*"];
}

/**
 * Extracts and normalizes the hostname from an Origin, Referer, or domain string.
 */
export function extractHostname(originOrReferer: string | null): string {
  if (!originOrReferer) return "";
  try {
    const parsed = new URL(originOrReferer);
    return parsed.hostname.toLowerCase();
  } catch {
    // If not a full URL, strip protocol and paths manually
    return originOrReferer
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0];
  }
}

/**
 * Validates whether an incoming HTTP Origin or Referer matches the organization's allowed domains.
 */
export function isDomainAllowed(
  originOrReferer: string | null,
  allowedDomainsRaw: string | null | undefined
): boolean {
  const allowedList = parseAllowedDomains(allowedDomainsRaw);

  // Permissive mode: "*" allows all origins
  if (allowedList.includes("*")) {
    return true;
  }

  // If no origin or referer is present (e.g. direct hosted link / mobile app / server test),
  // allow access so the hosted chat page works seamlessly without false blocks
  if (!originOrReferer) {
    return true;
  }

  const hostname = extractHostname(originOrReferer);
  if (!hostname) return true;

  // Always allow native application host environments (Vercel deployments, localhost dev)
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vercel.app") ||
    hostname.endsWith(".echo.ai")
  ) {
    return true;
  }

  return allowedList.some((pattern) => {
    if (pattern === "*" || pattern === hostname) return true;

    // Wildcard subdomain e.g. *.example.com or *.domain.com.au
    if (pattern.startsWith("*.")) {
      const root = pattern.slice(2);
      return hostname === root || hostname.endsWith("." + root);
    }

    const cleanPattern = pattern
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0];

    return hostname === cleanPattern || hostname.endsWith("." + cleanPattern);
  });
}

/**
 * Checks database configuration for an organization and validates the origin.
 */
export function checkOrganizationDomain(
  orgId: string,
  originOrReferer: string | null
): DomainSecurityCheckResult {
  try {
    const row = db
      .prepare("SELECT allowed_domains FROM organizations WHERE id = ?")
      .get(orgId) as { allowed_domains?: string } | undefined;

    const allowedDomainsRaw = row?.allowed_domains ?? "*";
    const allowedList = parseAllowedDomains(allowedDomainsRaw);
    const allowed = isDomainAllowed(originOrReferer, allowedDomainsRaw);

    return {
      allowed,
      origin: originOrReferer,
      allowedDomains: allowedList,
      reason: allowed
        ? undefined
        : `Origin '${originOrReferer}' is not authorized to access this AI receptionist. Whitelist this domain in your Echo.ai Dashboard to protect your AI credits.`,
    };
  } catch (err) {
    console.warn("Domain check error fallback:", err);
    return { allowed: true, origin: originOrReferer, allowedDomains: ["*"] };
  }
}
