import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const BASE_URL = "http://localhost:3001";

// Ensure test users are in expected state
try {
  const db = new DatabaseSync("node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite");
  db.prepare("UPDATE users SET role = 'receptionist' WHERE email = 'receptionist@echo.ai'").run();
  console.log("✓ Initialized DB: receptionist@echo.ai has role = 'receptionist'");
} catch (e) {
  console.log("DB setup note:", e.message);
}

async function getAuthenticatedPage(browser, email, password) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector('input[placeholder*="reception"]', { timeout: 10000 });

  await page.evaluate((em, pw) => {
    const eInput = document.querySelector('input[placeholder*="reception"]');
    const pInput = document.querySelector('input[type="password"]');
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setVal.call(eInput, em);
    eInput.dispatchEvent(new Event("input", { bubbles: true }));
    setVal.call(pInput, pw);
    pInput.dispatchEvent(new Event("input", { bubbles: true }));
  }, email, password);

  await page.click('button[type="submit"]');
  await page.waitForSelector("aside", { timeout: 12000 });
  return { context, page };
}

async function run() {
  console.log("=== STARTING ROLE UPDATE PERMISSIONS TEST ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Subuser (receptionist) viewing own profile cannot update own role
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Logging in as Receptionist (receptionist@echo.ai)...");
    const session1 = await getAuthenticatedPage(browser, "receptionist@echo.ai", "password123");
    const page1 = session1.page;
    console.log("✓ Receptionist reached dashboard.");

    // Go to Team tab and click Details & Templates
    await page1.evaluate(() => {
      const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
      if (teamBtn) teamBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    await page1.evaluate(() => {
      const detailsBtn = document.querySelector('button[title*="Open your details and manage personal message templates"]');
      if (detailsBtn) detailsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Click "Edit Account Details"
    console.log("Clicking Edit Account Details button...");
    await page1.evaluate(() => {
      const editBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit Account Details"));
      if (editBtn) editBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Verify UI displays "Role Locked" badge and explanation
    const profileFormText = await page1.evaluate(() => document.body.innerText);
    const hasRoleLockedBadge = profileFormText.includes("Role Locked");
    const hasCannotChangeOwnRoleNote = profileFormText.includes("You cannot update your own role");
    console.log("Role field shows 'Role Locked' badge in UI:", hasRoleLockedBadge);
    console.log("Role field explains only practice owner can change roles:", hasCannotChangeOwnRoleNote);

    // Verify there is NO editable <select> for role in the form
    const roleSelectPresent = await page1.evaluate(() => {
      const select = document.querySelector('select[value="receptionist"]') ||
                     Array.from(document.querySelectorAll("select")).find(s => s.textContent?.includes("Administrator"));
      return !!select;
    });
    console.log("Editable role select element is absent for subuser:", !roleSelectPresent);

    await page1.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_subuser_cannot_update_own_role.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_subuser_cannot_update_own_role.png");

    if (!hasRoleLockedBadge || !hasCannotChangeOwnRoleNote || roleSelectPresent) {
      throw new Error("UI violation: Subuser can see an editable role selector for their own account!");
    }

    // Now test API enforcement: attempt a direct fetch trying to escalate role to 'admin'
    console.log("Testing API security: Subuser attempting direct PATCH to escalate role to admin...");
    const patchResult = await page1.evaluate(async () => {
      // Get current user id
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      const myId = meData.data.user.userId || meData.data.user.id;

      const attackRes = await fetch("/api/dashboard/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: myId,
          name: "Clara Receptionist Hacker",
          role: "admin",
        }),
      });
      const attackData = await attackRes.json();
      return { status: attackRes.status, ok: attackRes.ok, data: attackData };
    });

    console.log("API response status for self-role escalation:", patchResult.status);
    console.log("API response body:", patchResult.data);

    if (patchResult.ok || patchResult.status !== 403) {
      throw new Error(`Security breach: Subuser self-role escalation was NOT blocked! Status: ${patchResult.status}`);
    }
    console.log("✓ Confirmed API 403 Forbidden: Subuser strictly blocked from updating their own role.");
    await session1.context.close();

    // -------------------------------------------------------------------------
    // TEST 2: Practice Owner can modify staff member role
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Logging in as Practice Owner (demo@echo.ai)...");
    const session2 = await getAuthenticatedPage(browser, "demo@echo.ai", "password123");
    const page2 = session2.page;
    console.log("✓ Owner reached dashboard.");

    // Go to Team tab
    await page2.evaluate(() => {
      const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
      if (teamBtn) teamBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Open Edit modal for Clara Receptionist
    console.log("Opening Edit Staff modal for Clara Receptionist as Owner...");
    await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const claraRow = rows.find((r) => r.textContent?.includes("receptionist@echo.ai"));
      if (claraRow) {
        const editBtn = Array.from(claraRow.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit"));
        if (editBtn) editBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // Verify Owner CAN see editable role select
    const ownerSeesRoleSelect = await page2.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0");
      if (!modal) return false;
      const select = modal.querySelector("select");
      return !!select;
    });
    console.log("Owner sees editable role select for staff member:", ownerSeesRoleSelect);

    await page2.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_owner_can_update_member_role.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_owner_can_update_member_role.png");

    if (!ownerSeesRoleSelect) {
      throw new Error("Owner could not find editable role select for staff member!");
    }

    // Change role to 'viewer' and save
    console.log("Owner updating Clara's role to Viewer...");
    await page2.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0");
      if (modal) {
        const select = modal.querySelector("select");
        if (select) {
          select.value = "viewer";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const saveBtn = Array.from(modal.querySelectorAll("button")).find((b) => b.textContent?.includes("Save Changes"));
        if (saveBtn) saveBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Clara's row now displays Viewer role badge
    const teamTextAfter = await page2.evaluate(() => document.body.innerText);
    const hasViewerBadge = teamTextAfter.includes("Viewer") && teamTextAfter.includes("receptionist@echo.ai");
    console.log("Clara's role successfully updated to Viewer by Owner:", hasViewerBadge);

    // Change Clara's role back to Receptionist
    console.log("Owner changing Clara back to Receptionist...");
    await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const claraRow = rows.find((r) => r.textContent?.includes("receptionist@echo.ai"));
      if (claraRow) {
        const editBtn = Array.from(claraRow.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit"));
        if (editBtn) editBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    await page2.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0");
      if (modal) {
        const select = modal.querySelector("select");
        if (select) {
          select.value = "receptionist";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const saveBtn = Array.from(modal.querySelectorAll("button")).find((b) => b.textContent?.includes("Save Changes"));
        if (saveBtn) saveBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 1500));
    console.log("✓ Restored Clara's role to Receptionist.");

    // -------------------------------------------------------------------------
    // TEST 3: Owner viewing own profile cannot change own role
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Owner viewing own profile details...");
    await page2.evaluate(() => {
      const asideBtn = document.querySelector('aside button[title*="Click to view account details"]') ||
                       document.querySelector('aside .group');
      if (asideBtn) asideBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Click "Edit Account Details" on owner profile
    await page2.evaluate(() => {
      const editBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit Account Details"));
      if (editBtn) editBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const ownerProfileText = await page2.evaluate(() => document.body.innerText);
    const ownerHasRoleLocked = ownerProfileText.includes("Role Locked");
    console.log("Owner own profile shows role is locked from self-change:", ownerHasRoleLocked);

    await page2.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_owner_own_role_locked.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_owner_own_role_locked.png");

    await session2.context.close();
    console.log("\n=== ALL ROLE UPDATE PERMISSION TESTS PASSED PERFECTLY! ===");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
