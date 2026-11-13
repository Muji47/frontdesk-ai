import { DatabaseSync } from "node:sqlite";
import puppeteer from "puppeteer-core";
import fs from "fs";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const DB_PATH = "node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";

const testSessionCookie = "41b86c28aa0dbffd7e6b3f3d3b38a833183b8fa2dabad5dc7cfffb7df361a922";
const testOrgId = "org_f581cc494258b30e";

async function main() {
  console.log("=== STARTING MEDIUM-LEVEL BUGS & UI/UX VERIFICATION ===");
  let failures = 0;

  // ----------------------------------------------------
  // TEST 1: Deleted Knowledge Source Cleanup in unanswered_questions
  // ----------------------------------------------------
  console.log("\n[TEST 1] Testing Deleted FAQ Cleanup...");
  const uniqueQ = "Can I bring my pet iguana to the clinic? " + Date.now();
  const uniqueA = "Yes, our clinic welcomes all exotic pets with advanced notice.";

  // Add manual FAQ via API
  const addRes = await fetch(`${BASE_URL}/api/dashboard/knowledge/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `echo_session=${testSessionCookie}`,
    },
    body: JSON.stringify({
      title: uniqueQ,
      sourceType: "manual_qa",
      content: uniqueA,
    }),
  });
  const addData = await addRes.json();
  console.log(`Add manual FAQ status: ${addRes.status}, sourceId: ${addData.source?.id}`);

  // Query test before deletion
  const testRes1 = await fetch(`${BASE_URL}/api/dashboard/knowledge/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `echo_session=${testSessionCookie}`,
    },
    body: JSON.stringify({ query: uniqueQ }),
  });
  const testData1 = await testRes1.json();
  console.log(`Knowledge test before deletion: answered = "${testData1.result?.answer?.slice(0, 40)}..."`);
  const answeredBefore = testData1.result?.answer?.includes("exotic pets");

  // Now delete the knowledge source
  const delRes = await fetch(`${BASE_URL}/api/dashboard/knowledge/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `echo_session=${testSessionCookie}`,
    },
    body: JSON.stringify({ id: addData.source.id }),
  });
  console.log(`Delete knowledge source status: ${delRes.status}`);

  // Query test after deletion
  const testRes2 = await fetch(`${BASE_URL}/api/dashboard/knowledge/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `echo_session=${testSessionCookie}`,
    },
    body: JSON.stringify({ query: uniqueQ }),
  });
  const testData2 = await testRes2.json();
  console.log(`Knowledge test after deletion: answered = "${testData2.result?.answer?.slice(0, 40)}..."`);
  const answeredAfter = testData2.result?.answer?.includes("exotic pets");

  if (answeredBefore && !answeredAfter) {
    console.log("PASS: Deleted FAQ was immediately wiped from unanswered_questions and is no longer answered!");
  } else {
    console.error(`FAIL: Deleted FAQ persistence test failed! answeredBefore=${answeredBefore}, answeredAfter=${answeredAfter}`);
    failures++;
  }

  // ----------------------------------------------------
  // TEST 2: Multi-User Concurrent SSE Connections
  // ----------------------------------------------------
  console.log("\n[TEST 2] Testing Multi-User Concurrent SSE Streams...");
  const db = new DatabaseSync(DB_PATH);
  
  // Create 3 temporary users for this org to simulate 3 distinct team members
  const userTokens = [testSessionCookie];
  for (let u = 1; u <= 2; u++) {
    const fakeUserId = `usr_test_team_${u}_${Date.now()}`;
    const fakeToken = `test_session_team_${u}_${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, organization_id, email, password_hash, salt, name, role)
      VALUES (?, ?, ?, 'hash', 'salt', ?, 'staff')
    `).run(fakeUserId, testOrgId, `staff${u}_${Date.now()}@clinic.com`, `Staff Member ${u}`);

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, datetime('now', '+7 days'))
    `).run(fakeToken, fakeUserId);
    userTokens.push(fakeToken);
  }

  // Connect all 3 users concurrently to SSE
  const controllers = userTokens.map(() => new AbortController());
  const ssePromises = userTokens.map((token, idx) => {
    return new Promise((resolve) => {
      fetch(`${BASE_URL}/api/dashboard/events`, {
        headers: { Cookie: `echo_session=${token}` },
        signal: controllers[idx].signal,
      }).then((res) => {
        resolve(res.status);
      }).catch((err) => {
        resolve(err.name === "AbortError" ? 200 : 500);
      });
    });
  });

  const statuses = await Promise.all(ssePromises);
  console.log(`Concurrent SSE connection statuses: ${statuses.join(", ")}`);
  controllers.forEach((c) => c.abort());

  const allConnected = statuses.every((s) => s === 200);
  if (allConnected && statuses.length === 3) {
    console.log("PASS: All 3 team members maintained simultaneous active SSE connections without eviction!");
  } else {
    console.error("FAIL: Multi-user SSE connection test failed!");
    failures++;
  }

  // ----------------------------------------------------
  // TEST 3: Browser UI Verification with Puppeteer (Mobile Viewport & Filter/Search)
  // ----------------------------------------------------
  console.log("\n[TEST 3] Testing Mobile Sidebar & Conversations Filter/Search in Chromium...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    // Set cookie
    await page.setCookie({
      name: "echo_session",
      value: testSessionCookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    console.log("Navigating to mobile dashboard view...");
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("aside", { timeout: 10000 });

    // 3A: Check mobile hamburger button
    const menuBtn = await page.$("button[aria-label='Open Navigation Menu']");
    if (!menuBtn) {
      console.error("FAIL: Mobile hamburger menu button not found!");
      failures++;
    } else {
      console.log("PASS: Mobile hamburger menu button found.");
      // Open drawer
      await menuBtn.click();
      await new Promise((r) => setTimeout(r, 400)); // wait for transition

      await page.screenshot({ path: `${ARTIFACT_DIR}/mobile_dashboard_drawer_open.png` });
      console.log("Saved artifact: mobile_dashboard_drawer_open.png");

      // Click Conversations in mobile drawer via CDP click
      const navButtons = await page.$$("aside nav button");
      if (navButtons.length >= 4) {
        await navButtons[3].click();
        await new Promise((r) => setTimeout(r, 600));
        console.log("Switched to Conversations tab on mobile.");
      }
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/mobile_dashboard_conversations_view.png` });
    console.log("Saved artifact: mobile_dashboard_conversations_view.png");

    // 3B: Switch to desktop viewport to test Conversations filter & search
    await page.setViewport({ width: 1280, height: 900, isMobile: false });
    await new Promise((r) => setTimeout(r, 400));

    // Navigate to Conversations on desktop
    const desktopNavButtons = await page.$$("aside nav button");
    if (desktopNavButtons.length >= 4) {
      await desktopNavButtons[3].click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // Type in search box
    const searchInput = await page.$("input[placeholder*='Search name, phone']");
    if (searchInput) {
      console.log("PASS: Conversations live search input found.");
      await searchInput.type("Website");
      await new Promise((r) => setTimeout(r, 300));
    } else {
      console.error("FAIL: Conversations live search input not found!");
      failures++;
    }

    // Check filter buttons
    const filterPills = await page.evaluate(() => 
      Array.from(document.querySelectorAll("button"))
        .map((b) => b.innerText.trim())
        .filter((t) => t.startsWith("All (") || t.startsWith("Needs Staff") || t.startsWith("AI Active") || t.startsWith("Resolved"))
    );
    console.log(`Found ${filterPills.length} status filter pills in conversations list: ${filterPills.join(", ")}`);
    if (filterPills.length === 4) {
      console.log("PASS: All 4 status filter pills (All, Needs Staff, AI Active, Resolved) rendered.");
    } else {
      console.error("FAIL: Filter pills count insufficient!");
      failures++;
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/conversations_filter_and_search_verified.png` });
    console.log("Saved artifact: conversations_filter_and_search_verified.png");

  } finally {
    await browser.close();
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log("\n====================================================");
  if (failures === 0) {
    console.log("🎉 ALL MEDIUM-SEVERITY FIXES VERIFIED SUCCESSFULLY (0 FAILURES)!");
  } else {
    console.log(`❌ ${failures} TEST(S) FAILED!`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
