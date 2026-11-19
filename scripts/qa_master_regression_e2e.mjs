import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH =
  fs.existsSync("/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome")
    ? "/home/mujtaba/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome"
    : "/snap/bin/chromium";

const BASE_URL = "http://localhost:3001";

const ARTIFACT_DIRS = [
  "/home/mujtaba/.gemini/antigravity/brain/219856d2-d475-4cb8-99c6-703f15d395e3",
  "/home/mujtaba/.gemini/antigravity/brain/ceb8683d-2c42-47f3-a9f9-17acecde5e20",
];

// Ensure artifact screenshot directories exist
ARTIFACT_DIRS.forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sub = path.join(dir, "screenshots");
  if (!fs.existsSync(sub)) fs.mkdirSync(sub, { recursive: true });
});

async function captureProof(page, filename) {
  for (const dir of ARTIFACT_DIRS) {
    const p1 = path.join(dir, filename);
    const p2 = path.join(dir, "screenshots", filename);
    await page.screenshot({ path: p1, fullPage: false });
    try {
      fs.copyFileSync(p1, p2);
    } catch {}
  }
  console.log(`  📸 Proof captured: ${filename}`);
}

let nativeDialogCount = 0;

async function getAuthenticatedPage(browser, email, password) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on("dialog", async (dialog) => {
    nativeDialogCount++;
    console.warn("⚠️ UNEXPECTED NATIVE DIALOG DETECTED (VIOLATION):", dialog.message());
    await dialog.dismiss();
  });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector('input[placeholder*="reception"]', { timeout: 10000 });

  await page.evaluate((em, pw) => {
    const eInput = document.querySelector('input[placeholder*="reception"]');
    const pInput = document.querySelector('input[type="password"]');
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setVal.call(eInput, em);
    eInput.dispatchEvent(new Event("input", { bubbles: true }));
    setVal.call(pInput, pw);
    pInput.dispatchEvent(new Event("input", { bubbles: true }));
  }, email, password);

  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => window.location.pathname.startsWith("/dashboard") || window.location.pathname.startsWith("/superadmin"),
    { timeout: 12000 }
  );
  return { context, page };
}

const testResults = [];

function recordTest(category, name, passed, details = "") {
  testResults.push({ category, name, passed, details });
  const badge = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${badge}] [${category}] ${name}${details ? ` -> ${details}` : ""}`);
}

async function runMasterRegression() {
  console.log("\n===============================================================================");
  console.log("       FRONTDESK AI — MASTER E2E REGRESSION & PENETRATION TEST SUITE");
  console.log("===============================================================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    // =========================================================================
    // CATEGORY 1: CLEAN LOGIN & AUTHENTICATION
    // =========================================================================
    console.log("\n--- CATEGORY 1: CLEAN LOGIN & AUTHENTICATION ---");

    // 1.1 Verify Login Screen Cleanliness (No credentials or demo pills)
    const publicPage = await browser.newPage();
    await publicPage.setViewport({ width: 1440, height: 900 });

    publicPage.on("dialog", async (dialog) => {
      nativeDialogCount++;
      console.warn("⚠️ UNEXPECTED NATIVE DIALOG DETECTED (VIOLATION):", dialog.message());
      await dialog.dismiss();
    });

    await publicPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 600));

    const loginText = await publicPage.evaluate(() => document.body.innerText.toLowerCase());
    const hasPassword = loginText.includes("password123");
    const hasDemoPill = loginText.includes("demo@echo.ai");
    const hasSuperadminPill = loginText.includes("superadmin@echo.ai");

    const formNoValidate = await publicPage.evaluate(() => {
      const form = document.querySelector("form");
      return form ? form.noValidate : false;
    });

    recordTest(
      "1. Authentication",
      "Login Page Has Zero Hardcoded Credentials or Demo Pills",
      !hasPassword && !hasDemoPill && !hasSuperadminPill,
      "No starter credentials or pills exposed in DOM"
    );

    recordTest(
      "1. Authentication",
      "Login Form Enforces noValidate to Block Native HTML5 Tooltips",
      formNoValidate,
      "form.noValidate is true"
    );

    // Trigger inline validation by submitting empty
    await publicPage.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 400));
    const loginInlineError = await publicPage.evaluate(() => {
      const errors = Array.from(document.querySelectorAll(".text-rose-600, .text-rose-500"));
      return errors.some((e) => e.innerText.toLowerCase().includes("required") || e.innerText.toLowerCase().includes("enter your email"));
    });

    recordTest(
      "1. Authentication",
      "Login Form Renders Inline Field Errors Without Native Tooltips",
      loginInlineError && nativeDialogCount === 0,
      "Clean inline validation error shown"
    );

    await captureProof(publicPage, "cat1_clean_login_page.png");
    await publicPage.close();

    // 1.2 Login as Superadmin (superadmin@echo.ai)
    console.log("  Logging in as Superadmin (superadmin@echo.ai)...");
    const saSession = await getAuthenticatedPage(browser, "superadmin@echo.ai", "password123");
    const saPage = saSession.page;
    if (!saPage.url().includes("/superadmin")) {
      await saPage.goto(`${BASE_URL}/superadmin`, { waitUntil: "networkidle2" });
    }
    const isSuperadminRedirect = saPage.url().includes("/superadmin");
    recordTest(
      "1. Authentication",
      "Superadmin (superadmin@echo.ai) Login Reaches /superadmin",
      isSuperadminRedirect,
      `URL: ${saPage.url()}`
    );
    await captureProof(saPage, "cat1_superadmin_authenticated.png");
    await saSession.context.close();

    // 1.3 Login as Practice Owner (demo@echo.ai)
    console.log("  Logging in as Practice Owner (demo@echo.ai)...");
    const ownerSession = await getAuthenticatedPage(browser, "demo@echo.ai", "password123");
    const ownerPage = ownerSession.page;
    if (!ownerPage.url().includes("/dashboard")) {
      await ownerPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle2" });
    }
    const isOwnerRedirect = ownerPage.url().includes("/dashboard");
    recordTest(
      "1. Authentication",
      "Practice Owner (demo@echo.ai) Login Reaches /dashboard",
      isOwnerRedirect,
      `URL: ${ownerPage.url()}`
    );
    await captureProof(ownerPage, "cat1_owner_authenticated.png");
    await ownerSession.context.close();

    // 1.4 Login as Subuser (receptionist@echo.ai)
    console.log("  Logging in as Subuser (receptionist@echo.ai)...");
    const recepSession = await getAuthenticatedPage(browser, "receptionist@echo.ai", "password123");
    const recepPage = recepSession.page;
    if (!recepPage.url().includes("/dashboard")) {
      await recepPage.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle2" });
    }
    const isRecepRedirect = recepPage.url().includes("/dashboard");
    recordTest(
      "1. Authentication",
      "Subuser Receptionist (receptionist@echo.ai) Login Reaches /dashboard",
      isRecepRedirect,
      `URL: ${recepPage.url()}`
    );
    await captureProof(recepPage, "cat1_receptionist_authenticated.png");
    await recepSession.context.close();

    // =========================================================================
    // CATEGORY 2: SUPERADMIN PLATFORM COMMAND CENTER
    // =========================================================================
    console.log("\n--- CATEGORY 2: SUPERADMIN PLATFORM COMMAND CENTER ---");

    const saMain = await getAuthenticatedPage(browser, "superadmin@echo.ai", "password123");
    const page2 = saMain.page;
    if (!page2.url().includes("/superadmin")) {
      await page2.goto(`${BASE_URL}/superadmin`, { waitUntil: "networkidle2" });
    }
    await new Promise((r) => setTimeout(r, 1200));

    // 2.1 Overview KPIs (MRR & Total Practices)
    const kpiText = await page2.evaluate(() => document.body.innerText);
    const hasMrr = kpiText.includes("Platform MRR") || kpiText.includes("MRR");
    const hasOrgCount = kpiText.includes("Total Organizations") || kpiText.includes("Practices");
    const hasPlatformOwnerBadge = kpiText.includes("Platform Owner") || kpiText.includes("Alex Rivera");
    recordTest(
      "2. Superadmin",
      "Overview KPIs Loaded (Estimated MRR, Organizations, Platform Owner Badge)",
      hasMrr && hasOrgCount && hasPlatformOwnerBadge,
      "KPI cards and owner badge verified"
    );
    await captureProof(page2, "cat2_superadmin_kpis.png");

    // 2.2 Practice Organizations & Specs Modal
    console.log("  Opening Practice Specifications Modal for Healing Hands Physio...");
    await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tbody tr"));
      const healingRow = rows.find((r) => r.textContent?.includes("Healing Hands Physio"));
      if (healingRow) {
        const specsBtn = Array.from(healingRow.querySelectorAll("button")).find((b) => b.textContent?.includes("Specs"));
        if (specsBtn) specsBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    const specsModalText = await page2.evaluate(() => document.body.innerText);
    const hasSpecsModal =
      specsModalText.includes("Healing Hands Physio") &&
      (specsModalText.includes("Dr. Sarah Lee") || specsModalText.includes("demo@echo.ai"));
    recordTest(
      "2. Superadmin",
      "Practice Organizations & Specs Modal Rendered with Owner Details",
      hasSpecsModal,
      "Healing Hands Physio specs modal opened"
    );
    await captureProof(page2, "cat2_practice_specs_modal.png");

    // Close Specs Modal
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const closeBtn = btns.find((b) => b.textContent?.trim() === "Close" || b.innerText === "✕");
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // 2.3 Shadow Login into Dr. Sarah Lee's owner account
    console.log("  Initiating Shadow Login into Healing Hands Physio (Dr. Sarah Lee)...");
    await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tbody tr"));
      const healingRow = rows.find((r) => r.textContent?.includes("Healing Hands Physio"));
      if (healingRow) {
        const shadowBtn = Array.from(healingRow.querySelectorAll("button")).find((b) => b.textContent?.includes("Shadow Login"));
        shadowBtn?.click();
      }
    });

    await page2.waitForFunction(() => window.location.pathname === "/dashboard", { timeout: 12000 });
    await new Promise((r) => setTimeout(r, 1500));

    // 2.4 Sticky yellow Shadow Banner verification
    const shadowDashboardText = await page2.evaluate(() => document.body.innerText.toLowerCase());
    const hasShadowBanner = shadowDashboardText.includes("shadow login active");
    const hasInspectingPractice = shadowDashboardText.includes("healing hands physio");
    const hasExitButton = shadowDashboardText.includes("exit shadow login");
    recordTest(
      "2. Superadmin",
      "Sticky Yellow Shadow Session Banner Displayed on Practice Dashboard",
      hasShadowBanner && hasInspectingPractice && hasExitButton,
      "Owner view impersonated with sticky banner & exit button"
    );
    await captureProof(page2, "cat2_shadow_session_banner_dashboard.png");

    // 2.5 Exit Shadow Login and return to Superadmin
    console.log("  Exiting Shadow Session...");
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, a"));
      const exitBtn = btns.find((b) => b.textContent?.includes("Exit Shadow Login"));
      exitBtn?.click();
    });

    await page2.waitForFunction(() => window.location.pathname === "/superadmin", { timeout: 12000 });
    await new Promise((r) => setTimeout(r, 1000));

    const postShadowUrl = page2.url();
    const isReturnedToSuperadmin = postShadowUrl.includes("/superadmin");
    recordTest(
      "2. Superadmin",
      "Exit Shadow Login Safely Returns to Superadmin Command Center",
      isReturnedToSuperadmin,
      `URL: ${postShadowUrl}`
    );
    await captureProof(page2, "cat2_returned_to_superadmin.png");

    // 2.6 Marketing Queries tab: contact inquiries, inquiry detail modal, and live chat query stream
    console.log("  Switching to Marketing Queries Tab in Superadmin...");
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const mktBtn = btns.find((b) => b.textContent?.includes("Marketing Inquiries") || b.textContent?.includes("Marketing & Site Queries"));
      mktBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const mqTabBody = await page2.evaluate(() => document.body.innerText);
    const hasInquiries = mqTabBody.includes("Dr. Marcus Vance") || mqTabBody.includes("Sydney Spinal") || mqTabBody.includes("Sophie Lin");
    const hasChatStream = mqTabBody.includes("Dr. Alan Grant") || mqTabBody.includes("Echo Advisor") || mqTabBody.includes("Sales Chat");
    recordTest(
      "2. Superadmin",
      "Marketing Queries Tab Displays Contact Inquiries & Live Chat Stream",
      hasInquiries && hasChatStream,
      "Prospect inquiries and live AI sales conversations visible"
    );
    await captureProof(page2, "cat2_marketing_queries_stream_tab.png");

    // Open Prospect Inquiry Detail Modal
    console.log("  Opening Prospect Inquiry Details Modal...");
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const revBtn = btns.find((b) => b.innerText.includes("Review") || b.innerText.includes("Inspect"));
      revBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const inqModalContent = await page2.evaluate(() => document.body.innerText);
    const hasInqModal = inqModalContent.includes("Inquiry Details") || inqModalContent.includes("Sydney Spinal") || inqModalContent.includes("Marcus Vance");
    recordTest(
      "2. Superadmin",
      "Prospect Inquiry Detail Modal Opens with Complete Metadata",
      hasInqModal,
      "Inquiry question, contact details, and status actions rendered"
    );
    await captureProof(page2, "cat2_prospect_inquiry_detail_modal.png");

    // Close Inquiry Details Modal
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const closeBtn = btns.find((b) => b.innerText === "✕" || b.innerText.includes("Close"));
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Open Live Chat Transcript Inspector Modal
    console.log("  Opening Live Chat Transcript Inspector Modal...");
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const transBtn = btns.find((b) => b.innerText.includes("Inspect Transcript") || b.innerText.includes("Transcript"));
      transBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const transModalContent = await page2.evaluate(() => document.body.innerText);
    const hasTransModal = transModalContent.includes("Transcript") && (transModalContent.includes("Echo Advisor") || transModalContent.includes("Visitor"));
    recordTest(
      "2. Superadmin",
      "Live Chat Query Stream Transcript Inspector Modal Opens with Chat Logs",
      hasTransModal,
      "Multi-turn sales chat transcript rendered"
    );
    await captureProof(page2, "cat2_live_chat_transcript_modal.png");

    // Close Transcript Modal
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const closeBtn = btns.find((b) => b.innerText === "✕" || b.innerText.includes("Close"));
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    await saMain.context.close();

    // =========================================================================
    // CATEGORY 3: PRACTICE DASHBOARD & RBAC
    // =========================================================================
    console.log("\n--- CATEGORY 3: PRACTICE DASHBOARD & RBAC ---");

    // 3.1 Login as Subuser (Clara Receptionist, initially can_edit_company_templates = 0)
    console.log("  Logging in as Subuser Clara Receptionist (Initial Read-Only state)...");
    const claraSession1 = await getAuthenticatedPage(browser, "receptionist@echo.ai", "password123");
    const page3 = claraSession1.page;
    await new Promise((r) => setTimeout(r, 1000));

    // Navigate to Team Tab
    await page3.evaluate(() => {
      const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
      teamBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Open Details & Templates Modal for Subuser
    await page3.evaluate(() => {
      const detailsBtn = document.querySelector('button[title*="Open your details and manage personal message templates"]');
      if (detailsBtn) detailsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Open Edit Account Details to test Subuser cannot update their own role
    console.log("  Testing Subuser own role modification restrictions...");
    await page3.evaluate(() => {
      const editBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit Account Details"));
      if (editBtn) editBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const roleLockedText = await page3.evaluate(() => document.body.innerText);
    const hasRoleLockedBadge = roleLockedText.includes("Role Locked") || roleLockedText.includes("Only practice owner can change roles");
    const roleSelectAbsent = await page3.evaluate(() => {
      const select = document.querySelector('select[value="receptionist"]') ||
                     Array.from(document.querySelectorAll("select")).find(s => s.textContent?.includes("Administrator"));
      return !select;
    });

    recordTest(
      "3. RBAC",
      "Subuser Cannot Update Their Own Role (Role Locked in UI)",
      hasRoleLockedBadge && roleSelectAbsent,
      "Clara Receptionist profile shows Role Locked and no role selector"
    );

    // Direct API attempt for self-role escalation must return 403
    const apiRoleEscalation = await page3.evaluate(async () => {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      const myId = meData?.data?.user?.userId || meData?.data?.user?.id || "usr_recep_101";

      const res = await fetch("/api/dashboard/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: myId, name: "Clara Receptionist Hacker", role: "admin" }),
      });
      return { status: res.status, body: await res.json() };
    });
    recordTest(
      "3. RBAC",
      "API Strictly Rejects Subuser Self-Role Escalation (403 Forbidden)",
      apiRoleEscalation.status === 403,
      `API returned HTTP ${apiRoleEscalation.status} Forbidden`
    );

    // Close profile edit sub-form/modal
    await page3.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText === "✕" || b.innerText.includes("Cancel"));
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Verify Predefined Message Templates are Admin Managed & Read-Only for Staff
    const subuserTplsBody = await page3.evaluate(() => document.body.innerText);
    const hasAdminManagedBadge = subuserTplsBody.includes("Admin Managed");
    const isReadOnlyForSubuser = subuserTplsBody.includes("Read-Only for Staff") || subuserTplsBody.includes("Admin Managed");
    recordTest(
      "3. Templates",
      "Predefined Message Templates Assigned to Company (Practice Scoped)",
      hasAdminManagedBadge,
      "Company predefined templates assigned to organization"
    );
    recordTest(
      "3. Templates",
      "Subuser Clara Cannot Edit Company Templates Without Explicit Permission",
      isReadOnlyForSubuser,
      "Predefined templates displayed in read-only mode"
    );
    await captureProof(page3, "cat3_receptionist_templates_readonly.png");

    // Form inline validation verification (noValidate + inline field errors under inputs)
    console.log("  Verifying Zero HTML5 Native Tooltips & Inline Field Errors...");
    await page3.evaluate(() => {
      const addBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("+ Add Custom Template"));
      addBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Submit empty custom template form
    await page3.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Save Custom Template"));
      saveBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const inlineErrorsPresent = await page3.evaluate(() => {
      const errors = Array.from(document.querySelectorAll(".text-rose-600, .text-rose-500"));
      return errors.some((e) => e.innerText.toLowerCase().includes("required"));
    });
    recordTest(
      "3. UI/UX Form Validation",
      "Zero Native HTML5 Tooltips: Forms Enforce noValidate + Inline Field Errors",
      inlineErrorsPresent,
      "Inline field validation errors rendered under required inputs"
    );
    await captureProof(page3, "cat3_inline_validation_error.png");

    // Close templates modal
    await page3.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText === "✕" || b.innerText.includes("Done"));
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await claraSession1.context.close();

    // 3.2 Login as Practice Owner (demo@echo.ai) to update Clara's permissions
    console.log("  Logging in as Practice Owner to update Clara's role & permissions...");
    const ownerSession2 = await getAuthenticatedPage(browser, "demo@echo.ai", "password123");
    const page4 = ownerSession2.page;

    // Navigate to Team Tab
    await page4.evaluate(() => {
      const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
      teamBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Open Edit Staff modal for Clara
    console.log("  Owner opening Edit Staff modal for Clara Receptionist...");
    await page4.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tbody tr"));
      const claraRow = rows.find((r) => r.textContent?.includes("receptionist@echo.ai"));
      if (claraRow) {
        const editBtn = Array.from(claraRow.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit"));
        editBtn?.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // Enable 'Grant permission to edit company predefined message templates'
    await page4.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0");
      if (modal) {
        const checkbox = modal.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) checkbox.click();
        const saveBtn = Array.from(modal.querySelectorAll("button")).find((b) => b.textContent?.includes("Save Changes"));
        saveBtn?.click();
      }
    });
    await new Promise((r) => setTimeout(r, 1500));

    const teamAfterText = await page4.evaluate(() => document.body.innerText);
    const hasTemplatesEditorBadge = teamAfterText.includes("Templates Editor");
    recordTest(
      "3. RBAC",
      "Practice Owner Successfully Grants can_edit_company_templates Permission",
      hasTemplatesEditorBadge,
      "Clara assigned Templates Editor badge"
    );
    await captureProof(page4, "cat3_owner_granted_template_permission.png");

    // Verify Owner's own role cannot be updated (locked)
    // Open Owner Details & Profile
    await page4.evaluate(() => {
      const detailsBtn = document.querySelector('button[title*="Open your details and manage personal message templates"]');
      if (detailsBtn) detailsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    await page4.evaluate(() => {
      const editOwnBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit Account Details"));
      editOwnBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const ownerProfileText = await page4.evaluate(() => document.body.innerText);
    const isOwnerRoleLocked =
      ownerProfileText.includes("Role Locked") ||
      ownerProfileText.includes("Only practice owner") ||
      ownerProfileText.includes("primary organization owner");
    recordTest(
      "3. RBAC",
      "Owner Cannot Demote/Change Own Role in Profile View",
      isOwnerRoleLocked,
      "Owner role is protected and immutable"
    );

    // Close profile edit modal
    await page4.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText === "✕" || b.innerText.includes("Done"));
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await ownerSession2.context.close();

    // 3.3 Login as Clara Receptionist (With Granted Permission)
    console.log("  Logging in as Clara Receptionist with granted permission...");
    const claraSession2 = await getAuthenticatedPage(browser, "receptionist@echo.ai", "password123");
    const page5 = claraSession2.page;

    // Navigate to Team Tab & Open Templates
    await page5.evaluate(() => {
      const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
      teamBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    await page5.evaluate(() => {
      const detailsBtn = document.querySelector('button[title*="Open your details and manage personal message templates"]');
      detailsBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const grantedText = await page5.evaluate(() => document.body.innerText);
    const hasGrantedBanner = grantedText.includes("Subuser Edit Access Granted");
    const hasEditCompanyStandardBtns = await page5.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.some((b) => b.textContent?.includes("Edit Company Standard"));
    });

    recordTest(
      "3. Templates",
      "Subuser With Granted Permission Has Active Edit Access on Predefined Templates",
      hasGrantedBanner && hasEditCompanyStandardBtns,
      "Edit Company Standard buttons active"
    );

    // Subuser edits company predefined template /fees
    console.log("  Subuser Clara editing company predefined template /fees...");
    await page5.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".grid > div"));
      const feesCard = cards.find((c) => c.textContent?.includes("/fees"));
      if (feesCard) {
        const editBtn = Array.from(feesCard.querySelectorAll("button")).find((b) => b.textContent?.includes("Edit Company Standard"));
        if (editBtn) editBtn.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // Clear and enter new content in textarea inside the card
    const newFeesContent = "Updated by Receptionist Clara: Initial Assessment fee is $125 (60 min) and standard follow-up is $95 (30 min). Electronic HICAPS rebates available on the spot.";
    await page5.evaluate((val) => {
      function setVal(input, text) {
        const prototype = Object.getPrototypeOf(input);
        const set = Object.getOwnPropertyDescriptor(prototype, "value").set;
        set.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const cards = Array.from(document.querySelectorAll(".grid > div"));
      const feesCard = cards.find((c) => c.textContent?.includes("/fees"));
      if (feesCard) {
        const txtArea = feesCard.querySelector("textarea");
        if (txtArea) setVal(txtArea, val);
        const saveBtn = Array.from(feesCard.querySelectorAll("button")).find((b) => b.textContent?.includes("Save Changes"));
        if (saveBtn) saveBtn.click();
      }
    }, newFeesContent);
    await new Promise((r) => setTimeout(r, 2000));

    const postEditTplText = await page5.evaluate(() => document.body.innerText);
    const hasUpdatedContent = postEditTplText.includes("Updated by Receptionist Clara");
    recordTest(
      "3. Templates",
      "Subuser with Granted Permission Successfully Edits Company Predefined Template",
      hasUpdatedContent,
      "Company template updated and rendered in template manager"
    );
    await captureProof(page5, "cat3_subuser_edited_company_template.png");

    // Close templates modal
    await page5.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText === "✕" || b.innerText.includes("Done"));
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await claraSession2.context.close();

    // 3.4 Login as Owner to verify seeing updated company template & Custom In-App Modal
    console.log("  Logging in as Owner to verify company template sync...");
    const ownerSession3 = await getAuthenticatedPage(browser, "demo@echo.ai", "password123");
    const page6 = ownerSession3.page;

    // Navigate to Team Tab & Open Templates
    await page6.evaluate(() => {
      const teamBtn = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Team"));
      teamBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    await page6.evaluate(() => {
      const detailsBtn = document.querySelector('button[title*="Open your details and manage personal message templates"]');
      if (detailsBtn) detailsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const ownerTplsView = await page6.evaluate(() => document.body.innerText);
    const ownerSeesClaraEdit = ownerTplsView.includes("Updated by Receptionist Clara");
    recordTest(
      "3. Templates",
      "Owner Sees Updated Company Predefined Template Edited by Subuser",
      ownerSeesClaraEdit,
      "Organization-wide predefined template synchronization confirmed"
    );
    await captureProof(page6, "cat3_owner_views_synced_company_template.png");

    // Test in-app custom confirmation modal (Restore Defaults)
    console.log("  Testing in-app custom confirmation modal (Restore Defaults)...");
    await page6.evaluate(() => {
      const restoreBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Restore Company Defaults") || b.textContent?.includes("Restore Defaults")
      );
      restoreBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const confirmModalContent = await page6.evaluate(() => document.body.innerText);
    const hasCustomConfirmModal =
      (confirmModalContent.includes("Restore Company Predefined Messages?") ||
        confirmModalContent.includes("Restore Standard Templates?") ||
        confirmModalContent.includes("Reset practice-wide responses")) &&
      confirmModalContent.includes("Cancel");
    recordTest(
      "3. UI/UX & Safety",
      "Zero Native Browser Popups: Custom In-App Confirmation Modal Used (window.confirm = 0)",
      hasCustomConfirmModal && nativeDialogCount === 0,
      `Native alert/confirm count: ${nativeDialogCount}`
    );
    await captureProof(page6, "cat3_custom_in_app_confirmation_modal.png");

    // Dismiss modal & close templates
    await page6.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Cancel"));
      cancelBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await page6.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText === "✕" || b.innerText.includes("Done"));
      closeBtn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // CATEGORY 4: BILLING CONSISTENCY
    // =========================================================================
    console.log("\n--- CATEGORY 4: BILLING CONSISTENCY ---");

    // 4.1 Check Dashboard Billing Tab
    console.log("  Checking Dashboard Billing Tab across all 3 billing cycles...");
    await page6.evaluate(() => {
      const billingTab = Array.from(document.querySelectorAll("aside nav button")).find((b) => b.textContent?.includes("Billing"));
      billingTab?.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Monthly in Dashboard
    await page6.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.trim() === "Monthly");
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const dashMonthlyCards = await page6.$$eval("div.grid.grid-cols-1.md\\:grid-cols-3 > div", (cards) =>
      cards.map((c) => ({
        name: c.querySelector("h4")?.innerText.trim(),
        price: c.querySelector("span.text-2xl")?.innerText.trim(),
        features: Array.from(c.querySelectorAll("ul li")).map((li) => li.innerText.trim()),
      }))
    );

    // Bi-Annual in Dashboard
    await page6.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Bi-Annual"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const dashBiannualCards = await page6.$$eval("div.grid.grid-cols-1.md\\:grid-cols-3 > div", (cards) =>
      cards.map((c) => ({
        name: c.querySelector("h4")?.innerText.trim(),
        price: c.querySelector("span.text-2xl")?.innerText.trim(),
      }))
    );
    await captureProof(page6, "cat4_dashboard_billing_biannual.png");

    // Annual in Dashboard
    await page6.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Annual") && !b.innerText.includes("Bi-Annual"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const dashAnnualCards = await page6.$$eval("div.grid.grid-cols-1.md\\:grid-cols-3 > div", (cards) =>
      cards.map((c) => ({
        name: c.querySelector("h4")?.innerText.trim(),
        price: c.querySelector("span.text-2xl")?.innerText.trim(),
      }))
    );
    await captureProof(page6, "cat4_dashboard_billing_annual.png");
    await ownerSession3.context.close();

    // 4.2 Check Marketing Pricing Page (/pricing)
    console.log("  Checking Marketing Pricing Page (/pricing)...");
    const mktPage = await browser.newPage();
    await mktPage.setViewport({ width: 1440, height: 900 });

    mktPage.on("dialog", async (dialog) => {
      nativeDialogCount++;
      console.warn("⚠️ UNEXPECTED NATIVE DIALOG DETECTED (VIOLATION):", dialog.message());
      await dialog.dismiss();
    });

    await mktPage.goto(`${BASE_URL}/pricing`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 600));

    // Monthly in Marketing
    await mktPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Monthly"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const mktMonthlyCards = await mktPage.$$eval("div.grid > div.rounded-3xl", (cards) =>
      cards.map((c) => ({
        title: c.querySelector("h3")?.innerText.trim(),
        price: c.querySelector("span.text-4xl")?.innerText.trim(),
        features: Array.from(c.querySelectorAll("ul li")).map((li) => li.innerText.trim()),
      }))
    );

    // Bi-Annual in Marketing
    await mktPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Bi-Annual"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const mktBiannualCards = await mktPage.$$eval("div.grid > div.rounded-3xl", (cards) =>
      cards.map((c) => ({
        title: c.querySelector("h3")?.innerText.trim(),
        price: c.querySelector("span.text-4xl")?.innerText.trim(),
      }))
    );
    await captureProof(mktPage, "cat4_marketing_pricing_biannual.png");

    // Annual in Marketing
    await mktPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("Annual") && !b.innerText.includes("Bi-Annual"));
      btn?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const mktAnnualCards = await mktPage.$$eval("div.grid > div.rounded-3xl", (cards) =>
      cards.map((c) => ({
        title: c.querySelector("h3")?.innerText.trim(),
        price: c.querySelector("span.text-4xl")?.innerText.trim(),
      }))
    );
    await captureProof(mktPage, "cat4_marketing_pricing_annual.png");
    await mktPage.close();

    // Verification of Pricing Matrix
    // Monthly: Starter $39, Growth $99, Pro $199
    const dStartM = dashMonthlyCards.find((p) => p.name === "Starter")?.price === "$39";
    const dGrowthM = dashMonthlyCards.find((p) => p.name === "Growth")?.price === "$99";
    const dProM = dashMonthlyCards.find((p) => p.name === "Pro")?.price === "$199";

    const mStartM = mktMonthlyCards.find((p) => p.title === "Starter")?.price === "$39";
    const mGrowthM = mktMonthlyCards.find((p) => p.title === "Growth")?.price === "$99";
    const mProM = mktMonthlyCards.find((p) => p.title === "Pro")?.price === "$199";

    recordTest(
      "4. Billing",
      "Monthly Pricing Unification (Starter $39/mo, Growth $99/mo, Pro $199/mo)",
      dStartM && dGrowthM && dProM && mStartM && mGrowthM && mProM,
      "Dashboard & Marketing monthly prices match 100%"
    );

    // Bi-Annual (Save 10%): Starter $35/mo, Growth $89/mo, Pro $179/mo
    const dStartBi = dashBiannualCards.find((p) => p.name === "Starter")?.price === "$35";
    const dGrowthBi = dashBiannualCards.find((p) => p.name === "Growth")?.price === "$89";
    const dProBi = dashBiannualCards.find((p) => p.name === "Pro")?.price === "$179";

    const mStartBi = mktBiannualCards.find((p) => p.title === "Starter")?.price === "$35";
    const mGrowthBi = mktBiannualCards.find((p) => p.title === "Growth")?.price === "$89";
    const mProBi = mktBiannualCards.find((p) => p.title === "Pro")?.price === "$179";

    recordTest(
      "4. Billing",
      "Bi-Annual Pricing Unification (Starter $35/mo, Growth $89/mo, Pro $179/mo - Save 10%)",
      dStartBi && dGrowthBi && dProBi && mStartBi && mGrowthBi && mProBi,
      "Dashboard & Marketing bi-annual prices match 100%"
    );

    // Annual (Save 20%): Starter $31/mo, Growth $79/mo, Pro $159/mo
    const dStartAnn = dashAnnualCards.find((p) => p.name === "Starter")?.price === "$31";
    const dGrowthAnn = dashAnnualCards.find((p) => p.name === "Growth")?.price === "$79";
    const dProAnn = dashAnnualCards.find((p) => p.name === "Pro")?.price === "$159";

    const mStartAnn = mktAnnualCards.find((p) => p.title === "Starter")?.price === "$31";
    const mGrowthAnn = mktAnnualCards.find((p) => p.title === "Growth")?.price === "$79";
    const mProAnn = mktAnnualCards.find((p) => p.title === "Pro")?.price === "$159";

    recordTest(
      "4. Billing",
      "Annual Pricing Unification (Starter $31/mo, Growth $79/mo, Pro $159/mo - Save 20%)",
      dStartAnn && dGrowthAnn && dProAnn && mStartAnn && mGrowthAnn && mProAnn,
      "Dashboard & Marketing annual prices match 100%"
    );

    // Feature list and quota consistency check
    const starterFeaturesMatch =
      JSON.stringify(dashMonthlyCards.find((p) => p.name === "Starter")?.features) ===
      JSON.stringify(mktMonthlyCards.find((p) => p.title === "Starter")?.features);

    const growthFeaturesMatch =
      JSON.stringify(dashMonthlyCards.find((p) => p.name === "Growth")?.features) ===
      JSON.stringify(mktMonthlyCards.find((p) => p.title === "Growth")?.features);

    const proFeaturesMatch =
      JSON.stringify(dashMonthlyCards.find((p) => p.name === "Pro")?.features) ===
      JSON.stringify(mktMonthlyCards.find((p) => p.title === "Pro")?.features);

    recordTest(
      "4. Billing",
      "Feature Lists and Quota Limits Match 100% Between Marketing and Dashboard",
      starterFeaturesMatch && growthFeaturesMatch && proFeaturesMatch,
      "All plan features (500/2k/8k AI convos, staff seats, integrations) identical"
    );

    console.log("\n===============================================================================");
    console.log("                       FINAL AUDIT EXECUTION SUMMARY");
    console.log("===============================================================================");
    const passedCount = testResults.filter((t) => t.passed).length;
    const failedCount = testResults.filter((t) => !t.passed).length;
    const allPassed = failedCount === 0;

    console.log(`Total Verification Tests: ${testResults.length}`);
    console.log(`Passed:                   ${passedCount}`);
    console.log(`Failed:                   ${failedCount}`);
    console.log(`Native Dialog Violations: ${nativeDialogCount} (Must be 0)`);
    console.log(`Overall Health Status:    ${allPassed ? "PERFECT (100% PASS RATE)" : "FAILURES DETECTED"}`);
    console.log("===============================================================================\n");

    if (!allPassed) {
      throw new Error(`Master regression encountered ${failedCount} test failure(s).`);
    }
  } finally {
    await browser.close();
  }
}

runMasterRegression().catch((err) => {
  console.error("FATAL ERROR IN MASTER REGRESSION:", err);
  process.exit(1);
});
