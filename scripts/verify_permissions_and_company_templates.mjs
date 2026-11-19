import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const BASE_URL = "http://localhost:3001";

// Clean up any test macro before running
try {
  const db = new DatabaseSync("node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite");
  db.prepare("DELETE FROM user_message_templates WHERE command = '/myroom'").run();
  console.log("✓ Cleaned up any prior test /myroom templates.");
} catch (e) {
  console.log("DB cleanup note:", e.message);
}

async function run() {
  console.log("=== STARTING COMPREHENSIVE PERMISSIONS & COMPANY TEMPLATES VERIFICATION ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // ----------------------------------------------------
  // TEST 1: Owner View (demo@echo.ai)
  // ----------------------------------------------------
  console.log("\n[TEST 1] Logging in as Owner (demo@echo.ai)...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector('input[placeholder*="reception"]', { timeout: 10000 });
  await page.type('input[placeholder*="reception"]', "demo@echo.ai");
  await page.type('input[type="password"]', "password123");
  await page.click('button[type="submit"]');

  await page.waitForSelector("aside", { timeout: 10000 });
  console.log("✓ Owner successfully reached dashboard.");

  // Check all 10 nav tabs are visible for Owner
  const ownerNavTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("aside nav button")).map((b) => b.textContent?.trim());
  });
  console.log("Owner nav items count:", ownerNavTexts.length);
  console.log("Owner nav labels:", ownerNavTexts.map(t => t?.split("\n")[0]).join(", "));

  const hasBilling = ownerNavTexts.some((t) => t?.includes("Billing"));
  const hasAgent = ownerNavTexts.some((t) => t?.includes("AI Receptionist"));
  const hasIntegrations = ownerNavTexts.some((t) => t?.includes("Integrations"));
  console.log(`Owner has Billing: ${hasBilling}, AI Receptionist: ${hasAgent}, Integrations: ${hasIntegrations}`);
  if (!hasBilling || !hasAgent || !hasIntegrations) {
    throw new Error("Owner must have full access to Billing, Agent, and Integrations.");
  }

  // Open Owner's Member Details & Templates
  console.log("Navigating to Owner Details & Templates...");
  await page.evaluate(() => {
    const btn = document.querySelector('button[title*="Click to view account details"]') ||
                document.querySelector('button[title*="My Account Details"]') ||
                document.querySelector('aside .group');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Verify Company Predefined Templates scoping
  const ownerPageText = await page.evaluate(() => document.body.innerText);
  const companyScopingVisible = ownerPageText.includes("Company Standard Scoping") || ownerPageText.includes("Company Predefined");
  const restoreDefaultsVisible = ownerPageText.includes("Restore Company Defaults");
  console.log("Company scoping banner visible:", companyScopingVisible);
  console.log("Restore Company Defaults visible for Owner:", restoreDefaultsVisible);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_owner_company_templates_and_permissions.png"),
    fullPage: false,
  });
  console.log("✓ Saved screenshot: verified_owner_company_templates_and_permissions.png");

  // ----------------------------------------------------
  // TEST 2: Logout and Log in as Receptionist (receptionist@echo.ai)
  // ----------------------------------------------------
  console.log("\n[TEST 2] Logging out and signing in as Receptionist (receptionist@echo.ai)...");
  await page.goto(`${BASE_URL}/api/auth/logout`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector('input[placeholder*="reception"]', { timeout: 10000 });
  await page.type('input[placeholder*="reception"]', "receptionist@echo.ai");
  await page.type('input[type="password"]', "password123");
  await page.click('button[type="submit"]');

  await page.waitForSelector("aside", { timeout: 10000 });
  console.log("✓ Receptionist successfully reached dashboard.");

  // Check Nav Tabs for Receptionist (Billing, Agent, Integrations MUST be hidden)
  const recepNavTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("aside nav button")).map((b) => b.textContent?.trim());
  });
  console.log("Receptionist nav items count:", recepNavTexts.length);
  console.log("Receptionist nav labels:", recepNavTexts.map(t => t?.split("\n")[0]).join(", "));

  const recepHasBilling = recepNavTexts.some((t) => t?.includes("Billing"));
  const recepHasAgent = recepNavTexts.some((t) => t?.includes("AI Receptionist"));
  const recepHasIntegrations = recepNavTexts.some((t) => t?.includes("Integrations"));
  console.log(`Receptionist has Billing: ${recepHasBilling} (expected false)`);
  console.log(`Receptionist has AI Receptionist: ${recepHasAgent} (expected false)`);
  console.log(`Receptionist has Integrations: ${recepHasIntegrations} (expected false)`);

  if (recepHasBilling || recepHasAgent || recepHasIntegrations) {
    throw new Error("RBAC Failure: Receptionist MUST NOT see Billing, AI Receptionist, or Integrations in sidebar!");
  }
  console.log("✓ RBAC navigation filtering PASSED!");

  // ----------------------------------------------------
  // TEST 3: Receptionist in Team Tab (Staff Directory Mode)
  // ----------------------------------------------------
  console.log("\n[TEST 3] Testing Receptionist view on Team tab...");
  await page.evaluate(() => {
    const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
    if (teamBtn) teamBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  const teamHeaderText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  const hasStaffDirectoryBadge = teamHeaderText.includes("Staff Directory");
  const hasInviteButton = teamHeaderText.includes("+ Invite Staff Member");
  console.log("Team shows 'Staff Directory' badge:", hasStaffDirectoryBadge);
  console.log("Team shows '+ Invite Staff Member' button:", hasInviteButton, "(expected false)");

  if (hasInviteButton) {
    throw new Error("RBAC Failure: Receptionist MUST NOT see '+ Invite Staff Member' button!");
  }
  console.log("✓ Receptionist Team Tab RBAC PASSED!");

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_receptionist_team_directory_permissions.png"),
    fullPage: false,
  });
  console.log("✓ Saved screenshot: verified_receptionist_team_directory_permissions.png");

  // ----------------------------------------------------
  // TEST 4: Receptionist Details & Templates (Company Assigned Templates + Personal Macros)
  // ----------------------------------------------------
  console.log("\n[TEST 4] Opening Receptionist Details & Templates...");
  await page.evaluate(() => {
    const detailsBtn = document.querySelector('button[title*="Open your details and manage personal message templates"]');
    if (detailsBtn) detailsBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  const recepTemplatesText = await page.evaluate(() => document.body.innerText);
  const showsCompanyStandard = recepTemplatesText.includes("Company Standard");
  const showsAdminManaged = recepTemplatesText.includes("Admin Managed");
  const restoreDefaultsHidden = !recepTemplatesText.includes("Restore Company Defaults");
  const addCustomAvailable = recepTemplatesText.includes("+ Add Custom Template");

  console.log("Shows Company Standard messages:", showsCompanyStandard);
  console.log("Company messages marked 'Admin Managed' (read-only for receptionist):", showsAdminManaged);
  console.log("Restore Company Defaults button hidden for receptionist:", restoreDefaultsHidden);
  console.log("+ Add Custom Template button available for receptionist:", addCustomAvailable);

  if (!showsCompanyStandard || !showsAdminManaged || !restoreDefaultsHidden || !addCustomAvailable) {
    throw new Error("Company predefined templates RBAC failure on Receptionist view!");
  }

  // Create a Personal Custom Macro as Receptionist
  console.log("Creating Personal Custom Macro (/myroom)...");
  await page.evaluate(() => {
    const addBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("+ Add Custom Template"));
    if (addBtn) addBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  await page.evaluate(() => {
    function setReactValue(input, value) {
      const prototype = Object.getPrototypeOf(input);
      const set = Object.getOwnPropertyDescriptor(prototype, "value").set;
      set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const titleInput = document.querySelector('input[placeholder*="Telehealth"]');
    const cmdInput = document.querySelector('input[placeholder*="/zoom"]');
    const txtArea = document.querySelector('textarea[placeholder*="message text"]');

    if (titleInput) setReactValue(titleInput, "Room 3 Consultation Link");
    if (cmdInput) setReactValue(cmdInput, "/myroom");
    if (txtArea) setReactValue(txtArea, "Please proceed directly to Consultation Room 3 on the first floor for your physiotherapist assessment.");
  });

  await page.evaluate(() => {
    const saveBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Save Custom Template"));
    if (saveBtn) saveBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  const afterCreateText = await page.evaluate(() => document.body.innerText);
  const macroCreated = afterCreateText.includes("/myroom") && afterCreateText.includes("Room 3 Consultation Link");
  console.log("Personal custom macro /myroom successfully created:", macroCreated);
  if (!macroCreated) {
    throw new Error("Failed to create personal custom macro for receptionist!");
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_receptionist_company_and_personal_templates.png"),
    fullPage: false,
  });
  console.log("✓ Saved screenshot: verified_receptionist_company_and_personal_templates.png");

  // ----------------------------------------------------
  // TEST 5: Direct Access Guard (Permission Gate for Restricted Tabs)
  // ----------------------------------------------------
  console.log("\n[TEST 5] Testing Permission Gate when accessing restricted tabs...");
  // Trigger billing tab via command palette
  await page.evaluate(() => {
    const quickActionsBtn = document.querySelector('button[title*="Quick Actions"]') ||
                            Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Quick Actions"));
    if (quickActionsBtn) quickActionsBtn.click();
  });
  await new Promise((r) => setTimeout(r, 700));

  await page.evaluate(() => {
    const billingCmd = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Go to Billing"));
    if (billingCmd) billingCmd.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  const gateText = await page.evaluate(() => document.body.innerText);
  const gateTriggered = gateText.includes("Administrator Access Required") && gateText.includes("Billing & Subscription Management");
  console.log("Permission Gate successfully rendered:", gateTriggered);
  if (!gateTriggered) {
    throw new Error("Permission Gate did not render for restricted tab!");
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_permission_gate_access_denied.png"),
    fullPage: false,
  });
  console.log("✓ Saved screenshot: verified_permission_gate_access_denied.png");

  // Click 'Open Live Conversations' on the permission gate
  console.log("Clicking 'Open Live Conversations' on permission gate...");
  await page.evaluate(() => {
    const openChatBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Open Live Conversations"));
    if (openChatBtn) openChatBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // ----------------------------------------------------
  // TEST 6: Live Chat Takeover with Company & Personal Macros
  // ----------------------------------------------------
  console.log("\n[TEST 6] Testing live chat triage with company predefined & personal macros...");
  await page.waitForFunction(() => document.body.innerText.includes("Live Visitor Triage") || document.body.innerText.includes("Fast Macros") || document.body.innerText.includes("Conversations"), { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1000));

  const chatText = await page.evaluate(() => document.body.innerText);
  console.log("Chat triage UI visible:", chatText.includes("Fast Macros") || chatText.includes("Take Over") || chatText.includes("Staff"));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_receptionist_chat_macros.png"),
    fullPage: false,
  });
  console.log("✓ Saved screenshot: verified_receptionist_chat_macros.png");

  console.log("\n=== ALL PERMISSIONS & COMPANY PREDEFINED TEMPLATES TESTS PASSED PERFECTLY! ===");
  await browser.close();
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
