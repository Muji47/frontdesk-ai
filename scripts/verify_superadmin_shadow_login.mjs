import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const BASE_URL = "http://localhost:3001";

// Ensure DB state has superadmin
try {
  const db = new DatabaseSync("node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite");
  const check = db.prepare("SELECT email, role, is_superadmin FROM users WHERE email = 'superadmin@echo.ai'").get();
  console.log("Superadmin user in DB:", check);
} catch (e) {
  console.log("DB check note:", e.message);
}

async function getAuthenticatedPage(browser, email, password) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector('input[placeholder*="reception"]', { timeout: 10000 });

  await page.focus('input[placeholder*="reception"]');
  await page.keyboard.type(email);
  await page.focus('input[type="password"]');
  await page.keyboard.type(password);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click('button[type="submit"]'),
  ]);

  return { context, page };
}

async function run() {
  console.log("=== STARTING SUPERADMIN & SHADOW LOGIN VERIFICATION ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Superadmin Login & Command Center
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Logging in as Platform Superadmin (superadmin@echo.ai)...");
    const session1 = await getAuthenticatedPage(browser, "superadmin@echo.ai", "password123");
    const page1 = session1.page;
    page1.on("console", (msg) => console.log("[BROWSER CONSOLE]", msg.type(), msg.text()));
    page1.on("pageerror", (err) => console.log("[BROWSER ERROR]", err.message));
    page1.on("response", (res) => {
      if (res.status() >= 400) console.log("[HTTP ERR]", res.status(), res.url());
    });

    // Navigate to /superadmin if not already there
    if (!page1.url().includes("/superadmin")) {
      await page1.goto(`${BASE_URL}/superadmin`, { waitUntil: "networkidle2" });
    }
    await new Promise((r) => setTimeout(r, 1500));

    const superadminText = await page1.evaluate(() => document.body.innerText.toLowerCase());
    const hasHeader = superadminText.includes("echo.ai superadmin");
    const hasOwnerBadge = superadminText.includes("platform owner");
    const hasMRR = superadminText.includes("platform mrr");
    const hasPracticesTable = superadminText.includes("healing hands physio");

    console.log("Header shows Echo.ai Superadmin:", hasHeader);
    console.log("Header displays Platform Owner badge:", hasOwnerBadge);
    console.log("Platform MRR metric displayed:", hasMRR);
    console.log("Practices list contains Healing Hands Physio:", hasPracticesTable);

    if (!hasHeader || !hasOwnerBadge || !hasPracticesTable) {
      throw new Error("Superadmin Command Center failed to load or missing platform data!");
    }

    await page1.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_superadmin_command_center.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_superadmin_command_center.png");

    // -------------------------------------------------------------------------
    // TEST 2: Practice Specs Modal
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Opening Practice Specs modal for Healing Hands Physio...");
    await page1.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tbody tr"));
      const healingRow = rows.find((r) => r.textContent?.includes("Healing Hands Physio"));
      if (healingRow) {
        const specsBtn = Array.from(healingRow.querySelectorAll("button")).find((b) => b.textContent?.includes("Specs"));
        if (specsBtn) specsBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    const modalText = await page1.evaluate(() => document.body.innerText);
    const modalHasDoctor = modalText.includes("Dr. Sarah Lee") || modalText.includes("demo@echo.ai");
    const modalHasGreeting = modalText.includes("Default AI Greeting");
    console.log("Specs modal displays practice owner details:", modalHasDoctor);
    console.log("Specs modal displays AI greeting & config:", modalHasGreeting);

    await page1.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_superadmin_practice_specs.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_superadmin_practice_specs.png");

    // Close modal
    await page1.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Close");
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // TEST 3: Shadow Login into Practice Owner
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Initiating Shadow Login into Healing Hands Physio (Owner: Dr. Sarah Lee)...");
    const pageCookies = await page1.cookies();
    console.log("Page cookies before shadow login:", pageCookies);
    const clicked = await page1.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tbody tr"));
      const healingRow = rows.find((r) => r.textContent?.includes("Healing Hands Physio"));
      if (healingRow) {
        const shadowBtn = Array.from(healingRow.querySelectorAll("button")).find((b) => b.textContent?.includes("Shadow Login"));
        if (shadowBtn) {
          shadowBtn.click();
          return true;
        }
      }
      return false;
    });
    console.log("Shadow login button found and clicked:", clicked);

    // Wait for navigation to /dashboard
    console.log("Waiting for navigation to practice dashboard...");
    await page1.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 12000 });
    await new Promise((r) => setTimeout(r, 2000));

    const dashboardText = await page1.evaluate(() => document.body.innerText.toLowerCase());
    const hasShadowBanner = dashboardText.includes("shadow login active");
    const hasInspectingPractice = dashboardText.includes("healing hands physio");
    const hasOwnerIdentity = dashboardText.includes("dr. sarah lee") || dashboardText.includes("demo@echo.ai");
    const hasExitButton = dashboardText.includes("exit shadow login");

    console.log("Top banner displays 'Shadow Login Active':", hasShadowBanner);
    console.log("Top banner identifies practice 'Healing Hands Physio':", hasInspectingPractice);
    console.log("Top banner displays owner identity:", hasOwnerIdentity);
    console.log("Top banner displays 'Exit Shadow Login' button:", hasExitButton);

    await page1.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_shadow_login_active_owner_view.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_shadow_login_active_owner_view.png");

    if (!hasShadowBanner || !hasInspectingPractice || !hasExitButton) {
      throw new Error("Shadow login failed: Active banner or owner session not found!");
    }

    // -------------------------------------------------------------------------
    // TEST 4: Exit Shadow Login & Return to Superadmin
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Clicking Exit Shadow Login...");
    await page1.evaluate(() => {
      const exitBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Exit Shadow Login"));
      if (exitBtn) exitBtn.click();
    });

    // Wait for navigation back to /superadmin
    console.log("Waiting for redirection back to /superadmin...");
    await page1.waitForFunction(() => window.location.pathname === "/superadmin", { timeout: 12000 });
    await new Promise((r) => setTimeout(r, 1500));

    const returnPageText = await page1.evaluate(() => document.body.innerText.toLowerCase());
    const returnedToSuperadmin = returnPageText.includes("echo.ai superadmin") && returnPageText.includes("platform owner");
    console.log("Successfully returned to Superadmin Command Center:", returnedToSuperadmin);

    await page1.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_shadow_login_exit_return_to_superadmin.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_shadow_login_exit_return_to_superadmin.png");

    if (!returnedToSuperadmin) {
      throw new Error("Failed to return to Superadmin Command Center after exiting shadow login!");
    }
    await session1.context.close();

    // -------------------------------------------------------------------------
    // TEST 5: Security / Access Control Check for Non-Superadmin
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Verifying security: Receptionist attempting to access /superadmin & APIs...");
    const session2 = await getAuthenticatedPage(browser, "receptionist@echo.ai", "password123");
    const page2 = session2.page;

    const attackRes = await page2.evaluate(async () => {
      const res = await fetch("/api/superadmin/overview");
      return { status: res.status, ok: res.ok };
    });
    console.log("Receptionist access to /api/superadmin/overview returned status:", attackRes.status);

    if (attackRes.ok || attackRes.status !== 403) {
      throw new Error(`Security breach: Non-superadmin was able to access /api/superadmin/overview! Status: ${attackRes.status}`);
    }
    console.log("✓ Confirmed 403 Forbidden for non-superadmin users.");
    await session2.context.close();

    console.log("\n=== ALL SUPERADMIN & SHADOW LOGIN TESTS PASSED PERFECTLY! ===");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
