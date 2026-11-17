import puppeteer from "puppeteer-core";
import path from "node:path";

const CHROMIUM_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const BASE_URL = "http://localhost:3001";

async function main() {
  console.log("=== VERIFYING BEAUTIFUL CONFIRMATION POPUP ===");

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Log in as demo user
  console.log("Logging into dashboard...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', "demo@echo.ai");
  await page.type('input[type="password"]', "password123");
  await page.click('button[type="submit"]');

  await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1000));
  console.log("Logged in successfully.");

  // 2. Navigate to Team Tab
  console.log("Navigating to Team tab...");
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll("nav button"));
    const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // 3. Find and click "Remove" on a staff member
  console.log("Finding removable staff member...");
  const hasRemoveBtn = await page.evaluate(() => {
    const removeBtns = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Remove"
    );
    if (removeBtns.length > 0) {
      removeBtns[0].click();
      return true;
    }
    return false;
  });

  if (!hasRemoveBtn) {
    throw new Error("No removable staff member button found in table!");
  }
  console.log("Clicked Remove button on staff member.");

  // 4. Verify beautiful popup modal is displayed
  await page.waitForFunction(() => {
    return document.body.textContent?.includes("Remove Staff Member?");
  }, { timeout: 5000 });
  console.log("✓ Beautiful confirmation popup modal detected!");

  // Wait a moment for fade-in animation to complete
  await new Promise((r) => setTimeout(r, 500));

  // Capture screenshot of the beautiful popup modal
  const screenshotPath = path.join(ARTIFACT_DIR, "verified_beautiful_remove_popup.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log("✓ Saved screenshot:", screenshotPath);

  // 5. Test Cancel button functionality
  console.log("Testing Cancel button...");
  await page.evaluate(() => {
    const cancelBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Cancel"
    );
    if (cancelBtn) cancelBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  const isModalClosed = await page.evaluate(() => {
    return !document.body.textContent?.includes("Remove Staff Member?");
  });
  console.log("Modal closed on Cancel:", isModalClosed);
  if (!isModalClosed) {
    throw new Error("Modal failed to close upon clicking Cancel!");
  }

  // 6. Click Remove again and confirm deletion
  console.log("Re-opening popup to test confirmed removal...");
  await page.evaluate(() => {
    const removeBtns = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Remove"
    );
    if (removeBtns.length > 0) removeBtns[0].click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Click the red "Remove Member" confirm button
  await page.evaluate(() => {
    const confirmBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Remove Member"
    );
    if (confirmBtn) confirmBtn.click();
  });

  // Verify toast appears
  await page.waitForFunction(() => {
    return document.body.textContent?.includes("Member Removed");
  }, { timeout: 8000 });
  console.log("✓ Confirmed removal successfully executed and toast displayed!");

  await browser.close();
  console.log("=== BEAUTIFUL CONFIRMATION POPUP VERIFICATION COMPLETED WITH 100% SUCCESS! ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
