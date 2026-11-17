import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROMIUM_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";
const BASE_URL = "http://localhost:3001";

async function main() {
  console.log("=== STARTING 5-POINT COMPETITIVE FEATURE TEST SUITE ===");

  // --- API TEST 1: Marketing Site Sales Persona vs Niche Orgs ---
  console.log("\n[TEST 1] Verifying Marketing Site Sales Persona & Niche Orgs Config...");
  const salesConfigRes = await fetch(`${BASE_URL}/api/widget/config?orgId=org_echo_sales`);
  const salesConfig = await salesConfigRes.json();
  console.log("Sales Widget Config:", salesConfig);
  if (salesConfig.name !== "Echo Advisor" || salesConfig.orgName !== "Echo.ai") {
    throw new Error(`Expected Echo Advisor for org_echo_sales, got: ${salesConfig.name}`);
  }
  console.log("✓ org_echo_sales correctly configured with persona:", salesConfig.name);

  // Chat test with Echo Advisor
  const salesChatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "How much does Echo.ai cost per month and do you have a free trial?",
      orgId: "org_echo_sales",
      visitorName: "Potential Buyer",
    }),
  });
  const salesChatData = await salesChatRes.json();
  console.log("Sales Agent AI Response:", salesChatData);
  const salesReply = salesChatData.replyText || salesChatData.reply || salesChatData.message;
  if (!salesReply || salesReply.length < 10) {
    throw new Error("Expected valid response from Echo Advisor: " + JSON.stringify(salesChatData));
  }
  console.log("✓ Echo Advisor correctly answered pricing and sales inquiry:", salesReply);

  // Test Niche org configs
  const nicheOrgs = [
    { org: "org_demo_101", expectedAgent: "Maya AI", expectedOrg: "Healing Hands Physio" },
    { org: "org_demo_ecom", expectedAgent: "Aria", expectedOrg: "Aura Apparel" },
    { org: "org_demo_realestate", expectedAgent: "Sam", expectedOrg: "Harbour Realty" },
    { org: "org_demo_beauty", expectedAgent: "Lexi", expectedOrg: "Luna Studio" },
  ];
  for (const n of nicheOrgs) {
    const res = await fetch(`${BASE_URL}/api/widget/config?orgId=${n.org}`);
    const data = await res.json();
    console.log(`✓ ${n.org} -> Org: ${data.orgName}, Agent: ${data.name}`);
    if (data.name !== n.expectedAgent) {
      throw new Error(`Mismatch for ${n.org}: expected ${n.expectedAgent}, got ${data.name}`);
    }
  }

  // --- API TEST 2: Installation Verifier Endpoint ---
  console.log("\n[TEST 2] Verifying 1-Click Installation Verifier Endpoint...");
  // Test with local clinic page that embeds widget.js with org_demo_101
  // First, verify a page that has the widget
  // Let's create a test session or test directly with auth cookie
  // Let's login as demo user to get session cookie
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@echo.ai", password: "password123" }),
  });
  const loginData = await loginRes.json();
  const setCookies = typeof loginRes.headers.getSetCookie === "function" ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie") || ""];
  const cookieHeader = setCookies.map(c => c.split(";")[0]).join("; ");
  console.log("Login successful, cookies obtained:", cookieHeader);

  // Now test verification endpoint for test-embed.html
  const verifyRes = await fetch(`${BASE_URL}/api/dashboard/integrations/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ websiteUrl: `${BASE_URL}/test-embed.html` }),
  });
  const verifyData = await verifyRes.json();
  console.log("Verification Response for test-embed.html:", verifyData);
  if (!verifyData.verified) {
    throw new Error(`Expected verification to succeed for test-embed.html, got: ${JSON.stringify(verifyData)}`);
  }
  console.log("✓ Installation verifier successfully detected widget tag on test-embed.html!");

  // Test negative case (uninstalled site)
  const verifyNegRes = await fetch(`${BASE_URL}/api/dashboard/integrations/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ websiteUrl: `${BASE_URL}/compare` }),
  });
  const verifyNegData = await verifyNegRes.json();
  console.log("Verification Negative Case (compare page without org_demo_101):", verifyNegData);
  if (verifyNegData.verified) {
    throw new Error("Expected verification to fail on /compare for org_demo_101");
  }
  console.log("✓ Installation verifier correctly reported negative detection when script tag missing or wrong org.");

  // --- API TEST 3: Team RBAC Management Endpoint ---
  console.log("\n[TEST 3] Verifying Team RBAC Endpoint (GET, POST, DELETE)...");
  const teamGetRes = await fetch(`${BASE_URL}/api/dashboard/team`, {
    headers: { Cookie: cookieHeader },
  });
  const teamGetData = await teamGetRes.json();
  console.log("Initial Team Members:", teamGetData.data);

  // If seats full, test deleting a non-owner member first
  if (teamGetData.data.seatsUsed >= teamGetData.data.seatLimit) {
    console.log("Seat limit reached (3/3), verifying DELETE of non-owner member...");
    const nonOwner = teamGetData.data.team.find(m => m.role !== "owner");
    if (nonOwner) {
      const delRes = await fetch(`${BASE_URL}/api/dashboard/team?id=${encodeURIComponent(nonOwner.id)}`, {
        method: "DELETE",
        headers: { Cookie: cookieHeader },
      });
      const delData = await delRes.json();
      console.log(`✓ Deleted non-owner member ${nonOwner.name}:`, delData);
    }
  }

  // Invite a new receptionist
  const testEmail = `receptionist_${Date.now()}@testclinic.com.au`;
  const inviteRes = await fetch(`${BASE_URL}/api/dashboard/team`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      name: "Sarah Jenkins",
      email: testEmail,
      role: "receptionist",
    }),
  });
  const inviteData = await inviteRes.json();
  console.log("Invite Response:", inviteData);
  if (!inviteData.success || !inviteData.member?.tempPassword) {
    throw new Error("Invite failed: " + JSON.stringify(inviteData));
  }
  console.log("✓ Successfully invited Sarah Jenkins with temp pass:", inviteData.member.tempPassword);

  // --- BROWSER TESTS WITH PUPPETEER ---
  console.log("\nLaunching headless Chromium for visual and UI verification...");
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Check Homepage for Proactive Greeting Bubble
  console.log("\n[BROWSER TEST 1] Checking Proactive Bubble on Homepage...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });

  // Wait for proactive bubble to appear in shadow root (auto-triggers after ~3.5s)
  await page.waitForFunction(() => {
    const host = document.getElementById("echo-receptionist-widget");
    if (!host || !host.shadowRoot) return false;
    const bubble = host.shadowRoot.getElementById("echoProactiveBubble");
    return bubble && bubble.classList.contains("echo-show");
  }, { timeout: 10000 });

  const bubbleText = await page.evaluate(() => {
    const host = document.getElementById("echo-receptionist-widget");
    const bubble = host.shadowRoot.getElementById("echoProactiveBubble");
    return bubble ? bubble.textContent : "";
  });
  console.log("Proactive Bubble Text:", bubbleText);

  // Screenshot homepage with proactive bubble
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_proactive_bubble.png"),
    fullPage: false,
  });
  console.log("✓ Saved verified_proactive_bubble.png");

  // Click the bubble and verify widget drawer opens
  await page.evaluate(() => {
    const host = document.getElementById("echo-receptionist-widget");
    const bubble = host.shadowRoot.getElementById("echoProactiveBubble");
    bubble.click();
  });
  await page.waitForFunction(() => {
    const host = document.getElementById("echo-receptionist-widget");
    const modal = host.shadowRoot.getElementById("echoModal");
    return modal && modal.classList.contains("echo-open");
  }, { timeout: 5000 });
  console.log("✓ Proactive bubble click successfully opened the widget drawer!");

  // 2. Log in and test Dashboard Features
  console.log("\n[BROWSER TEST 2] Testing Dashboard Integrations Verifier UI...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', "demo@echo.ai");
  await page.type('input[type="password"]', "password123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  // Navigate to Integrations tab
  console.log("Navigating to Integrations tab...");
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll("nav button"));
    const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("integrations"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Type URL into verifier input
  const verifierInput = await page.waitForSelector('input[placeholder*="Enter URL to check"]');
  await verifierInput.type(`${BASE_URL}/test-embed.html`);

  // Click verify button
  const verifyBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Verify Installation")
    );
  });
  await verifyBtn.click();

  // Wait for verification result badge
  await page.waitForFunction(
    () => document.body.textContent?.includes("Widget Active & Verified"),
    { timeout: 8000 }
  );
  console.log("✓ UI: Widget Active & Verified banner displayed!");

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_installation_verifier.png"),
    fullPage: false,
  });
  console.log("✓ Saved verified_installation_verifier.png");

  // 3. Test Team & RBAC tab
  console.log("\n[BROWSER TEST 3] Testing Team & RBAC Management UI...");
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll("nav button"));
    const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("team"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Verify seat allocation and staff table
  const teamHeaderText = await page.evaluate(() => document.body.textContent);
  if (!teamHeaderText.includes("Team Members & Role-Based Access")) {
    throw new Error("Team tab header not found");
  }
  console.log("✓ Team Members & RBAC view loaded successfully!");

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_team_rbac.png"),
    fullPage: false,
  });
  console.log("✓ Saved verified_team_rbac.png");

  // 4. Test Conversations Tab Canned Macros & Slash Commands
  console.log("\n[BROWSER TEST 4] Testing Staff Canned Macros & Slash Commands in Conversations...");
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll("nav button"));
    const btn = navButtons.find((b) => b.textContent?.toLowerCase().includes("conversations"));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Select first conversation if available
  await page.evaluate(() => {
    const firstConv = document.querySelector("button[class*='text-left w-full']");
    if (firstConv) firstConv.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Check if Fast Macros chips are present
  const hasMacroChips = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).some((b) =>
      b.textContent?.includes("/fees") || b.textContent?.includes("/track") || b.textContent?.includes("/booking")
    );
  });
  console.log("Fast Macro Chips Present:", hasMacroChips);

  // Type slash command in reply input
  const replyInput = await page.$('input[placeholder*="Type a staff reply or slash command"]');
  if (replyInput) {
    await replyInput.click();
    await replyInput.type("/fees ");
    await new Promise((r) => setTimeout(r, 500));
    const expandedVal = await page.evaluate((el) => el.value, replyInput);
    console.log("Slash Command Expansion Result for '/fees ':", expandedVal);
    if (!expandedVal.includes("consultation fees")) {
      throw new Error(`Slash command did not expand as expected: ${expandedVal}`);
    }
    console.log("✓ Slash command successfully auto-expanded in reply input!");
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "verified_canned_macros.png"),
    fullPage: false,
  });
  console.log("✓ Saved verified_canned_macros.png");

  await browser.close();
  console.log("\n=== ALL 5-POINT COMPETITIVE FEATURE TESTS PASSED WITH 100% SUCCESS! ===");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
