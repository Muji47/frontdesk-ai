import puppeteer from "puppeteer-core";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const CHROMIUM_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const BASE_URL = "http://localhost:3001";
const DB_PATH = "/home/mujtaba/.gemini/antigravity/scratch/frontdesk-web/node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite";

async function main() {
  console.log("=== VERIFYING STAFF INVITATION, EMAIL DISPATCH & PASSWORD RESET FLOWS ===");

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // -------------------------------------------------------------
    // FLOW 1: STAFF INVITATION & SET PASSWORD EMAIL ACTIVATION
    // -------------------------------------------------------------
    console.log("\n--- PART 1: Staff Member Invitation & Activation ---");
    console.log("1. Logging into dashboard as Clinic Owner...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    await page.type('input[type="email"]', "demo@echo.ai");
    await page.type('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForSelector("aside", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    console.log("2. Navigating to Team tab...");
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll("nav button"));
      const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    console.log("3. Opening + Invite Staff Member modal...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.textContent?.includes("Invite Staff Member"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const testStaffEmail = `clara_${Date.now()}@clinic.com.au`;
    const testStaffName = "Clara Oswald";

    console.log(`4. Filling invite for: ${testStaffName} (${testStaffEmail})...`);
    const modalHandle = await page.evaluateHandle(() => {
      const fixedDivs = Array.from(document.querySelectorAll("div.fixed"));
      return fixedDivs.find((el) => el.textContent?.includes("Invite Staff Member")) || null;
    });

    const inputs = await modalHandle.$$("input");
    await inputs[0].type(testStaffName);
    await inputs[1].type(testStaffEmail);

    console.log("5. Clicking 'Send Staff Invite' button...");
    const submitBtn = await modalHandle.$('button[type="submit"]');
    await submitBtn.click();
    await new Promise((r) => setTimeout(r, 1500));

    // Verify modal displays invitation email dispatched & direct link
    const modalSuccessText = await page.evaluate(() => {
      const fixedDivs = Array.from(document.querySelectorAll("div.fixed"));
      const modal = fixedDivs.find((el) => el.textContent?.includes("Invitation Email Dispatched"));
      return modal ? modal.innerText : null;
    });

    console.log("Invite Modal Success Text snippet:\n", modalSuccessText);
    if (!modalSuccessText || !modalSuccessText.includes("Invitation Email Dispatched")) {
      throw new Error("Invite modal did not show 'Invitation Email Dispatched'!");
    }

    // Capture screenshot of the Invitation Email Dispatched modal
    const inviteScreenshotPath = path.join(ARTIFACT_DIR, "verified_staff_invite_email_dispatched.png");
    await page.screenshot({ path: inviteScreenshotPath, fullPage: false });
    console.log("✓ Saved Staff Invite Modal screenshot to:", inviteScreenshotPath);

    // Verify that the email was recorded in SQLite dispatched_emails table
    const db = new DatabaseSync(DB_PATH);
    const emailRow = db
      .prepare("SELECT * FROM dispatched_emails WHERE to_email = ? ORDER BY created_at DESC LIMIT 1")
      .get(testStaffEmail);

    if (!emailRow) {
      throw new Error(`No dispatched email found in database for ${testStaffEmail}!`);
    }
    console.log("✓ Verified email in dispatched_emails table:");
    console.log(`  Subject: "${emailRow.subject}"`);
    console.log(`  Action URL: "${emailRow.action_url}"`);

    const setupUrl = emailRow.action_url;
    if (!setupUrl.includes("/set-password?token=inv_")) {
      throw new Error("Invalid setup URL format: " + setupUrl);
    }

    // 6. Test Landing on Set Password Page as the invited staff member
    console.log("\n6. Opening Set Password link as staff member...");
    // Clear cookies to simulate fresh staff member session
    const cdp = await page.target().createCDPSession();
    await cdp.send("Network.clearBrowserCookies");

    await page.goto(setupUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("form", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1200));

    const setPasswordPageText = await page.evaluate(() => document.body.innerText);
    console.log("Set Password Page Text snippet:\n", setPasswordPageText.slice(0, 300));

    if (!setPasswordPageText.includes("Activate Your Account") || !setPasswordPageText.includes(testStaffEmail)) {
      throw new Error("Set Password page did not show personalized activation details!");
    }

    const setPassScreenshotPath = path.join(ARTIFACT_DIR, "verified_set_password_page.png");
    await page.screenshot({ path: setPassScreenshotPath, fullPage: false });
    console.log("✓ Saved Set Password Page screenshot to:", setPassScreenshotPath);

    // 7. Staff enters their custom password
    console.log("7. Entering new custom password 'ClaraPass2026!'...");
    const passInputs = await page.$$('input[type="password"]');
    await passInputs[0].type("ClaraPass2026!");
    await passInputs[1].type("ClaraPass2026!");

    console.log("8. Clicking 'Activate Account & Sign In'...");
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2500));

    // Wait for redirect to dashboard
    await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    const activatedUserSidebar = await page.evaluate(() => document.querySelector("aside")?.innerText || "");
    console.log("Dashboard user verified:", activatedUserSidebar.includes("Clara Oswald"));

    const activatedScreenshotPath = path.join(ARTIFACT_DIR, "verified_staff_activated_dashboard.png");
    await page.screenshot({ path: activatedScreenshotPath, fullPage: false });
    console.log("✓ Saved Activated Staff Dashboard screenshot to:", activatedScreenshotPath);

    // -------------------------------------------------------------
    // FLOW 2: FORGOT PASSWORD & PASSWORD RESET FLOW
    // -------------------------------------------------------------
    console.log("\n--- PART 2: Forgot Password & Password Reset Flow ---");
    console.log("9. Logging out to test Forgot Password...");
    await page.evaluate(() => {
      const logoutBtn = Array.from(document.querySelectorAll("aside button")).find((b) =>
        b.textContent?.includes("Log out")
      );
      if (logoutBtn) logoutBtn.click();
    });
    await page.waitForFunction(() => window.location.pathname === "/login", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    console.log("10. Clicking 'Forgot password?' link on Login page...");
    const forgotLink = await page.$('a[href="/forgot-password"]');
    if (!forgotLink) throw new Error("Could not find '/forgot-password' link on login page!");
    await forgotLink.click();

    await page.waitForFunction(() => window.location.pathname === "/forgot-password", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    console.log(`11. Requesting password reset for: ${testStaffEmail}...`);
    await page.type('input[type="email"]', testStaffEmail);
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1500));

    const forgotSuccessText = await page.evaluate(() => document.body.innerText);
    console.log("Forgot Password Response snippet:\n", forgotSuccessText.slice(0, 300));

    const forgotScreenshotPath = path.join(ARTIFACT_DIR, "verified_forgot_password_page.png");
    await page.screenshot({ path: forgotScreenshotPath, fullPage: false });
    console.log("✓ Saved Forgot Password Page screenshot to:", forgotScreenshotPath);

    // Retrieve reset token URL from SQLite
    const resetEmailRow = db
      .prepare("SELECT * FROM dispatched_emails WHERE to_email = ? AND email_type = 'password_reset' ORDER BY created_at DESC LIMIT 1")
      .get(testStaffEmail);

    if (!resetEmailRow) {
      throw new Error(`No password reset email dispatched for ${testStaffEmail}!`);
    }
    console.log("✓ Verified reset email in dispatched_emails table:");
    console.log(`  Reset URL: "${resetEmailRow.action_url}"`);

    // 12. Open Reset Password Page
    console.log("12. Opening Reset Password URL...");
    await page.goto(resetEmailRow.action_url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("form", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    const resetPageText = await page.evaluate(() => document.body.innerText);
    if (!resetPageText.includes("Set New Password")) {
      throw new Error("Did not land on 'Set New Password' page!");
    }

    console.log("13. Entering new password 'NewClaraSecret2026!'...");
    const resetPassInputs = await page.$$('input[type="password"]');
    await resetPassInputs[0].type("NewClaraSecret2026!");
    await resetPassInputs[1].type("NewClaraSecret2026!");

    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2500));

    // Verify automatic login and redirect to dashboard
    await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));

    const resetScreenshotPath = path.join(ARTIFACT_DIR, "verified_password_reset_success.png");
    await page.screenshot({ path: resetScreenshotPath, fullPage: false });
    console.log("✓ Saved Password Reset Success Dashboard screenshot to:", resetScreenshotPath);

    console.log("\n=== ALL INVITATION, EMAIL DISPATCH & PASSWORD RESET TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
