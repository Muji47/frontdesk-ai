import puppeteer from "puppeteer-core";
import path from "node:path";

const CHROMIUM_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const BASE_URL = "http://localhost:3001";

async function main() {
  console.log("=== VERIFYING BEAUTIFUL CUSTOM CONFIRMATION POPUPS ===");

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    let nativeDialogTriggered = false;
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      nativeDialogTriggered = true;
      dialogMessage = dialog.message();
      console.error("❌ UNEXPECTED NATIVE BROWSER DIALOG TRIGGERED:", dialogMessage);
      await dialog.dismiss();
    });

    // 1. Log in as clinic owner
    console.log("1. Logging into dashboard...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));

    await page.type('input[type="email"]', "demo@echo.ai");
    await page.type('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForSelector("aside", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    // 2. Navigate to Team Tab
    console.log("2. Navigating to Team tab...");
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll("nav button"));
      const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // 3. Open Member Details & Message Templates page
    console.log("3. Opening Member Details & Templates page...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("td button"));
      const btn = buttons.find((b) => b.textContent?.includes("Details & Templates"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    // 4. Test "Restore Defaults" button trigger
    console.log("4. Clicking 'Restore Defaults' button...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.textContent?.includes("Restore Defaults"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    if (nativeDialogTriggered) {
      throw new Error(`Failed! Native browser dialog was triggered: "${dialogMessage}"`);
    }

    // Verify custom modal is displayed
    const resetModalText = await page.evaluate(() => {
      const modals = Array.from(document.querySelectorAll("div.fixed"));
      const target = modals.find((m) => m.textContent?.includes("Restore Predefined Messages?"));
      return target?.innerText || "";
    });
    console.log("Restore Defaults Modal text snippet:\n", resetModalText.slice(0, 300));

    if (!resetModalText.includes("Restore Predefined Messages?")) {
      throw new Error("Custom 'Restore Predefined Messages?' modal did not open!");
    }

    const restorePopupScreenshot = path.join(ARTIFACT_DIR, "verified_beautiful_restore_defaults_popup.png");
    await page.screenshot({ path: restorePopupScreenshot, fullPage: false });
    console.log("✓ Saved Custom Restore Defaults Popup screenshot to:", restorePopupScreenshot);

    // Close the reset modal
    console.log("5. Closing modal via Cancel button...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("div.fixed button"));
      const cancelBtn = buttons.find((b) => b.textContent?.includes("Cancel"));
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // 6. Create custom template '/telehealth' to test delete modal
    console.log("6. Adding custom template '/telehealth' to test delete confirmation...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const addBtn = buttons.find((b) => b.textContent?.includes("Add Custom Template"));
      if (addBtn) addBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.type('input[placeholder="e.g. Telehealth Video Link"]', "Telehealth Video Consultation");
    await page.type('input[placeholder="/zoom"]', "/telehealth");
    await page.type('input[placeholder="e.g. Consultation, Care, General"]', "Consultation");
    await page.type("textarea", "Please join your telehealth video consultation with Dr. Sarah Lee at https://telehealth.clinic.com/room-42.");

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const saveBtn = buttons.find((b) => b.textContent?.includes("Save Custom Template"));
      if (saveBtn) saveBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    // 7. Click 'Delete' on custom template '/telehealth'
    console.log("7. Clicking 'Delete' on custom template '/telehealth'...");
    const deleteClicked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div.rounded-2xl"));
      const targetCard = cards.find((c) => c.textContent?.includes("/telehealth"));
      if (!targetCard) return false;
      const deleteBtn = Array.from(targetCard.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Delete")
      );
      if (deleteBtn) {
        deleteBtn.click();
        return true;
      }
      return false;
    });

    if (!deleteClicked) {
      throw new Error("Could not find 'Delete' button on /telehealth custom template card!");
    }
    await new Promise((r) => setTimeout(r, 800));

    if (nativeDialogTriggered) {
      throw new Error(`Failed! Native browser dialog was triggered during delete: "${dialogMessage}"`);
    }

    // Verify custom delete modal is displayed
    const deleteModalText = await page.evaluate(() => {
      const modals = Array.from(document.querySelectorAll("div.fixed"));
      const target = modals.find((m) => m.textContent?.includes("Delete Custom Template?"));
      return target?.innerText || "";
    });
    console.log("Delete Template Modal text snippet:\n", deleteModalText.slice(0, 300));

    if (!deleteModalText.includes("Delete Custom Template?") || !deleteModalText.includes("/telehealth")) {
      throw new Error("Custom 'Delete Custom Template?' modal did not open or missing template context!");
    }

    const deletePopupScreenshot = path.join(ARTIFACT_DIR, "verified_beautiful_delete_template_popup.png");
    await page.screenshot({ path: deletePopupScreenshot, fullPage: false });
    console.log("✓ Saved Custom Delete Template Popup screenshot to:", deletePopupScreenshot);

    // 8. Test 'Cancel' on Delete Modal
    console.log("8. Testing 'Cancel' on Delete Modal...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("div.fixed button"));
      const cancelBtn = buttons.find((b) => b.textContent?.includes("Cancel"));
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Verify template is still present
    let stillPresent = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div.rounded-2xl"));
      return cards.some((c) => c.textContent?.includes("/telehealth"));
    });
    console.log("Template preserved after Cancel:", stillPresent);
    if (!stillPresent) throw new Error("Template was removed after Cancel!");

    // 9. Re-open Delete Modal and confirm deletion
    console.log("9. Re-opening Delete Modal and confirming deletion...");
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div.rounded-2xl"));
      const targetCard = cards.find((c) => c.textContent?.includes("/telehealth"));
      const deleteBtn = Array.from(targetCard.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Delete")
      );
      if (deleteBtn) deleteBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("div.fixed button"));
      const deleteConfirmBtn = buttons.find((b) => b.textContent?.includes("Delete Template"));
      if (deleteConfirmBtn) deleteConfirmBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const cardStillExists = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div.rounded-2xl"));
      return cards.some(
        (c) =>
          c.querySelector("h3")?.textContent?.includes("Telehealth Video") ||
          c.querySelector("span.font-mono")?.textContent?.includes("/telehealth")
      );
    });
    if (cardStillExists) {
      throw new Error("Template card /telehealth was still found in cards grid after deletion!");
    }
    console.log("✓ Template card /telehealth successfully deleted and removed from view.");

    console.log("\n=== ALL CUSTOM CONFIRMATION POPUPS VERIFIED SUCCESSFULLY! ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
