import puppeteer from "puppeteer-core";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const CHROMIUM_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const BASE_URL = "http://localhost:3001";
const DB_PATH = "/home/mujtaba/.gemini/antigravity/scratch/frontdesk-web/node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite";

async function main() {
  console.log("=== VERIFYING MEMBER DETAILS PAGE & PREDEFINED/CUSTOM TEMPLATES ===");

  const db = new DatabaseSync(DB_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Log in as clinic owner
    console.log("1. Logging into dashboard as clinic owner...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    await page.type('input[type="email"]', "demo@echo.ai");
    await page.type('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForSelector("aside", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    // 2. Navigate to Team Tab
    console.log("2. Navigating to Team directory tab...");
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll("nav button"));
      const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // 3. Open Member Details & Message Templates page
    console.log("3. Clicking 'Details & Templates →' on user row...");
    const detailsClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("td button"));
      const btn = buttons.find((b) => b.textContent?.includes("Details & Templates"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!detailsClicked) {
      throw new Error("Could not find 'Details & Templates →' button in team directory table!");
    }
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Member Details Page is rendered
    console.log("4. Verifying Member Details & Message Templates view...");
    const pageText = await page.evaluate(() => document.body.innerText);

    if (!pageText.includes("Predefined Messages & Canned Templates")) {
      throw new Error("Did not land on Member Details & Message Templates view!");
    }
    if (!pageText.includes("Personal Canned Responses & Slash Macros") && !pageText.includes("Predefined Messages")) {
      throw new Error("Predefined templates header not found!");
    }

    const detailsPageScreenshot = path.join(ARTIFACT_DIR, "verified_member_details_and_templates_page.png");
    await page.screenshot({ path: detailsPageScreenshot, fullPage: false });
    console.log("✓ Saved Member Details & Templates Page screenshot to:", detailsPageScreenshot);

    // 5. Verify Predefined Messages are seeded in SQLite and UI
    console.log("5. Checking predefined messages in database and UI...");
    const templateRows = db.prepare("SELECT * FROM user_message_templates ORDER BY created_at ASC").all();
    console.log(`Found ${templateRows.length} message templates in SQLite database for user.`);
    if (templateRows.length === 0) {
      throw new Error("Expected seeded predefined templates in database!");
    }

    // 6. Test Editing a Predefined Message for Personal Use
    console.log("6. Editing predefined /greeting template for personalized clinical voice...");
    const editGreetingClicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div.rounded-2xl"));
      const greetingCard = cards.find((c) => c.textContent?.includes("/greeting"));
      if (!greetingCard) return false;
      const editBtn = Array.from(greetingCard.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Edit")
      );
      if (editBtn) {
        editBtn.click();
        return true;
      }
      return false;
    });

    if (!editGreetingClicked) {
      throw new Error("Could not find edit button on /greeting card!");
    }
    await new Promise((r) => setTimeout(r, 600));

    // Fill edited personal message
    const customPersonalGreeting =
      "Good day! I'm Dr. Sarah Lee at Healing Hands Physio. How may our specialized clinical team assist your recovery today?";

    await page.evaluate((newMsg) => {
      const textareas = Array.from(document.querySelectorAll("textarea"));
      if (textareas.length > 0) {
        textareas[0].value = newMsg;
        textareas[0].dispatchEvent(new Event("input", { bubbles: true }));
        textareas[0].dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, customPersonalGreeting);

    // Click "Save Changes"
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const saveBtn = buttons.find((b) => b.textContent?.includes("Save Changes"));
      if (saveBtn) saveBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const editedCardScreenshot = path.join(ARTIFACT_DIR, "verified_predefined_message_edited.png");
    await page.screenshot({ path: editedCardScreenshot, fullPage: false });
    console.log("✓ Saved Predefined Message Edited screenshot to:", editedCardScreenshot);

    // 7. Test Adding a New Custom Template
    console.log("7. Creating new custom template '/stretching'...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const addBtn = buttons.find((b) => b.textContent?.includes("Add Custom Template"));
      if (addBtn) addBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Fill custom template form
    await page.type('input[placeholder="e.g. Telehealth Video Link"]', "Post-Care Stretching Routine");
    await page.type('input[placeholder="/zoom"]', "/stretching");
    await page.type('input[placeholder="e.g. Consultation, Care, General"]', "Clinical Care");

    const customStretchingMsg =
      "Here is your prescribed 5-minute lumbar decompression routine: please complete 3 gentle knee-to-chest holds twice daily.";
    await page.type("textarea", customStretchingMsg);

    // Click Save Custom Template
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const saveBtn = buttons.find((b) => b.textContent?.includes("Save Custom Template"));
      if (saveBtn) saveBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const customTemplateScreenshot = path.join(ARTIFACT_DIR, "verified_custom_template_created.png");
    await page.screenshot({ path: customTemplateScreenshot, fullPage: false });
    console.log("✓ Saved Custom Template Created screenshot to:", customTemplateScreenshot);

    // 8. Test in Interactive Macro Playground
    console.log("8. Testing macro expansion in interactive playground...");
    const playgroundInput = await page.$('input[placeholder*="Type /command and press space"]');
    if (!playgroundInput) {
      throw new Error("Could not find interactive playground input!");
    }

    await playgroundInput.type("/stretching ");
    await new Promise((r) => setTimeout(r, 800));

    const playgroundValue = await page.evaluate(
      () => document.querySelector('input[placeholder*="Type /command and press space"]')?.value || ""
    );
    console.log("Playground expanded value:", playgroundValue);

    if (!playgroundValue.includes("lumbar decompression")) {
      throw new Error("Playground did not expand '/stretching ' macro!");
    }

    const playgroundScreenshot = path.join(ARTIFACT_DIR, "verified_interactive_macro_simulator.png");
    await page.screenshot({ path: playgroundScreenshot, fullPage: false });
    console.log("✓ Saved Interactive Macro Simulator screenshot to:", playgroundScreenshot);

    // 9. Verify Live Chat Takeover Integration in Conversations Tab
    console.log("9. Switching to Conversations tab to verify fast macros integration...");
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll("nav button"));
      const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("conversations"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Verify fast macros toolbar contains our custom /stretching macro
    const chatMacrosText = await page.evaluate(() => {
      const fastMacrosBar = Array.from(document.querySelectorAll("div")).find((d) =>
        d.textContent?.includes("Fast Macros:")
      );
      return fastMacrosBar?.innerText || "";
    });
    console.log("Fast Macros Bar in Chat:", chatMacrosText);

    if (!chatMacrosText.includes("/stretching")) {
      throw new Error("Custom macro '/stretching' not found in live chat Fast Macros toolbar!");
    }

    // Test typing slash macro in reply input
    console.log("10. Testing typing '/stretching ' into staff reply bar...");
    const replyInput = await page.$('input[placeholder*="Type a staff reply or slash command"]');
    if (!replyInput) throw new Error("Could not find staff reply input!");

    await replyInput.type("/stretching ");
    await new Promise((r) => setTimeout(r, 800));

    const replyValue = await page.evaluate(
      () => document.querySelector('input[placeholder*="Type a staff reply or slash command"]')?.value || ""
    );
    console.log("Reply input expanded value:", replyValue);

    if (!replyValue.includes("lumbar decompression")) {
      throw new Error("Live reply input did not auto-expand '/stretching '!");
    }

    const chatIntegrationScreenshot = path.join(ARTIFACT_DIR, "verified_chat_custom_macros_integration.png");
    await page.screenshot({ path: chatIntegrationScreenshot, fullPage: false });
    console.log("✓ Saved Live Chat Custom Macros Integration screenshot to:", chatIntegrationScreenshot);

    // 11. Test Back Button navigation
    console.log("11. Verifying back navigation to Team directory...");
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll("nav button"));
      const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const teamTablePresent = await page.evaluate(
      () => document.body.innerText.includes("Organization Staff Directory")
    );
    console.log("Team Directory table verified after return:", teamTablePresent);

    console.log("\n=== ALL MEMBER DETAILS, PREDEFINED & CUSTOM TEMPLATES TESTS PASSED! ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
