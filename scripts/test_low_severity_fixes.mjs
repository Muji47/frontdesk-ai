import { DatabaseSync } from "node:sqlite";
import puppeteer from "puppeteer-core";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const DB_PATH = "node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite";
const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";

async function main() {
  console.log("=== STARTING LOW-SEVERITY AUTOMATED VERIFICATION ===");
  let failures = 0;

  const db = new DatabaseSync(DB_PATH);
  const testOrgId = "org_f581cc494258b30e";
  const testSessionCookie = "echo_session=41b86c28aa0dbffd7e6b3f3d3b38a833183b8fa2dabad5dc7cfffb7df361a922";

  // ----------------------------------------------------
  // TEST 1: Column Migration Check
  // ----------------------------------------------------
  console.log("\n[TEST 1] Verifying credit_balance_cents column in organizations table...");
  const tableInfo = db.prepare("PRAGMA table_info(organizations)").all();
  const hasCreditCol = tableInfo.some(c => c.name === "credit_balance_cents");
  if (!hasCreditCol) {
    console.error("FAIL: credit_balance_cents column missing from organizations table!");
    failures++;
  } else {
    console.log("PASS: credit_balance_cents column exists in organizations table.");
  }

  // ----------------------------------------------------
  // TEST 2: Reconciled Conversations Endpoint Sync (Orders, Appointments, Leads)
  // ----------------------------------------------------
  console.log("\n[TEST 2] Verifying GET /api/dashboard/conversations returns appointments, leads, and orders...");
  try {
    const res = await fetch(`${BASE_URL}/api/dashboard/conversations`, {
      headers: {
        Cookie: testSessionCookie,
      },
    });
    if (!res.ok) {
      console.error(`FAIL: /api/dashboard/conversations returned status ${res.status}`);
      failures++;
    } else {
      const data = await res.json();
      const hasAppts = Array.isArray(data.appointments);
      const hasLeads = Array.isArray(data.leads);
      const hasOrders = Array.isArray(data.orders);
      if (hasAppts && hasLeads && hasOrders) {
        console.log(`PASS: /api/dashboard/conversations returned appointments (${data.appointments.length}), leads (${data.leads.length}), orders (${data.orders.length}).`);
      } else {
        console.error("FAIL: Missing appointments, leads, or orders arrays in response!", data);
        failures++;
      }
    }
  } catch (err) {
    console.error("FAIL: Fetch error in TEST 2", err);
    failures++;
  }

  // ----------------------------------------------------
  // TEST 3: Downgrade Proration & Account Credit Balance Persistence
  // ----------------------------------------------------
  console.log("\n[TEST 3] Testing Downgrade Proration and Account Credit Storage...");
  try {
    // 1. Put organization on Scale Annual ($2,388/yr)
    db.prepare(`
      UPDATE organizations 
      SET plan = 'scale', billing_cycle = 'annual', credit_balance_cents = 0, subscription_status = 'active', cancel_at_period_end = 0
      WHERE id = ?
    `).run(testOrgId);

    // Ensure a default card exists in payment_methods
    const existingCards = db.prepare("SELECT id FROM payment_methods WHERE organization_id = ?").all(testOrgId);
    if (existingCards.length === 0) {
      db.prepare(`
        INSERT INTO payment_methods (id, organization_id, brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at)
        VALUES ('card_test_low', ?, 'VISA', '4242', '12', '2029', 'Dr. Tester', 1, datetime('now'))
      `).run(testOrgId);
    }

    // Clean out prior test invoices and insert an annual invoice dated today for $2,388
    db.prepare("DELETE FROM billing_invoices WHERE organization_id = ?").run(testOrgId);

    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO billing_invoices (id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, invoice_date, created_at)
      VALUES (?, ?, 'Scale Plan (Annual)', 'annual', 238800, '$2,388.00', 'USD', 'Paid', 'Visa •••• 4242', 'Nov 15, 2026', ?)
    `).run("inv_scale_ann_" + Date.now(), testOrgId, nowIso);

    // 2. Perform Downgrade to Starter Monthly ($49/mo)
    const downgradeRes = await fetch(`${BASE_URL}/api/dashboard/billing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testSessionCookie,
      },
      body: JSON.stringify({
        action: "update_subscription",
        plan: "starter",
        billingCycle: "monthly",
      }),
    });

    const downgradeData = await downgradeRes.json();
    console.log("[Downgrade Response Message]:", downgradeData.message);
    console.log("[Credit Balance Cents]:", downgradeData.billing?.creditBalanceCents);
    console.log("[Credit Balance Formatted]:", downgradeData.billing?.creditBalanceFormatted);

    if (downgradeData.billing?.creditBalanceCents > 0) {
      console.log(`PASS: Leftover downgrade proration balance stored as credit: ${downgradeData.billing.creditBalanceFormatted}`);
    } else {
      console.error("FAIL: Downgrade credit balance was not preserved!", downgradeData);
      failures++;
    }

    // 3. Verify organizations table directly in DB
    const orgRow = db.prepare("SELECT credit_balance_cents FROM organizations WHERE id = ?").get(testOrgId);
    if (orgRow.credit_balance_cents > 0) {
      console.log(`PASS: Direct DB verification confirmed organizations.credit_balance_cents = ${orgRow.credit_balance_cents}`);
    } else {
      console.error("FAIL: Direct DB check failed for credit_balance_cents!");
      failures++;
    }

    // 4. Test subsequent upgrade to Pro Monthly ($99/mo) - should draw from credit balance with $0 charged!
    const startingCredit = orgRow.credit_balance_cents;
    const upgradeRes = await fetch(`${BASE_URL}/api/dashboard/billing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testSessionCookie,
      },
      body: JSON.stringify({
        action: "update_subscription",
        plan: "pro",
        billingCycle: "monthly",
      }),
    });

    const upgradeData = await upgradeRes.json();
    console.log("[Upgrade Response Message]:", upgradeData.message);
    console.log("[Remaining Credit Balance]:", upgradeData.billing?.creditBalanceCents);

    // Starting credit had $49 deducted for starter, now $99 deducted for pro (with unused starter credited back if any)
    if (upgradeData.billing?.creditBalanceCents > 0 && upgradeData.chargedInvoice?.amountCents === 0) {
      console.log(`PASS: Upgrade to Pro drew directly from credit balance ($0 charged to card); remaining credit: ${upgradeData.billing.creditBalanceFormatted}`);
    } else {
      console.error(`FAIL: Expected charge of $0 paid by credit, got ${upgradeData.chargedInvoice?.amountCents}`);
      failures++;
    }

  } catch (err) {
    console.error("FAIL: Error in TEST 3", err);
    failures++;
  }

  // ----------------------------------------------------
  // TEST 4: Dynamic Industry-Aware Knowledge Retrieval & Zero Clinical Leakage
  // ----------------------------------------------------
  console.log("\n[TEST 4] Testing Domain-Agnostic Knowledge Retrieval...");
  try {
    // 1. Test Clinic query on the clinic org for fees & hours
    const clinicTestRes = await fetch(`${BASE_URL}/api/dashboard/knowledge/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testSessionCookie,
      },
      body: JSON.stringify({
        query: "What are your consultation fees and charges?",
      }),
    });
    const clinicData = await clinicTestRes.json();
    const clinicAnswer = clinicData.result?.answer || clinicData.answer || "";
    console.log("[Clinic Fee Test Answer]:", clinicAnswer);
    if (clinicAnswer && (clinicAnswer.includes("145") || clinicAnswer.includes("Consultation"))) {
      console.log("PASS: Clinic knowledge query accurately retrieved consultation fees.");
    } else {
      console.error("FAIL: Clinic knowledge query failed to retrieve fee schedule!", clinicData);
      failures++;
    }

    // 2. Temporarily switch org to ecommerce to test industry isolation
    db.prepare("UPDATE organizations SET industry = 'ecommerce' WHERE id = ?").run(testOrgId);

    // Insert an e-commerce knowledge chunk with chunk_index: 0
    const ecomSrcId = "src_ecom_test_" + Date.now();
    db.prepare(`
      INSERT INTO knowledge_sources (id, organization_id, title, source_type, page_count, status, created_at)
      VALUES (?, ?, 'Returns & Shipping Handbook', 'url_crawl', 1, 'Indexed', datetime('now'))
    `).run(ecomSrcId, testOrgId);

    db.prepare(`
      INSERT INTO knowledge_chunks (id, organization_id, source_id, chunk_index, title, content, created_at)
      VALUES (?, ?, ?, 0, '📦 Shipping Rates & Dispatch Guidelines', 'All express deliveries arrive within 1-2 business days for $14.95. Standard shipping is $9.95.', datetime('now'))
    `).run("chk_ship_" + Date.now(), testOrgId, ecomSrcId);

    const ecomTestRes = await fetch(`${BASE_URL}/api/dashboard/knowledge/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testSessionCookie,
      },
      body: JSON.stringify({
        query: "What is your express delivery time and shipping cost?",
      }),
    });
    const ecomData = await ecomTestRes.json();
    const ecomAnswer = ecomData.result?.answer || ecomData.answer || "";
    console.log("[E-Commerce Shipping Test Answer]:", ecomAnswer);

    const hasClinicalDoctor = /dr\. sarah|david vance|physiotherapist/i.test(ecomAnswer);
    const hasShippingInfo = /express deliveries|shipping|business days/i.test(ecomAnswer);

    if (hasShippingInfo && !hasClinicalDoctor) {
      console.log("PASS: E-Commerce query matched shipping policy without clinical leakage.");
    } else {
      console.error(`FAIL: E-Commerce answer contained clinical leakage or missed shipping info! Clinical: ${hasClinicalDoctor}, Shipping: ${hasShippingInfo}`);
      failures++;
    }

    // Restore org industry back to clinic
    db.prepare("UPDATE organizations SET industry = 'clinic' WHERE id = ?").run(testOrgId);
    db.prepare("DELETE FROM knowledge_chunks WHERE source_id = ?").run(ecomSrcId);
    db.prepare("DELETE FROM knowledge_sources WHERE id = ?").run(ecomSrcId);

  } catch (err) {
    console.error("FAIL: Error in TEST 4", err);
    failures++;
  }

  // ----------------------------------------------------
  // TEST 5: Puppeteer Visual Verification (Account Credit UI Pill)
  // ----------------------------------------------------
  console.log("\n[TEST 5] Puppeteer Visual Verification for Account Credit Badge...");
  try {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.setCookie({
      name: "echo_session",
      value: "41b86c28aa0dbffd7e6b3f3d3b38a833183b8fa2dabad5dc7cfffb7df361a922",
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("aside", { timeout: 10000 });

    // Click Billing Tab
    const billingBtn = await page.waitForSelector("button::-p-text(Billing)");
    await billingBtn.click();
    await new Promise((r) => setTimeout(r, 1200));

    // Verify Account Credit badge is visible in the DOM
    const creditBadge = await page.$("span::-p-text(Account Credit)");
    if (creditBadge) {
      console.log("PASS: Account Credit badge is visibly rendered in Billing UI!");
    } else {
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes("Account Credit:")) {
        console.log("PASS: Found 'Account Credit:' text in page body.");
      } else {
        console.error("FAIL: 'Account Credit' not found in page body!");
        failures++;
      }
    }

    const screenshotPath = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20/billing_account_credit_pill_verified.png";
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`PASS: Saved visual screenshot to ${screenshotPath}`);

    await browser.close();
  } catch (err) {
    console.error("FAIL: Puppeteer visual test failed", err);
    failures++;
  }

  console.log(`\n=== SUITE COMPLETE: ${failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} FAILURES ❌`} ===`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
