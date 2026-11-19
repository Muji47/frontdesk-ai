import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const BASE_URL = "http://localhost:3001";

// Reset DB state for clean test run
try {
  const db = new DatabaseSync("node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite");
  db.prepare("UPDATE users SET can_edit_company_templates = 0 WHERE email = 'receptionist@echo.ai'").run();
  db.prepare("UPDATE organizations SET allow_subuser_template_editing = 0 WHERE id = 'org_demo_101'").run();
  console.log("✓ Initialized DB: receptionist has can_edit_company_templates = 0, org has allow_subuser_template_editing = 0");
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
  console.log("=== STARTING SUBUSER COMPANY TEMPLATE PERMISSIONS TEST ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Subuser Initial State (Read-Only)
    // ----------------------------------------------------
    console.log("\n[TEST 1] Logging in as Receptionist (receptionist@echo.ai) with NO edit permission...");
    const session1 = await getAuthenticatedPage(browser, "receptionist@echo.ai", "password123");
    const page1 = session1.page;
    console.log("✓ Receptionist reached dashboard.");

    // Go to Team tab to click Details & Templates
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

    const recepPageText1 = await page1.evaluate(() => document.body.innerText);
    const showsAdminManaged = recepPageText1.includes("Admin Managed");
    const showsReadOnlyBanner = recepPageText1.includes("Read-Only for Staff");
    console.log("Predefined messages show 'Admin Managed':", showsAdminManaged);
    console.log("Scoping banner shows 'Read-Only for Staff':", showsReadOnlyBanner);

    if (!showsAdminManaged || !showsReadOnlyBanner) {
      throw new Error("Initial state check failed: Receptionist should be read-only on company templates.");
    }

    await page1.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_receptionist_templates_read_only.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_receptionist_templates_read_only.png");
    await session1.context.close();

    // ----------------------------------------------------
    // TEST 2: Owner Grants Template Editing Permission
    // ----------------------------------------------------
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
    console.log("Opening Edit Staff modal for Clara Receptionist...");
    await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const claraRow = rows.find(r => r.textContent?.includes("receptionist@echo.ai"));
      if (claraRow) {
        const editBtn = Array.from(claraRow.querySelectorAll("button")).find(b => b.textContent?.includes("Edit"));
        if (editBtn) editBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // Toggle permission checkbox to true
    console.log("Enabling 'Grant permission to edit company predefined message templates'...");
    await page2.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0");
      if (modal) {
        const checkbox = modal.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) {
          checkbox.click();
        }
        // Click Save Changes
        const saveBtn = Array.from(modal.querySelectorAll("button")).find(b => b.textContent?.includes("Save Changes"));
        if (saveBtn) saveBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Clara's row now has the badge 'Templates Editor'
    const teamTextAfter = await page2.evaluate(() => document.body.innerText);
    const hasEditorBadge = teamTextAfter.includes("Templates Editor");
    console.log("Clara's row displays 'Templates Editor' badge:", hasEditorBadge);

    await page2.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_owner_granted_template_permission.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_owner_granted_template_permission.png");

    if (!hasEditorBadge) {
      throw new Error("Failed to grant template editing permission to Clara!");
    }
    await session2.context.close();

    // ----------------------------------------------------
    // TEST 3: Receptionist Edits Company Predefined Template
    // ----------------------------------------------------
    console.log("\n[TEST 3] Logging in as Receptionist (receptionist@echo.ai) with granted permission...");
    const session3 = await getAuthenticatedPage(browser, "receptionist@echo.ai", "password123");
    const page3 = session3.page;
    console.log("✓ Receptionist reached dashboard with edit permissions.");

    // Open Details & Templates
    await page3.evaluate(() => {
      const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
      if (teamBtn) teamBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    await page3.evaluate(() => {
      const detailsBtn = document.querySelector('button[title*="Open your details and manage personal message templates"]');
      if (detailsBtn) detailsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const recepPageText2 = await page3.evaluate(() => document.body.innerText);
    const editAccessGranted = recepPageText2.includes("Subuser Edit Access Granted");
    const editCompanyStandardVisible = recepPageText2.includes("Edit Company Standard");

    console.log("Banner shows 'Subuser Edit Access Granted':", editAccessGranted);
    console.log("'Edit Company Standard' buttons visible on predefined cards:", editCompanyStandardVisible);

    if (!editAccessGranted || !editCompanyStandardVisible) {
      throw new Error("Receptionist was granted permission but UI does not show Edit Company Standard!");
    }

    // Click 'Edit Company Standard' on /fees template
    console.log("Clicking 'Edit Company Standard' on /fees template...");
    await page3.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".grid > div"));
      const feesCard = cards.find(c => c.textContent?.includes("/fees"));
      if (feesCard) {
        const editBtn = Array.from(feesCard.querySelectorAll("button")).find(b => b.textContent?.includes("Edit Company Standard"));
        if (editBtn) editBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // Update content of /fees template
    const newFeesContent = "Updated by Receptionist Clara: Initial Assessment fee is $125 (60 min) and standard follow-up is $95 (30 min). Electronic HICAPS rebates available on the spot.";
    console.log("Modifying /fees template content...");
    await page3.evaluate((val) => {
      function setVal(input, text) {
        const prototype = Object.getPrototypeOf(input);
        const set = Object.getOwnPropertyDescriptor(prototype, "value").set;
        set.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const cards = Array.from(document.querySelectorAll(".grid > div"));
      const feesCard = cards.find(c => c.textContent?.includes("/fees"));
      if (feesCard) {
        const txtArea = feesCard.querySelector("textarea");
        if (txtArea) setVal(txtArea, val);
        const saveBtn = Array.from(feesCard.querySelectorAll("button")).find(b => b.textContent?.includes("Save Changes"));
        if (saveBtn) saveBtn.click();
      }
    }, newFeesContent);
    await new Promise((r) => setTimeout(r, 2000));

    // Verify the updated text appears on the page
    const recepPageText3 = await page3.evaluate(() => document.body.innerText);
    const updatedFeeVisible = recepPageText3.includes("Updated by Receptionist Clara");
    console.log("Updated company predefined template successfully saved and rendered:", updatedFeeVisible);

    await page3.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_subuser_edited_company_predefined_template.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_subuser_edited_company_predefined_template.png");

    if (!updatedFeeVisible) {
      throw new Error("Failed to save updated company predefined template as subuser!");
    }
    await session3.context.close();

    // ----------------------------------------------------
    // TEST 4: Owner Views the Subuser's Updated Company Template
    // ----------------------------------------------------
    console.log("\n[TEST 4] Logging in as Owner to verify company template sync...");
    const session4 = await getAuthenticatedPage(browser, "demo@echo.ai", "password123");
    const page4 = session4.page;
    console.log("✓ Owner reached dashboard.");

    // Open Owner Details & Templates
    await page4.evaluate(() => {
      const asideBtn = document.querySelector('aside button[title*="Click to view account details"]') ||
                       document.querySelector('aside .group');
      if (asideBtn) asideBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const ownerPageText = await page4.evaluate(() => document.body.innerText);
    const ownerSeesUpdatedFee = ownerPageText.includes("Updated by Receptionist Clara");
    console.log("Owner sees updated company predefined template:", ownerSeesUpdatedFee);

    await page4.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_owner_views_subuser_edited_company_template.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_owner_views_subuser_edited_company_template.png");

    if (!ownerSeesUpdatedFee) {
      throw new Error("Company predefined template synchronization failed!");
    }
    await session4.context.close();

    console.log("\n=== ALL SUBUSER COMPANY TEMPLATE PERMISSION TESTS PASSED PERFECTLY! ===");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
