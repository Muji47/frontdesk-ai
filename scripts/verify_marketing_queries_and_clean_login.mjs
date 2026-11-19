import puppeteer from "puppeteer-core";
import path from "path";

const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const BASE_URL = "http://localhost:3001";

async function run() {
  console.log("=== STARTING MARKETING QUERIES & CLEAN LOGIN VERIFICATION ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warn") console.log("[PAGE LOG]", m.type(), m.text());
    });
    page.on("pageerror", (e) => console.log("[PAGE ERR]", e.message));

    // -------------------------------------------------------------------------
    // TEST 1: Clean Login Screen (No Credentials Exposed)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 1] Verifying /login page shows NO credentials or quick-fill pills...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1000));

    const loginText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const hasHeader = loginText.includes("sign in to dashboard");
    const showsPassword = loginText.includes("password123");
    const showsDemoEmail = loginText.includes("demo@echo.ai");
    const showsFillPill = loginText.includes("fill credentials");

    console.log("Login header rendered:", hasHeader);
    console.log("Exposes password123:", showsPassword);
    console.log("Exposes demo@echo.ai:", showsDemoEmail);
    console.log("Exposes Fill Credentials pill:", showsFillPill);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_clean_login_no_credentials.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_clean_login_no_credentials.png");

    if (showsPassword || showsDemoEmail || showsFillPill) {
      throw new Error("Security violation: Login page is still displaying credentials!");
    }
    console.log("✓ Login page is completely clean: ZERO exposed credentials.");

    // -------------------------------------------------------------------------
    // TEST 2: Submit a Query via Marketing Contact Form (/contact)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 2] Submitting a prospective client inquiry on marketing site (/contact)...");
    await page.goto(`${BASE_URL}/contact`, { waitUntil: "networkidle2" });
    await page.waitForSelector('input[placeholder*="Jenkins"]', { timeout: 8000 });

    // Fill form
    await page.focus('input[placeholder*="Jenkins"]');
    await page.keyboard.type("Dr. Olivia Bennett");

    await page.focus('input[placeholder*="healinghands"]');
    await page.keyboard.type("olivia.bennett@melbournedental.com.au");

    await page.focus('input[placeholder*="Physio"]');
    await page.keyboard.type("Melbourne Smile Studio");

    await page.focus('input[placeholder*="yourclinic.com.au"]');
    await page.keyboard.type("https://melbournedental.com.au");

    await page.focus('textarea[placeholder*="challenges"]');
    await page.keyboard.type("We operate a 6-chair dental clinic in Melbourne CBD. We need Echo.ai to triage after-hours emergencies and book into our Cliniko appointment book. Does your Growth tier support custom SMS patient reminders?");

    // Click submit
    await page.click('button[type="submit"]');

    // Wait for "Inquiry Received" confirmation card
    await page.waitForFunction(() => document.body.innerText.includes("Inquiry Received"), { timeout: 10000 });
    console.log("Inquiry submitted successfully!");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_marketing_contact_inquiry_submitted.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_marketing_contact_inquiry_submitted.png");

    // -------------------------------------------------------------------------
    // TEST 3: Submit a Live Visitor Chat Query on Marketing Site (/api/chat)
    // -------------------------------------------------------------------------
    console.log("\n[TEST 3] Generating a live marketing site visitor chat with Echo Sales Advisor...");
    const chatRes = await page.evaluate(async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: "org_echo_sales",
          message: "Hello! We run a 20-bed cosmetic clinic. Can Echo.ai handle patient inquiries and book consultations directly?",
          visitorName: "Prospect (Sydney Cosmetic)",
          visitorContact: "sydney.cosmetic@gmail.com",
        }),
      });
      return { status: res.status, data: await res.json() };
    });
    console.log("Chat API responded with status:", chatRes.status, "Conversation ID:", chatRes.data?.conversationId);
    if (!chatRes.data?.conversationId) {
      throw new Error("Failed to dispatch marketing live chat query!");
    }

    // -------------------------------------------------------------------------
    // TEST 4: Log in as Platform Superadmin and Inspect Marketing Queries Tab
    // -------------------------------------------------------------------------
    console.log("\n[TEST 4] Logging into Superadmin Command Center to verify marketing stream...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await page.focus('input[placeholder*="reception"]');
    await page.keyboard.type("superadmin@echo.ai");
    await page.focus('input[type="password"]');
    await page.keyboard.type("password123");

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);

    if (!page.url().includes("/superadmin")) {
      await page.goto(`${BASE_URL}/superadmin`, { waitUntil: "networkidle2" });
    }
    await new Promise((r) => setTimeout(r, 1500));

    // Click Marketing & Site Queries tab
    console.log("Clicking 'Marketing Inquiries & Live Queries' tab...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const mktBtn = btns.find((b) => b.textContent?.includes("Marketing Inquiries") || b.textContent?.includes("Marketing & Site Queries"));
      if (mktBtn) mktBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const superadminMktText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const hasOlivia = superadminMktText.includes("dr. olivia bennett");
    const hasMelbourneSmile = superadminMktText.includes("melbourne smile studio");
    const hasSydneyCosmeticChat = superadminMktText.includes("prospect (sydney cosmetic)") || superadminMktText.includes("cosmetic clinic");

    console.log("Displays Dr. Olivia Bennett's contact inquiry:", hasOlivia);
    console.log("Displays Melbourne Smile Studio:", hasMelbourneSmile);
    console.log("Displays live chat query stream:", hasSydneyCosmeticChat);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_superadmin_marketing_queries_tab.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_superadmin_marketing_queries_tab.png");

    if (!hasOlivia || !hasMelbourneSmile) {
      throw new Error("Superadmin marketing tab did not display the newly submitted contact inquiry!");
    }

    // -------------------------------------------------------------------------
    // TEST 5: Inspect Inquiry Details & Update Status to 'Qualified'
    // -------------------------------------------------------------------------
    console.log("\n[TEST 5] Inspecting Dr. Olivia Bennett's inquiry details and updating status...");
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tbody tr"));
      const oliviaRow = rows.find((r) => r.textContent?.includes("Dr. Olivia Bennett"));
      if (oliviaRow) {
        const detailsBtn = Array.from(oliviaRow.querySelectorAll("button")).find((b) => b.textContent?.includes("View Details"));
        if (detailsBtn) detailsBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    const modalText = await page.evaluate(() => document.body.innerText);
    const modalHasEmail = modalText.includes("olivia.bennett@melbournedental.com.au");
    const modalHasQuestion = modalText.includes("6-chair dental clinic");
    console.log("Modal displays email:", modalHasEmail);
    console.log("Modal displays inquiry questions:", modalHasQuestion);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_superadmin_inquiry_detail_modal.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_superadmin_inquiry_detail_modal.png");

    // Click "qualified" status button in modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const qualBtn = btns.find((b) => b.textContent?.trim() === "qualified");
      if (qualBtn) qualBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Close inquiry modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const closeBtn = btns.find((b) => b.textContent?.trim() === "Close");
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // TEST 6: Inspect Live Marketing Chat Transcript Modal
    // -------------------------------------------------------------------------
    console.log("\n[TEST 6] Inspecting live marketing visitor chat transcript in Superadmin...");
    const clickedTranscript = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const transcriptBtn = btns.find((b) => b.textContent?.includes("Inspect Transcript"));
      if (transcriptBtn) {
        transcriptBtn.click();
        return true;
      }
      return false;
    });
    console.log("Found and clicked 'Inspect Transcript' button:", clickedTranscript);
    await new Promise((r) => setTimeout(r, 1500));

    const transcriptModalText = await page.evaluate(() => document.body.innerText.toLowerCase());
    const hasTranscriptHeader = transcriptModalText.includes("messages exchanged") || transcriptModalText.includes("session id");
    console.log("Transcript modal opened successfully:", hasTranscriptHeader);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "verified_superadmin_marketing_chat_transcript_modal.png"),
      fullPage: false,
    });
    console.log("✓ Saved screenshot: verified_superadmin_marketing_chat_transcript_modal.png");

    if (!hasTranscriptHeader) {
      throw new Error("Chat transcript modal did not open or display messages!");
    }

    console.log("\n=== ALL MARKETING QUERIES & CLEAN LOGIN VERIFICATION TESTS PASSED! ===");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
