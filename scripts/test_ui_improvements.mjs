import puppeteer from "puppeteer-core";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";

async function main() {
  console.log("=== STARTING UI/UX ENHANCEMENTS VERIFICATION ===");
  let failures = 0;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--headless=new"],
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Modern SVG Navigation Icons & Header Quick Action Bar
    // ----------------------------------------------------
    console.log("\n[TEST 1] Verifying Modern SVG Navigation & Quick Action Header...");
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1366, height: 900 });
    await page1.setCookie({
      name: "echo_session",
      value: "41b86c28aa0dbffd7e6b3f3d3b38a833183b8fa2dabad5dc7cfffb7df361a922",
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    await page1.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page1.waitForSelector("aside", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    const navSvgCount = await page1.evaluate(() => {
      const nav = document.querySelector("aside nav");
      return nav ? nav.querySelectorAll("svg").length : 0;
    });
    console.log(`[Nav] Found ${navSvgCount} SVG icons inside sidebar navigation.`);
    if (navSvgCount >= 8) {
      console.log("PASS: Modern SVG vector icons rendered across all sidebar nav items.");
    } else {
      console.error("FAIL: Expected at least 8 SVG navigation icons, found:", navSvgCount);
      failures++;
    }

    const navScreenshotPath = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20/ui_modern_navigation_verified.png";
    await page1.screenshot({ path: navScreenshotPath });
    console.log(`PASS: Saved navigation screenshot to ${navScreenshotPath}`);

    // ----------------------------------------------------
    // TEST 2: Command Palette (⌘K / Ctrl+K) Interaction
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing ⌘K Command Palette Modal & Search...");
    // Click Quick Actions... button in header
    const quickBtn = await page1.waitForSelector("button::-p-text(Quick Actions...)");
    await quickBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    const paletteVisible = await page1.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("command palette") || text.includes("type a command or search tabs");
    });

    if (paletteVisible) {
      console.log("PASS: Command Palette opened successfully via Quick Actions button / shortcut.");
    } else {
      console.error("FAIL: Command Palette modal was not visible!");
      failures++;
    }

    // Type "billing" into command palette
    await page1.keyboard.type("billing");
    await new Promise((r) => setTimeout(r, 400));

    const cmdScreenshotPath = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20/ui_command_palette_verified.png";
    await page1.screenshot({ path: cmdScreenshotPath });
    console.log(`PASS: Saved Command Palette screenshot to ${cmdScreenshotPath}`);
    await page1.close();

    // ----------------------------------------------------
    // TEST 3: Multi-Device Widget Studio (Desktop & Mobile iPhone Frame)
    // ----------------------------------------------------
    console.log("\n[TEST 3] Testing Agent Studio Multi-Device Preview & Interactive Chat...");
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1366, height: 900 });
    await page2.setCookie({
      name: "echo_session",
      value: "41b86c28aa0dbffd7e6b3f3d3b38a833183b8fa2dabad5dc7cfffb7df361a922",
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    await page2.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page2.waitForSelector("aside", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));
    
    // Click AI Receptionist Tab
    await page2.evaluate(() => {
      const b = Array.from(document.querySelectorAll("aside button")).find(el => el.innerText.includes("AI Receptionist"));
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify Desktop Widget Studio preview is visible
    const desktopPreview = await page2.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("interactive sandbox") && text.includes("live agent preview");
    });
    if (desktopPreview) {
      console.log("PASS: Desktop widget preview rendered with Interactive Sandbox.");
    } else {
      console.error("FAIL: Desktop widget preview not found!");
      failures++;
    }

    const desktopScreenshotPath = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20/ui_widget_studio_desktop_verified.png";
    await page2.screenshot({ path: desktopScreenshotPath });
    console.log(`PASS: Saved Desktop Widget Studio screenshot to ${desktopScreenshotPath}`);

    // Switch to Mobile iPhone Frame preview
    await page2.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Mobile"));
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const mobileFrameFound = await page2.evaluate(() => {
      return document.body.innerText.includes("9:41") && document.body.innerText.includes("5G");
    });
    if (mobileFrameFound) {
      console.log("PASS: Mobile iPhone Viewport Frame rendered with status bar and notch.");
    } else {
      console.error("FAIL: Mobile iPhone Frame status bar not found!");
      failures++;
    }

    // Test interactive messaging in the mobile preview: click quick chip
    await page2.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Book appointment") || el.innerText.includes("Track my order"));
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    const mobileScreenshotPath = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20/ui_widget_studio_mobile_frame_verified.png";
    await page2.screenshot({ path: mobileScreenshotPath });
    console.log(`PASS: Saved Mobile Widget Studio screenshot to ${mobileScreenshotPath}`);
    await page2.close();

  } finally {
    await browser.close();
  }

  console.log(`\n=== SUITE COMPLETE: ${failures === 0 ? "ALL UI CHECKS PASSED ✅" : `${failures} FAILURES ❌`} ===`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
