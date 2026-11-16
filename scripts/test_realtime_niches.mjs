import puppeteer from "puppeteer-core";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const CHROME_PATH = "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const dbPath = path.resolve("node_modules/.cache/frontdesk-sqlite/frontdesk.sqlite");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000;");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3001";
const ARTIFACT_DIR = "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const resultsLog = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
    resultsLog.push({ status: "PASS", message });
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
    resultsLog.push({ status: "FAIL", message });
  }
}

async function registerUser({ businessName, industry, name, email, password }) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessName, industry, name, email, password }),
  });
  const json = await res.json();
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/echo_session=([^;]+)/);
  const sessionToken = match ? match[1] : null;
  return { status: res.status, data: json.data || json, raw: json, sessionToken };
}

async function addKnowledge(sessionToken, { title, sourceType = "document", content }) {
  const res = await fetch(`${BASE_URL}/api/dashboard/knowledge/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `echo_session=${sessionToken}`,
    },
    body: JSON.stringify({ title, sourceType, content }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function sendVisitorChat({ orgId, conversationId, message, visitorName, visitorContact }) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, conversationId, message, visitorName, visitorContact }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function getDashboardData(sessionToken) {
  const res = await fetch(`${BASE_URL}/api/dashboard/conversations`, {
    headers: { Cookie: `echo_session=${sessionToken}` },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 STARTING COMPREHENSIVE REAL-TIME MULTI-NICHE END-TO-END TEST");
  console.log("==================================================================\n");

  const timestamp = Date.now();

  // ==================================================================
  // NICHE 1: CLINIC & ALLIED HEALTH (clinic)
  // ==================================================================
  console.log("\n🏥 [NICHE 1] CLINIC & ALLIED HEALTH (Apex Physiotherapy)");
  console.log("----------------------------------------------------------");
  const clinicEmail = `nathan.cole.${timestamp}@apexphysio.com.au`;
  const clinicReg = await registerUser({
    businessName: "Apex Physiotherapy & Sports Medicine",
    industry: "clinic",
    name: "Dr. Nathan Cole",
    email: clinicEmail,
    password: "Password123!",
  });

  assert(clinicReg.status === 201, `Clinic registration succeeded (HTTP ${clinicReg.status})`);
  assert(clinicReg.data.user.industry === "clinic", `Clinic user industry set to 'clinic'`);
  assert(clinicReg.data.user.agentName === "Maya", `Clinic default agent assigned: 'Maya'`);
  const clinicOrgId = clinicReg.data.user.orgId;
  const clinicSession = clinicReg.sessionToken;

  // Ingest Clinic Knowledge
  console.log("  Adding Clinic Knowledge Sources (Fees, HICAPS, Location)...");
  const clinicK1 = await addKnowledge(clinicSession, {
    title: "Clinic Fees & Services Schedule",
    sourceType: "document",
    content: "Consultation Fees: Initial Comprehensive Physiotherapy is $120 (60 min). Standard Follow-up is $90 (30 min). Dry needling and sports taping included upon request.",
  });
  assert(clinicK1.status === 201, "Ingested Clinic Consultation Fees knowledge chunk");

  const clinicK2 = await addKnowledge(clinicSession, {
    title: "Private Health Insurance & HICAPS",
    sourceType: "document",
    content: "HICAPS on-the-spot electronic claiming is available at our front desk for Bupa, Medibank, NIB, and all major Australian private health funds.",
  });
  assert(clinicK2.status === 201, "Ingested Clinic HICAPS claiming knowledge chunk");

  // Chat 1.1: Knowledge Retrieval (Fees)
  console.log("  Testing Chat: Pricing & Consultation Fees Inquiry...");
  const clinicChat1 = await sendVisitorChat({
    orgId: clinicOrgId,
    message: "What are your consultation fees?",
    visitorName: "David Lee",
    visitorContact: "0412111222",
  });
  assert(clinicChat1.status === 200, "Visitor chat returned HTTP 200");
  assert(
    clinicChat1.data.replyText.toLowerCase().includes("$120"),
    `AI replied with verified fees ($120): "${clinicChat1.data.replyText.slice(0, 100)}..."`
  );

  // Chat 1.1b: Knowledge Retrieval (HICAPS)
  console.log("  Testing Chat: HICAPS Claims Inquiry...");
  const clinicChat1b = await sendVisitorChat({
    orgId: clinicOrgId,
    conversationId: clinicChat1.data.conversationId,
    message: "Do you accept HICAPS health insurance claims?",
  });
  assert(
    clinicChat1b.data.replyText.toLowerCase().includes("hicaps"),
    `AI replied with HICAPS claiming details: "${clinicChat1b.data.replyText.slice(0, 100)}..."`
  );

  // Chat 1.2: Appointment Booking
  console.log("  Testing Chat: Booking Appointment with Doctor...");
  const clinicConvId = clinicChat1.data.conversationId;
  const clinicChat2 = await sendVisitorChat({
    orgId: clinicOrgId,
    conversationId: clinicConvId,
    message: "I'd like to book an initial appointment with Dr. Nathan Cole for Friday at 10:00 AM. My name is Mark Davis, phone 0418123456",
  });
  assert(
    clinicChat2.data.replyText.toLowerCase().includes("all booked") || clinicChat2.data.replyText.toLowerCase().includes("confirmed"),
    `Doctor appointment booked successfully: "${clinicChat2.data.replyText.slice(0, 95)}..."`
  );

  // Verify in SQLite Database
  const aptCheck = db.prepare("SELECT * FROM appointments WHERE organization_id = ?").all(clinicOrgId);
  assert(aptCheck.length >= 1, `Appointment saved to SQLite table (Count: ${aptCheck.length})`);
  const leadCheck = db.prepare("SELECT * FROM leads WHERE organization_id = ?").all(clinicOrgId);
  assert(leadCheck.length >= 1, `Patient lead captured in SQLite leads table (Count: ${leadCheck.length})`);

  // Chat 1.3: Double Booking Prevention
  console.log("  Testing Chat: Double-Booking Conflict Detection...");
  const clinicChat3 = await sendVisitorChat({
    orgId: clinicOrgId,
    message: "Can I book Dr. Nathan Cole for Friday at 10:00 AM? My name is Sarah Connor, 0419000111",
  });
  assert(
    clinicChat3.data.replyText.toLowerCase().includes("already fully booked") ||
      clinicChat3.data.replyText.toLowerCase().includes("alternative"),
    `Conflict prevented! AI offered alternative slots: "${clinicChat3.data.replyText.slice(0, 110)}..."`
  );

  // Chat 1.4: Staff Handover
  console.log("  Testing Chat: Human Staff Escalation...");
  const clinicChat4 = await sendVisitorChat({
    orgId: clinicOrgId,
    conversationId: clinicChat3.data.conversationId,
    message: "Can I please speak to a human receptionist?",
  });
  assert(clinicChat4.data.isEscalated === true, "Conversation flagged as escalated (isEscalated: true)");
  assert(
    clinicChat4.data.replyText.toLowerCase().includes("clinic front desk") ||
      clinicChat4.data.replyText.toLowerCase().includes("staff member"),
    "Received human escalation confirmation"
  );

  // ==================================================================
  // NICHE 2: E-COMMERCE & RETAIL (ecommerce)
  // ==================================================================
  console.log("\n🛍️ [NICHE 2] E-COMMERCE & RETAIL (Aura Streetwear)");
  console.log("----------------------------------------------------------");
  const ecomEmail = `chloe.vance.${timestamp}@aurastreetwear.com`;
  const ecomReg = await registerUser({
    businessName: "Aura Streetwear & Footwear",
    industry: "ecommerce",
    name: "Chloe Vance",
    email: ecomEmail,
    password: "Password123!",
  });

  assert(ecomReg.status === 201, `E-Commerce registration succeeded (HTTP ${ecomReg.status})`);
  assert(ecomReg.data.user.industry === "ecommerce", `E-Commerce user industry set to 'ecommerce'`);
  assert(ecomReg.data.user.agentName === "Aria", `E-Commerce default agent assigned: 'Aria'`);
  const ecomOrgId = ecomReg.data.user.orgId;
  const ecomSession = ecomReg.sessionToken;

  // Insert Live Order into DB for live tracking
  console.log("  Seeding live retail customer order #10842 into database...");
  db.prepare(`
    INSERT INTO orders (
      id, organization_id, order_number, customer_name, customer_email, total_amount, currency, tracking_carrier, tracking_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `ord_${timestamp}`,
    ecomOrgId,
    "10842",
    "David Miller",
    "david.miller@example.com",
    149.0,
    "AUD",
    "FedEx Express",
    "in_transit"
  );

  // Ingest E-commerce Knowledge
  console.log("  Adding E-Commerce Knowledge Sources (Shipping, Returns)...");
  await addKnowledge(ecomSession, {
    title: "Store Shipping Policy",
    sourceType: "document",
    content: "Standard shipping takes 3-5 business days ($8.95), express shipping takes 1-2 business days ($14.95). Free standard shipping on all orders over $100.",
  });
  await addKnowledge(ecomSession, {
    title: "Returns and Exchange Policy",
    sourceType: "document",
    content: "We offer a 30-day hassle-free return and exchange policy for unworn sneakers and apparel with original packaging and tags.",
  });

  // Chat 2.1: Live Order Tracking by Order Number
  console.log("  Testing Chat: Live Order Tracking (#10842)...");
  const ecomChat1 = await sendVisitorChat({
    orgId: ecomOrgId,
    message: "Where is my order #10842?",
    visitorName: "David Miller",
  });
  assert(
    ecomChat1.data.replyText.includes("10842") &&
      ecomChat1.data.replyText.toLowerCase().includes("transit") &&
      ecomChat1.data.replyText.includes("FedEx"),
    `Live order tracked: "${ecomChat1.data.replyText.slice(0, 110)}..."`
  );

  // Chat 2.2: Live Order Tracking by Email
  console.log("  Testing Chat: Order Tracking by Email...");
  const ecomChat2 = await sendVisitorChat({
    orgId: ecomOrgId,
    message: "Can you track my shipment for david.miller@example.com?",
  });
  assert(
    ecomChat2.data.replyText.includes("10842") && ecomChat2.data.replyText.toLowerCase().includes("transit"),
    `Order tracked via email lookup: "${ecomChat2.data.replyText.slice(0, 100)}..."`
  );

  // Chat 2.3: Returns Policy Q&A
  console.log("  Testing Chat: Returns & Exchanges Inquiry...");
  const ecomChat3 = await sendVisitorChat({
    orgId: ecomOrgId,
    message: "What is your return and refund policy?",
  });
  assert(
    ecomChat3.data.replyText.toLowerCase().includes("30-day") || ecomChat3.data.replyText.toLowerCase().includes("return"),
    `Returns policy accurately answered: "${ecomChat3.data.replyText.slice(0, 100)}..."`
  );

  // Chat 2.4: E-Commerce Store Support Escalation
  console.log("  Testing Chat: Store Support Escalation...");
  const ecomChat4 = await sendVisitorChat({
    orgId: ecomOrgId,
    message: "Please transfer me to your store customer support team",
  });
  assert(ecomChat4.data.isEscalated === true, "E-Commerce conversation escalated");
  assert(
    ecomChat4.data.replyText.toLowerCase().includes("store support team"),
    `Escalated to store support team: "${ecomChat4.data.replyText}"`
  );

  // ==================================================================
  // NICHE 3: REAL ESTATE & PROPERTY MANAGEMENT (realestate)
  // ==================================================================
  console.log("\n🏠 [NICHE 3] REAL ESTATE & PROPERTY MANAGEMENT (Harbour View)");
  console.log("----------------------------------------------------------");
  const reEmail = `julian.thorne.${timestamp}@harbourviewrealty.com.au`;
  const reReg = await registerUser({
    businessName: "Harbour View Real Estate",
    industry: "realestate",
    name: "Julian Thorne",
    email: reEmail,
    password: "Password123!",
  });

  assert(reReg.status === 201, `Real Estate registration succeeded (HTTP ${reReg.status})`);
  assert(reReg.data.user.industry === "realestate", `Real Estate user industry set to 'realestate'`);
  assert(reReg.data.user.agentName === "Sam", `Real Estate default agent assigned: 'Sam'`);
  const reOrgId = reReg.data.user.orgId;
  const reSession = reReg.sessionToken;

  // Ingest Real Estate Knowledge
  console.log("  Adding Real Estate Knowledge (Property Details, Inspections)...");
  await addKnowledge(reSession, {
    title: "12 Park St Property Specification & Pet Policy",
    sourceType: "document",
    content: "12 Park St is a renovated 2-bedroom, 1-bathroom apartment for lease at $650 per week with secure garage. Pets are considered case by case with landlord approval. Bond is 4 weeks rent.",
  });

  // Chat 3.1: Property Q&A
  console.log("  Testing Chat: Pet Policy & Rent Inquiry...");
  const reChat1 = await sendVisitorChat({
    orgId: reOrgId,
    message: "Is 12 Park St pet friendly and what is the weekly rent?",
    visitorName: "Emma Watson",
  });
  assert(
    reChat1.data.replyText.includes("$650") && reChat1.data.replyText.toLowerCase().includes("pet"),
    `Property & pet policy answered: "${reChat1.data.replyText.slice(0, 100)}..."`
  );

  // Chat 3.2: Inspection Booking & Lead Capture
  console.log("  Testing Chat: Property Inspection Booking...");
  const reChat2 = await sendVisitorChat({
    orgId: reOrgId,
    message: "I want to book an inspection for 12 Park St on Saturday at 11:00 AM with Priya. My name is Emma Watson, phone 0419888777",
  });
  assert(
    reChat2.data.replyText.toLowerCase().includes("inspection") &&
      (reChat2.data.replyText.toLowerCase().includes("booked") || reChat2.data.replyText.toLowerCase().includes("confirmed")),
    `Inspection booked with Priya Sharma: "${reChat2.data.replyText.slice(0, 110)}..."`
  );

  // Check appointment & lead tables
  const reApt = db.prepare("SELECT * FROM appointments WHERE organization_id = ?").all(reOrgId);
  assert(reApt.length >= 1, `Real estate inspection recorded in database (Count: ${reApt.length})`);
  const reLead = db.prepare("SELECT * FROM leads WHERE organization_id = ?").all(reOrgId);
  assert(reLead.length >= 1, `Buyer/tenant lead captured in leads table (Count: ${reLead.length})`);

  // Chat 3.3: Real Estate Agent Escalation
  console.log("  Testing Chat: Agent Escalation...");
  const reChat3 = await sendVisitorChat({
    orgId: reOrgId,
    message: "Can I speak to a real estate agent directly?",
  });
  assert(reChat3.data.isEscalated === true, "Real Estate chat escalated");
  assert(
    reChat3.data.replyText.toLowerCase().includes("real estate agent"),
    `Escalated to licensed agent: "${reChat3.data.replyText}"`
  );

  // ==================================================================
  // NICHE 4: SALON, BEAUTY & WELLNESS (beauty)
  // ==================================================================
  console.log("\n💇 [NICHE 4] SALON, BEAUTY & WELLNESS (Luna Glow)");
  console.log("----------------------------------------------------------");
  const beautyEmail = `elena.rostova.${timestamp}@lunaglowsalon.com`;
  const beautyReg = await registerUser({
    businessName: "Luna Glow Hair & Aesthetics",
    industry: "beauty",
    name: "Elena Rostova",
    email: beautyEmail,
    password: "Password123!",
  });

  assert(beautyReg.status === 201, `Beauty salon registration succeeded (HTTP ${beautyReg.status})`);
  assert(beautyReg.data.user.industry === "beauty", `Salon user industry set to 'beauty'`);
  assert(beautyReg.data.user.agentName === "Lexi", `Salon default agent assigned: 'Lexi'`);
  const beautyOrgId = beautyReg.data.user.orgId;
  const beautySession = beautyReg.sessionToken;

  // Ingest Beauty Salon Knowledge
  console.log("  Adding Salon Service Menu Knowledge...");
  await addKnowledge(beautySession, {
    title: "Salon Service Menu & Treatment Pricing",
    sourceType: "document",
    content: "Cut & Style Consultation is $85 (60 min). Full Balayage & Colour transformation is from $160. Deep conditioning keratin treatment is $60. Senior stylist Mia specializes in precision cuts.",
  });

  // Chat 4.1: Salon Menu & Pricing Inquiry
  console.log("  Testing Chat: Haircut & Balayage Pricing Inquiry...");
  const beautyChat1 = await sendVisitorChat({
    orgId: beautyOrgId,
    message: "How much is a cut and style and do you do balayage colour?",
    visitorName: "Sophie Taylor",
  });
  assert(
    beautyChat1.data.replyText.includes("$85") || beautyChat1.data.replyText.toLowerCase().includes("balayage"),
    `Salon pricing accurately quoted: "${beautyChat1.data.replyText.slice(0, 100)}..."`
  );

  // Chat 4.2: Stylist Appointment Booking
  console.log("  Testing Chat: Booking Haircut with Stylist Mia...");
  const beautyChat2 = await sendVisitorChat({
    orgId: beautyOrgId,
    message: "Book a haircut with Mia on Friday at 10:00 AM. My name is Sophie Taylor, phone 0422555666",
  });
  assert(
    beautyChat2.data.replyText.toLowerCase().includes("booked") || beautyChat2.data.replyText.toLowerCase().includes("confirmed"),
    `Stylist booking confirmed: "${beautyChat2.data.replyText.slice(0, 110)}..."`
  );

  const beautyApt = db.prepare("SELECT * FROM appointments WHERE organization_id = ?").all(beautyOrgId);
  assert(beautyApt.length >= 1, `Salon booking recorded in database (Count: ${beautyApt.length})`);

  // Chat 4.3: Salon Stylist Handover
  console.log("  Testing Chat: Stylist Handover...");
  const beautyChat3 = await sendVisitorChat({
    orgId: beautyOrgId,
    message: "I want to talk to a salon stylist directly",
  });
  assert(beautyChat3.data.isEscalated === true, "Salon chat escalated");
  assert(
    beautyChat3.data.replyText.toLowerCase().includes("salon reception"),
    `Escalated to salon reception team: "${beautyChat3.data.replyText}"`
  );

  // ==================================================================
  // NEGATIVE & EDGE CASES (Zero Hallucination, Guardrails, Auth)
  // ==================================================================
  console.log("\n🛡️ [EDGE CASES] GUARDRAILS, OUT-OF-SCOPE & BOUNDARIES");
  console.log("----------------------------------------------------------");

  // Edge Case 1: Out-of-Scope Medical Diagnosis
  console.log("  Testing Edge Case: Medical Diagnosis Guardrail (Zero Hallucination)...");
  const edgeChat1 = await sendVisitorChat({
    orgId: clinicOrgId,
    message: "Can you diagnose why I have severe abdominal pain and prescribe antibiotics?",
  });
  assert(
    edgeChat1.data.replyText.includes("verified company parameters") &&
      edgeChat1.data.replyText.includes("Unanswered Questions"),
    "Zero-hallucination guardrail triggered; logged to Unanswered Questions queue"
  );

  // Check unanswered questions table
  const unqCheck = db.prepare("SELECT * FROM unanswered_questions WHERE organization_id = ?").all(clinicOrgId);
  assert(unqCheck.length >= 1, `Unanswered question logged for staff review in SQLite (Count: ${unqCheck.length})`);

  // Edge Case 2: Non-existent Order Lookup
  console.log("  Testing Edge Case: Unknown Order Number in E-Commerce...");
  const edgeChat2 = await sendVisitorChat({
    orgId: ecomOrgId,
    message: "Where is order #99999?",
  });
  assert(
    edgeChat2.data.replyText.toLowerCase().includes("couldn't locate") ||
      edgeChat2.data.replyText.toLowerCase().includes("not found"),
    `Polite fallback for non-existent order: "${edgeChat2.data.replyText.slice(0, 90)}..."`
  );

  // Edge Case 3: Registration Validation (Weak Password)
  console.log("  Testing Edge Case: Invalid Password during Registration...");
  const badReg = await registerUser({
    businessName: "Test Org",
    industry: "clinic",
    name: "Tester",
    email: `badpass.${timestamp}@test.com`,
    password: "short",
  });
  assert(badReg.status === 400, `Rejected weak password with HTTP 400 (Status: ${badReg.status})`);

  // ==================================================================
  // VISUAL VERIFICATION & PUPPETEER SCREENSHOTS
  // ==================================================================
  console.log("\n📸 [VISUAL AUDIT] CAPTURING LIVE DASHBOARD SCREENSHOTS ACROSS NICHES");
  console.log("------------------------------------------------------------------");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });

    // Screenshot 1: Clinic Dashboard
    console.log("  Capturing Clinic Dashboard...");
    await page.setCookie({
      name: "echo_session",
      value: clinicSession,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("aside", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));
    const clinicScreenshot = `${ARTIFACT_DIR}/niche_clinic_dashboard_verified.png`;
    await page.screenshot({ path: clinicScreenshot });
    console.log(`  Saved screenshot: ${clinicScreenshot}`);

    // Screenshot 2: E-Commerce Dashboard (Orders & Tracking Tab)
    console.log("  Capturing E-Commerce Dashboard (Orders Tab)...");
    await page.setCookie({
      name: "echo_session",
      value: ecomSession,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("aside", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Click Orders & Tracking Tab
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("aside button")).find((el) =>
        el.innerText.toLowerCase().includes("orders")
      );
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const ecomScreenshot = `${ARTIFACT_DIR}/niche_ecommerce_dashboard_verified.png`;
    await page.screenshot({ path: ecomScreenshot });
    console.log(`  Saved screenshot: ${ecomScreenshot}`);

    // Screenshot 3: Real Estate Dashboard
    console.log("  Capturing Real Estate Dashboard...");
    await page.setCookie({
      name: "echo_session",
      value: reSession,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("aside", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));
    const reScreenshot = `${ARTIFACT_DIR}/niche_realestate_dashboard_verified.png`;
    await page.screenshot({ path: reScreenshot });
    console.log(`  Saved screenshot: ${reScreenshot}`);

    // Screenshot 4: Beauty Salon Dashboard
    console.log("  Capturing Beauty Salon Dashboard...");
    await page.setCookie({
      name: "echo_session",
      value: beautySession,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("aside", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));
    const beautyScreenshot = `${ARTIFACT_DIR}/niche_beauty_dashboard_verified.png`;
    await page.screenshot({ path: beautyScreenshot });
    console.log(`  Saved screenshot: ${beautyScreenshot}`);

    await page.close();
  } finally {
    await browser.close();
  }

  console.log("\n==================================================================");
  console.log(`🏁 TEST SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  if (failedTests > 0) {
    console.error(`🚨 ${failedTests} TESTS FAILED`);
    process.exit(1);
  } else {
    console.log("✨ ALL REAL-TIME MULTI-NICHE TESTS PASSED FLAWLESSLY! ✨");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
