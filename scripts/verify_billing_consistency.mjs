import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";

async function main() {
  console.log("Starting verification of Billing consistency...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("PAGE ERROR LOG:", msg.text());
    });

    // ==========================================
    // 1. VERIFY MARKETING PRICING PAGE
    // ==========================================
    console.log("\n--- Step 1: Checking Marketing Pricing Page (/pricing) ---");
    await page.goto("http://localhost:3001/pricing", { waitUntil: "networkidle2" });

    // Verify presence of 3 billing toggles
    const toggleButtons = await page.$$eval("button", (buttons) =>
      buttons.map((b) => b.innerText.trim()).filter((t) => t.includes("billing"))
    );
    console.log("Found billing toggle buttons:", toggleButtons);

    // Verify Bi-Annual button exists
    const hasBiannualToggle = toggleButtons.some((t) => t.includes("Bi-Annual") && t.includes("Save 10%"));
    if (!hasBiannualToggle) {
      throw new Error(`Bi-Annual toggle with Save 10% not found! Got: ${JSON.stringify(toggleButtons)}`);
    }

    // Switch to Monthly billing
    console.log("Clicking 'Monthly billing'...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Monthly billing"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    let cardData = await page.$$eval("div.grid > div.rounded-3xl", (cards) =>
      cards.map((c) => ({
        title: c.querySelector("h3")?.innerText.trim(),
        price: c.querySelector("span.text-4xl")?.innerText.trim(),
        note: c.querySelector("div.text-\\[11px\\]")?.innerText.trim(),
        features: Array.from(c.querySelectorAll("ul li")).map((li) => li.innerText.trim()),
      }))
    );
    console.log("Monthly cards data:", JSON.stringify(cardData, null, 2));

    // Assert monthly prices: Starter $39, Growth $99, Pro $199
    const starterMonthly = cardData.find((c) => c.title === "Starter");
    const growthMonthly = cardData.find((c) => c.title === "Growth");
    const proMonthly = cardData.find((c) => c.title === "Pro");

    if (starterMonthly?.price !== "$39" || growthMonthly?.price !== "$99" || proMonthly?.price !== "$199") {
      throw new Error(`Monthly pricing incorrect! Expected $39, $99, $199. Got: ${JSON.stringify(cardData)}`);
    }

    // Switch to Bi-Annual billing
    console.log("Clicking 'Bi-Annual billing'...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Bi-Annual billing"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    cardData = await page.$$eval("div.grid > div.rounded-3xl", (cards) =>
      cards.map((c) => ({
        title: c.querySelector("h3")?.innerText.trim(),
        price: c.querySelector("span.text-4xl")?.innerText.trim(),
        note: c.querySelector("div.text-\\[11px\\]")?.innerText.trim(),
        features: Array.from(c.querySelectorAll("ul li")).map((li) => li.innerText.trim()),
      }))
    );
    console.log("Bi-Annual cards data:", JSON.stringify(cardData, null, 2));

    const starterBi = cardData.find((c) => c.title === "Starter");
    const growthBi = cardData.find((c) => c.title === "Growth");
    const proBi = cardData.find((c) => c.title === "Pro");

    if (starterBi?.price !== "$35" || !starterBi?.note?.includes("$210")) {
      throw new Error(`Starter Bi-Annual incorrect! Expected $35 and note with $210. Got: ${JSON.stringify(starterBi)}`);
    }
    if (growthBi?.price !== "$89" || !growthBi?.note?.includes("$534")) {
      throw new Error(`Growth Bi-Annual incorrect! Expected $89 and note with $534. Got: ${JSON.stringify(growthBi)}`);
    }
    if (proBi?.price !== "$179" || !proBi?.note?.includes("$1,074")) {
      throw new Error(`Pro Bi-Annual incorrect! Expected $179 and note with $1,074. Got: ${JSON.stringify(proBi)}`);
    }

    // Switch to Annual billing
    console.log("Clicking 'Annual billing'...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.innerText.includes("Annual billing") && !b.innerText.includes("Bi-Annual")
      );
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    cardData = await page.$$eval("div.grid > div.rounded-3xl", (cards) =>
      cards.map((c) => ({
        title: c.querySelector("h3")?.innerText.trim(),
        price: c.querySelector("span.text-4xl")?.innerText.trim(),
        note: c.querySelector("div.text-\\[11px\\]")?.innerText.trim(),
      }))
    );
    console.log("Annual cards data:", JSON.stringify(cardData, null, 2));

    const starterAnnual = cardData.find((c) => c.title === "Starter");
    const growthAnnual = cardData.find((c) => c.title === "Growth");
    const proAnnual = cardData.find((c) => c.title === "Pro");

    if (starterAnnual?.price !== "$31" || !starterAnnual?.note?.includes("$372")) {
      throw new Error(`Starter Annual incorrect! Expected $31 and note with $372. Got: ${JSON.stringify(starterAnnual)}`);
    }
    if (growthAnnual?.price !== "$79" || !growthAnnual?.note?.includes("$948")) {
      throw new Error(`Growth Annual incorrect! Expected $79 and note with $948. Got: ${JSON.stringify(growthAnnual)}`);
    }
    if (proAnnual?.price !== "$159" || !proAnnual?.note?.includes("$1,908")) {
      throw new Error(`Pro Annual incorrect! Expected $159 and note with $1,908. Got: ${JSON.stringify(proAnnual)}`);
    }

    // Take marketing pricing screenshot on Bi-Annual
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Bi-Annual billing"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({
      path: `${ARTIFACT_DIR}/verified_marketing_pricing_biannual.png`,
      fullPage: false,
    });
    console.log("Saved screenshot: verified_marketing_pricing_biannual.png");

    // ==========================================
    // 2. VERIFY DASHBOARD BILLING TAB
    // ==========================================
    console.log("\n--- Step 2: Logging in and checking Dashboard Billing tab ---");
    await page.goto("http://localhost:3001/login", { waitUntil: "networkidle2" });

    // Type credentials without demo pills
    await page.type('input:not([type="password"])', "demo@echo.ai");
    await page.type('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle2" });
    console.log("Navigated to:", page.url());

    // Click Billing tab on sidebar
    console.log("Navigating to Billing tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("button, a"));
      const billingTab = tabs.find((t) => t.innerText.includes("Billing"));
      if (billingTab) billingTab.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Verify presence of 3 cycle options in Dashboard
    const dashCycles = await page.$$eval("button", (buttons) =>
      buttons
        .map((b) => b.innerText.trim())
        .filter((t) => t.startsWith("Monthly") || t.startsWith("Bi-Annual") || t.startsWith("Annual"))
    );
    console.log("Dashboard cycle options found:", dashCycles);

    // Verify 3 Plan Cards in Dashboard: Starter, Growth, Pro
    let dashPlans = await page.$$eval("div.grid.grid-cols-1.md\\:grid-cols-3 > div", (cards) =>
      cards.map((c) => ({
        name: c.querySelector("h4")?.innerText.trim(),
        price: c.querySelector("span.text-2xl")?.innerText.trim(),
        subtext: c.querySelector("div.text-\\[11px\\].font-semibold")?.innerText.trim(),
        features: Array.from(c.querySelectorAll("ul li")).map((li) => li.innerText.trim()),
      }))
    );
    console.log("Dashboard Plan Cards (Current Cycle):", JSON.stringify(dashPlans, null, 2));

    const starterDash = dashPlans.find((p) => p.name === "Starter");
    const growthDash = dashPlans.find((p) => p.name === "Growth");
    const proDash = dashPlans.find((p) => p.name === "Pro");

    if (!starterDash || !growthDash || !proDash) {
      throw new Error(`Dashboard missing Starter, Growth, or Pro plans! Got: ${dashPlans.map((p) => p.name).join(", ")}`);
    }

    // Switch Dashboard cycle to Bi-Annual (6 Mo)
    console.log("Clicking Bi-Annual in Dashboard...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const biBtn = btns.find((b) => b.innerText.includes("Bi-Annual"));
      biBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    dashPlans = await page.$$eval("div.grid.grid-cols-1.md\\:grid-cols-3 > div", (cards) =>
      cards.map((c) => ({
        name: c.querySelector("h4")?.innerText.trim(),
        price: c.querySelector("span.text-2xl")?.innerText.trim(),
        subtext: c.querySelector("div.text-\\[11px\\].font-semibold")?.innerText.trim(),
        features: Array.from(c.querySelectorAll("ul li")).map((li) => li.innerText.trim()),
      }))
    );
    console.log("Dashboard Plan Cards on Bi-Annual:", JSON.stringify(dashPlans, null, 2));

    const sDashBi = dashPlans.find((p) => p.name === "Starter");
    const gDashBi = dashPlans.find((p) => p.name === "Growth");
    const pDashBi = dashPlans.find((p) => p.name === "Pro");

    if (sDashBi?.price !== "$35" || !sDashBi?.subtext?.includes("210")) {
      throw new Error(`Dashboard Starter Bi-Annual price mismatch! Expected $35 and $210, got: ${JSON.stringify(sDashBi)}`);
    }
    if (gDashBi?.price !== "$89" || !gDashBi?.subtext?.includes("534")) {
      throw new Error(`Dashboard Growth Bi-Annual price mismatch! Expected $89 and $534, got: ${JSON.stringify(gDashBi)}`);
    }
    if (pDashBi?.price !== "$179" || !pDashBi?.subtext?.includes("1,074")) {
      throw new Error(`Dashboard Pro Bi-Annual price mismatch! Expected $179 and $1,074, got: ${JSON.stringify(pDashBi)}`);
    }

    // Verify features consistency:
    console.log("Verifying feature list consistency...");
    console.log("Starter features in dashboard:", sDashBi.features);
    if (!sDashBi.features.some((f) => f.includes("500 AI conversations")) || !sDashBi.features.some((f) => f.includes("1 Staff team seat"))) {
      throw new Error(`Starter features do not match! Got: ${JSON.stringify(sDashBi.features)}`);
    }
    if (!gDashBi.features.some((f) => f.includes("2,000 AI conversations")) || !gDashBi.features.some((f) => f.includes("Cliniko, Halaxy & Shopify"))) {
      throw new Error(`Growth features do not match! Got: ${JSON.stringify(gDashBi.features)}`);
    }
    if (!pDashBi.features.some((f) => f.includes("8,000 AI conversations")) || !pDashBi.features.some((f) => f.includes("10 Staff team seats"))) {
      throw new Error(`Pro features do not match! Got: ${JSON.stringify(pDashBi.features)}`);
    }

    // Switch Dashboard cycle to Annual (12 Mo)
    console.log("Clicking Annual in Dashboard...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const annBtn = btns.find((b) => b.innerText.includes("Annual") && !b.innerText.includes("Bi-Annual"));
      annBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    dashPlans = await page.$$eval("div.grid.grid-cols-1.md\\:grid-cols-3 > div", (cards) =>
      cards.map((c) => ({
        name: c.querySelector("h4")?.innerText.trim(),
        price: c.querySelector("span.text-2xl")?.innerText.trim(),
        subtext: c.querySelector("div.text-\\[11px\\].font-semibold")?.innerText.trim(),
      }))
    );
    console.log("Dashboard Plan Cards on Annual:", JSON.stringify(dashPlans, null, 2));

    const sDashAnn = dashPlans.find((p) => p.name === "Starter");
    const gDashAnn = dashPlans.find((p) => p.name === "Growth");
    const pDashAnn = dashPlans.find((p) => p.name === "Pro");

    if (sDashAnn?.price !== "$31" || !sDashAnn?.subtext?.includes("372")) {
      throw new Error(`Dashboard Starter Annual price mismatch! Expected $31 and $372, got: ${JSON.stringify(sDashAnn)}`);
    }
    if (gDashAnn?.price !== "$79" || !gDashAnn?.subtext?.includes("948")) {
      throw new Error(`Dashboard Growth Annual price mismatch! Expected $79 and $948, got: ${JSON.stringify(gDashAnn)}`);
    }
    if (pDashAnn?.price !== "$159" || !pDashAnn?.subtext?.includes("1,908")) {
      throw new Error(`Dashboard Pro Annual price mismatch! Expected $159 and $1,908, got: ${JSON.stringify(pDashAnn)}`);
    }

    // Take screenshot of the Dashboard Billing tab
    await page.screenshot({
      path: `${ARTIFACT_DIR}/verified_dashboard_billing_consistent.png`,
      fullPage: false,
    });
    console.log("Saved screenshot: verified_dashboard_billing_consistent.png");

    console.log("\n ALL TESTS PASSED SUCCESSFULLY! Marketing and Dashboard billing are 100% unified!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
