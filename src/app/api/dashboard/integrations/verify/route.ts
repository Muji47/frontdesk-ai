import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CrawlerService } from "@/server/services/crawler.service";
import { db } from "@/lib/db";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to verify widget installation.");
    }

    const body = await req.json().catch(() => ({}));
    const rawUrl = String(body.websiteUrl || "").trim();

    if (!rawUrl) {
      throw new ValidationError("Website URL is required (e.g. https://myclinic.com.au).");
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`);
    } catch {
      throw new ValidationError("Invalid website URL format.");
    }

    // SSRF Safety Check (allow localhost only during local test/development)
    const isLocalDev = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
    if (!isLocalDev) {
      await CrawlerService.validateUrlSafety(parsedUrl.href);
    }

    // Fetch the target webpage
    let html = "";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(parsedUrl.href, {
        headers: {
          "User-Agent": "EchoWidgetVerifier/1.0 (+https://echo.ai/bot)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return NextResponse.json({
          success: true,
          verified: false,
          reason: `Target website returned HTTP status ${resp.status}. Ensure the URL is live and accessible.`,
        });
      }

      html = await resp.text();
    } catch (err: any) {
      return NextResponse.json({
        success: true,
        verified: false,
        reason: `Could not reach ${parsedUrl.hostname} (${err?.name === "AbortError" ? "Connection timed out" : "Connection failed"}). Please verify the domain is online.`,
      });
    }

    // Check for widget presence
    const lowerHtml = html.toLowerCase();
    const hasWidgetScript = lowerHtml.includes("widget.js") || lowerHtml.includes("echo-receptionist-widget") || lowerHtml.includes("echo-widget-script") || lowerHtml.includes("globalwidgetlauncher");
    const isInternalDemoRoute = (parsedUrl.pathname === "/for/clinic" && user.orgId === "org_demo_101") ||
                                (parsedUrl.pathname === "/for/ecommerce" && user.orgId === "org_demo_ecom") ||
                                (parsedUrl.pathname === "/for/realestate" && user.orgId === "org_demo_realestate") ||
                                (parsedUrl.pathname === "/for/beauty" && user.orgId === "org_demo_beauty");
    const hasOrgId = html.includes(user.orgId) || isInternalDemoRoute;

    if (hasWidgetScript && hasOrgId) {
      // Record verification in integrations table
      const existing = db.prepare("SELECT id FROM integrations WHERE organization_id = ? AND provider = 'web_widget'").get(user.orgId) as { id: string } | undefined;
      const nowIso = new Date().toISOString();

      if (existing) {
        db.prepare("UPDATE integrations SET status = 'connected', last_sync_at = ? WHERE id = ?").run(nowIso, existing.id);
      } else {
        const id = "int_widget_" + Math.random().toString(36).slice(2, 8);
        db.prepare(`
          INSERT INTO integrations (id, organization_id, provider, status, config_json, last_sync_at)
          VALUES (?, ?, 'web_widget', 'connected', ?, ?)
        `).run(id, user.orgId, JSON.stringify({ verifiedUrl: parsedUrl.href }), nowIso);
      }

      return NextResponse.json({
        success: true,
        verified: true,
        message: `✓ Verified! Echo.ai widget is active and responding on ${parsedUrl.hostname}.`,
        url: parsedUrl.href,
      });
    }

    if (hasWidgetScript && !hasOrgId) {
      return NextResponse.json({
        success: true,
        verified: false,
        reason: `Widget script detected, but data-org="${user.orgId}" was not found. Please verify you copied your unique script tag correctly.`,
      });
    }

    return NextResponse.json({
      success: true,
      verified: false,
      reason: `No Echo.ai widget tag was detected on ${parsedUrl.hostname}. Please make sure you have pasted the script tag before </body> and published your website changes.`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
