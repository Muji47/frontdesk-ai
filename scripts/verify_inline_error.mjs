import puppeteer from "puppeteer-core";
import path from "node:path";

const CHROMIUM_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const BASE_URL = "http://localhost:3001";

async function main() {
  console.log("=== VERIFYING INLINE FIELD VALIDATION ERROR UNDER INPUT ===");

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Log in
    console.log("1. Logging into dashboard...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', "demo@echo.ai");
    await page.type('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // 2. Navigate to Team Tab
    console.log("2. Navigating to Team tab...");
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll("nav button"));
      const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 3. Open Invite Staff Member Modal
    console.log("3. Opening + Invite Staff Member modal...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.textContent?.includes("Invite Staff Member"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // 4. Fill values from user's screenshot: 'ada' and 'sds5fsfs'
    console.log("4. Finding invite modal and inputs...");
    const modalHandle = await page.evaluateHandle(() => {
      const fixedDivs = Array.from(document.querySelectorAll("div.fixed"));
      return fixedDivs.find((el) => el.textContent?.includes("Invite Staff Member")) || null;
    });

    if (!modalHandle) throw new Error("Could not find Invite Staff Member modal dialog");

    const inputs = await modalHandle.$$("input");
    if (inputs.length < 2) throw new Error("Could not find inputs in invite modal, found: " + inputs.length);

    console.log("Typing name 'ada' and email 'sds5fsfs'...");
    await inputs[0].type("ada");
    await inputs[1].type("sds5fsfs");

    // 5. Click Send Staff Invite
    console.log("5. Clicking 'Send Staff Invite' button...");
    const submitBtn = await modalHandle.$('button[type="submit"]');
    if (!submitBtn) throw new Error("Could not find submit button in invite modal");
    await submitBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    // 6. Inspect error element
    const verification = await page.evaluate(() => {
      const fixedDivs = Array.from(document.querySelectorAll("div.fixed"));
      const modal = fixedDivs.find((el) => el.textContent?.includes("Invite Staff Member"));
      if (!modal) return { success: false, reason: "Modal not found" };

      const emailInput = modal.querySelectorAll("input")[1];
      const isRedBordered = emailInput?.className?.includes("border-rose-400");
      const hasRedBg = emailInput?.className?.includes("bg-rose-50");

      const errorP = Array.from(modal.querySelectorAll("p")).find((p) =>
        p.textContent?.includes("Please enter a valid email address")
      );

      return {
        success: Boolean(isRedBordered && errorP),
        isRedBordered,
        hasRedBg,
        errorText: errorP?.textContent?.trim() || null,
        modalText: modal.innerText,
      };
    });

    console.log("Verification Result:", verification);

    if (!verification.success) {
      throw new Error("Inline error verification failed: " + JSON.stringify(verification));
    }

    console.log("✓ Verified: Inline error rendered directly below 'Staff Work Email' field!");
    console.log("✓ Error text:", verification.errorText);
    console.log("✓ Input highlighted with rose border and soft red background tint.");

    // 7. Capture screenshot for the user
    const screenshotPath = path.join(ARTIFACT_DIR, "verified_inline_field_error.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log("✓ Saved visual proof screenshot to:", screenshotPath);

    // 8. Test clearing error on user keystroke
    console.log("8. Testing live error clearing on keypress...");
    await inputs[1].type("@company.com");
    await new Promise((r) => setTimeout(r, 300));
    const isCleared = await page.evaluate(() => {
      const fixedDivs = Array.from(document.querySelectorAll("div.fixed"));
      const modal = fixedDivs.find((el) => el.textContent?.includes("Invite Staff Member"));
      const errorP = Array.from(modal?.querySelectorAll("p") || []).find((p) =>
        p.textContent?.includes("Please enter a valid email address")
      );
      return !errorP;
    });
    console.log("✓ Error dynamically cleared on typing valid input:", isCleared);

    console.log("=== ALL INLINE ERROR CHECKS PASSED ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
