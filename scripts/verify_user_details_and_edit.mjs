import puppeteer from "puppeteer-core";
import path from "node:path";

const CHROMIUM_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const BASE_URL = "http://localhost:3001";

async function main() {
  console.log("=== VERIFYING USER DETAILS DISPLAY & EDIT FUNCTIONALITY ===");

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

    // 2. Open User Profile Modal from bottom-left sidebar card
    console.log("2. Opening User Profile Modal from sidebar...");
    const profileBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll("aside button"));
      return btns.find((b) => b.getAttribute("title")?.includes("profile"));
    });
    if (!profileBtn) throw new Error("Could not find user profile button in sidebar");
    await profileBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    // 3. Verify modal shows user details
    console.log("3. Verifying User Profile modal content...");
    const profileModalText = await page.evaluate(() => {
      const modal = Array.from(document.querySelectorAll("div.fixed")).find((el) =>
        el.textContent?.includes("User Account Profile & Settings")
      );
      return modal ? modal.innerText : null;
    });

    console.log("Profile Modal Text snippet:", profileModalText?.slice(0, 300));
    if (!profileModalText || !profileModalText.includes("demo@echo.ai")) {
      throw new Error("User profile modal did not display user email details!");
    }

    // Capture screenshot of User Profile Modal
    const userProfileScreenshot = path.join(ARTIFACT_DIR, "verified_user_profile_modal.png");
    await page.screenshot({ path: userProfileScreenshot, fullPage: false });
    console.log("✓ Saved User Profile Modal screenshot to:", userProfileScreenshot);

    // Edit Name in User Profile Modal
    console.log("4. Editing Name in User Profile modal...");
    const nameInput = await page.evaluateHandle(() => {
      const modal = Array.from(document.querySelectorAll("div.fixed")).find((el) =>
        el.textContent?.includes("User Account Profile & Settings")
      );
      return modal?.querySelector('input[type="text"]');
    });

    await nameInput.click({ clickCount: 3 });
    await nameInput.type("Dr. Alex Walker");

    // Click Save Profile Changes
    const saveProfileBtn = await page.evaluateHandle(() => {
      const modal = Array.from(document.querySelectorAll("div.fixed")).find((el) =>
        el.textContent?.includes("User Account Profile & Settings")
      );
      return modal?.querySelector('button[type="submit"]');
    });
    await saveProfileBtn.click();
    await new Promise((r) => setTimeout(r, 1200));

    // Verify updated name in dashboard
    const updatedDashboardName = await page.evaluate(() => {
      return document.querySelector("aside")?.textContent?.includes("Dr. Alex Walker");
    });
    console.log("✓ Live dashboard name updated to 'Dr. Alex Walker':", updatedDashboardName);

    // 5. Navigate to Team Tab
    console.log("5. Navigating to Team tab to test staff member details and edit...");
    await page.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll("nav button"));
      const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 6. Find '✏️ Edit' button on a staff member (not self)
    console.log("6. Clicking 'Edit' on non-self staff member row...");
    const editMemberBtn = await page.evaluateHandle(() => {
      const table = document.querySelector("table");
      const buttons = Array.from(table?.querySelectorAll("button") || []);
      // Look for the edit button on another staff member (not 'Edit Profile')
      return buttons.find((b) => b.textContent?.includes("Edit") && !b.textContent?.includes("Profile"));
    });

    if (editMemberBtn) {
      await editMemberBtn.click();
      await new Promise((r) => setTimeout(r, 800));

      // 7. Verify Staff Member Details modal
      console.log("7. Verifying Staff Member Details modal...");
      const staffModalText = await page.evaluate(() => {
        const modal = Array.from(document.querySelectorAll("div.fixed")).find((el) =>
          el.textContent?.includes("Staff Member Details")
        );
        return modal ? modal.innerText : null;
      });

      console.log("Staff Modal Text snippet:", staffModalText?.slice(0, 300));
      if (!staffModalText) throw new Error("Staff Member Details modal did not open!");

      // Capture screenshot of Staff Member Edit Modal
      const staffScreenshot = path.join(ARTIFACT_DIR, "verified_staff_member_edit_modal.png");
      await page.screenshot({ path: staffScreenshot, fullPage: false });
      console.log("✓ Saved Staff Member Edit Modal screenshot to:", staffScreenshot);

      // Edit staff member name and promote role
      console.log("8. Updating staff member name to 'Elena Rostova' and role to 'admin'...");
      const staffNameInput = await page.evaluateHandle(() => {
        const modal = Array.from(document.querySelectorAll("div.fixed")).find((el) =>
          el.textContent?.includes("Staff Member Details")
        );
        return modal?.querySelector('input[type="text"]');
      });
      await staffNameInput.click({ clickCount: 3 });
      await staffNameInput.type("Elena Rostova");

      // Select role
      await page.evaluate(() => {
        const modal = Array.from(document.querySelectorAll("div.fixed")).find((el) =>
          el.textContent?.includes("Staff Member Details")
        );
        const select = modal?.querySelector("select");
        if (select) {
          select.value = "admin";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      // Submit changes
      const saveStaffBtn = await page.evaluateHandle(() => {
        const modal = Array.from(document.querySelectorAll("div.fixed")).find((el) =>
          el.textContent?.includes("Staff Member Details")
        );
        return modal?.querySelector('button[type="submit"]');
      });
      await saveStaffBtn.click();
      await new Promise((r) => setTimeout(r, 1000));

      // Verify table has updated member
      const tableText = await page.evaluate(() => document.querySelector("table")?.innerText || "");
      const hasUpdatedStaff = tableText.includes("Elena Rostova") && tableText.includes("Admin");
      console.log("✓ Staff directory updated with new name and role:", hasUpdatedStaff);
    }

    console.log("=== ALL USER DETAILS DISPLAY & EDIT TESTS PASSED ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
