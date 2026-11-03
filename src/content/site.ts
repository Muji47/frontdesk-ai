/** Shared, non-industry content for the marketing pages. Status labels are deliberately honest. */

export const nav = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/industries", label: "Industries" },
  { href: "/integrations", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Live demo" },
  { href: "/security", label: "Security" },
];

export const footerCols: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Product", links: [
    { href: "/features", label: "Features" }, { href: "/how-it-works", label: "How it works" },
    { href: "/demo", label: "Live demo" }, { href: "/pricing", label: "Pricing" }, { href: "/roi", label: "ROI calculator" } ] },
  { title: "Industries", links: [
    { href: "/for/clinic", label: "Clinics & health" }, { href: "/for/ecommerce", label: "E-commerce" },
    { href: "/for/realestate", label: "Real estate" }, { href: "/for/beauty", label: "Salons & wellness" }, { href: "/industries", label: "All industries" } ] },
  { title: "Company", links: [
    { href: "/about", label: "About" }, { href: "/security", label: "Security & privacy" },
    { href: "/compare", label: "How we compare" }, { href: "/integrations", label: "Integrations" }, { href: "/contact", label: "Contact" } ] },
  { title: "Account", links: [ { href: "/login", label: "Log in" }, { href: "/signup", label: "Start free trial" } ] },
];

export type IntegrationStatus = "Launch" | "Next" | "Planned";
export const integrationGroups: { group: string; items: { name: string; desc: string; status: IntegrationStatus }[] }[] = [
  { group: "Booking & practice software", items: [
    { name: "Cliniko", desc: "Practitioners, appointment types, live availability and booking for clinics.", status: "Launch" },
    { name: "Halaxy", desc: "Appointments, patients and practitioners.", status: "Next" },
    { name: "Google Calendar", desc: "Simple availability and booking for small teams.", status: "Planned" } ] },
  { group: "E-commerce", items: [
    { name: "Shopify", desc: "Order status, products, stock and returns.", status: "Launch" },
    { name: "WooCommerce", desc: "Orders and products for WordPress stores.", status: "Next" },
    { name: "Shipping carriers", desc: "Live tracking from major carriers.", status: "Planned" } ] },
  { group: "Channels", items: [
    { name: "Website widget", desc: "One script for any site: WordPress, Webflow, Shopify, Wix, Squarespace, custom.", status: "Launch" },
    { name: "Email", desc: "Confirmations, handover and unanswered-question alerts.", status: "Launch" },
    { name: "SMS", desc: "Reminders and follow-ups, with consent records.", status: "Next" },
    { name: "WhatsApp & Instagram", desc: "Chat with customers where they already are.", status: "Planned" },
    { name: "Phone / voice", desc: "AI answering for calls.", status: "Planned" } ] },
  { group: "Developer", items: [
    { name: "Webhooks & API", desc: "Send leads and events to your CRM or tools.", status: "Next" } ] },
];

export const tourTabs: { id: string; label: string; title: string; body: string; bullets: string[]; mock: { who: "user" | "bot" | "card"; text: string }[] }[] = [
  { id: "knowledge", label: "Knowledge", title: "Answers only from what you approve",
    body: "Point it at your website, upload PDFs, add FAQs. It searches your content and cites nothing it can’t find.",
    bullets: ["Website crawl, PDF, DOCX, text and FAQ sources", "Indexing status and one-click re-sync", "Says “I don’t know” instead of guessing"],
    mock: [{ who: "user", text: "Do you do rehabilitation?" }, { who: "bot", text: "Yes — post-surgery and sports rehab. Want to book a first visit?" }] },
  { id: "actions", label: "Actions", title: "Does the task, not just the talk",
    body: "Checks real availability, tracks real orders and starts real returns through your existing tools. The system confirms; the AI never invents.",
    bullets: ["Live availability and booking", "Order lookup after identity check", "Booking confirmed only once your system confirms it"],
    mock: [{ who: "user", text: "Where is order #10842?" }, { who: "card", text: "Order #10842 · In transit · Arrives tomorrow 4 PM" }] },
  { id: "handover", label: "Handover", title: "Humans stay in control",
    body: "Clinical, upset or high-value conversations go to your team with the full transcript. While a person has control, the AI stays quiet.",
    bullets: ["Take over, return to AI, assign, add notes", "Rules by topic, order value or uncertainty", "After-hours behaviour you define"],
    mock: [{ who: "user", text: "I’d like to discuss my treatment with someone." }, { who: "bot", text: "Of course — connecting you with our team." }] },
  { id: "learn", label: "Improve", title: "Gets better with every unanswered question",
    body: "Anything it couldn’t answer is logged. Approve a reply once and it’s used next time.",
    bullets: ["Unanswered-question queue with counts", "Owner notification", "Approved answers go straight into the knowledge base"],
    mock: [{ who: "user", text: "Do you accept private health insurance?" }, { who: "bot", text: "I don’t have confirmed information on that. Want the team to follow up?" }] },
  { id: "results", label: "Results", title: "See outcomes, not message counts",
    body: "Track bookings, orders, leads and handovers, and which questions customers ask most.",
    bullets: ["Appointments / sales influenced", "AI resolution and handover rates", "Top customer questions"],
    mock: [{ who: "card", text: "This month · 450 conversations · 71% resolved by AI · 75 bookings" }] },
];

export const featureGroups: { title: string; items: [string, string, string][] }[] = [
  { title: "Understands your business", items: [
    ["📚", "Knowledge base", "Websites, PDFs, DOCX, text and FAQs, chunked and searchable."],
    ["🔄", "Re-sync & status", "See what’s indexed, what failed, and refresh in one click."],
    ["❓", "Unanswered questions", "A queue of gaps that turns into approved answers."] ] },
  { title: "Handles conversations", items: [
    ["💬", "Website chat widget", "Mobile-friendly, typing indicators, history, quick replies."],
    ["📥", "AI inbox", "Three-pane inbox with statuses: Active, Waiting for human, Resolved."],
    ["🌍", "Multi-language", "Reply in the customer’s language where supported."] ] },
  { title: "Takes real actions", items: [
    ["📅", "Booking", "Live availability, slot re-validation and confirmation."],
    ["📦", "Orders & returns", "Order lookup, return rules, label creation."],
    ["🎯", "Lead capture", "Collect details with consent and push them to your team."] ] },
  { title: "Keeps humans in charge", items: [
    ["🙋", "Human handover", "Rules, assignment, notes and take-over controls."],
    ["🛡️", "Safety guardrails", "No diagnosis, no invented prices or availability."],
    ["👥", "Roles & permissions", "Owner, Admin, Manager, Receptionist, Viewer."] ] },
  { title: "Automates the repetitive", items: [
    ["✉️", "Confirmations", "Instant confirmation after a booking or order action."],
    ["⏰", "Reminders", "24h / 2h reminders to cut no-shows."],
    ["🔔", "Alerts", "Notify staff on handover and unanswered questions."] ] },
  { title: "Makes it yours", items: [
    ["🎨", "Brand customisation", "Name, colours, logo, greeting, tone, position."],
    ["⚙️", "Instructions", "Plain-language rules for how the assistant behaves."],
    ["📈", "Analytics", "Conversations, resolution, handover, bookings, top questions."] ] },
];

export const securityPoints: [string, string, string][] = [
  ["🏢", "Tenant isolation", "Every record belongs to one business. Access is checked in the backend, with database-level protection as a second layer."],
  ["🔐", "Encrypted credentials", "Third-party API keys (practice software, store tokens) are encrypted at rest and only used by the integration service."],
  ["🔒", "Encryption in transit", "All traffic uses HTTPS."],
  ["👤", "Role-based access", "Owner, Admin, Manager, Receptionist and Viewer roles. Receptionists can’t change billing."],
  ["🧾", "Audit trail", "Key actions are logged so you can see who changed what."],
  ["🤖", "Safe AI behaviour", "Safety rules are enforced in code as well as prompts. The assistant doesn’t diagnose, recommend treatment, or invent prices and availability."],
  ["✅", "Backend-verified actions", "A booking is only confirmed after your booking system confirms it. The AI can request actions; the backend performs them."],
  ["🧩", "Data minimisation", "Collects only what’s needed to help — it doesn’t ask for medical history to book an appointment."],
  ["🪪", "AI transparency", "The widget says it’s an AI assistant and links to your privacy notice."],
  ["🗑️", "Retention & deletion", "Configurable retention, plus data export and deletion on request."],
  ["🛰️", "Disclosed processors", "We’ll publish the third-party providers we use, including the AI model provider, and how they handle data."],
  ["🛑", "Abuse protection", "Rate limiting, origin checks and server-side tenant resolution on the public chat endpoint."],
];

export const securityDocs: [string, string][] = [
  ["Privacy Policy", "Before launch"], ["Terms of Service", "Before launch"],
  ["Data Processing Agreement", "Before launch"], ["Subprocessor list", "Before launch"], ["Data retention policy", "Before launch"],
];

export const compareRows: { row: string; generic: string; human: string; us: string }[] = [
  { row: "Available 24/7", generic: "Yes", human: "No", us: "Yes" },
  { row: "Answers from your approved content", generic: "Sometimes", human: "Yes", us: "Yes — and says so when unsure" },
  { row: "Books into your real calendar", generic: "Rarely", human: "Yes", us: "Yes, via your booking software" },
  { row: "Tracks real orders", generic: "Rarely", human: "Yes", us: "Yes, via your store" },
  { row: "Hands over to staff with context", generic: "Basic", human: "—", us: "Yes, with rules and notes" },
  { row: "Learns from unanswered questions", generic: "No", human: "Informally", us: "Built-in queue" },
  { row: "Reports bookings / sales generated", generic: "Message counts", human: "No", us: "Yes" },
  { row: "Typical cost", generic: "Low", human: "Salary / per-call fees", us: "Flat monthly plan" },
];

export const plans = [
  { id: "starter", name: "Starter", monthly: 39, blurb: "Answer questions and capture leads.", features: ["1 website", "500 AI conversations / mo", "Knowledge base & FAQs", "Basic handover & leads", "1 team member"] },
  { id: "growth", name: "Growth", monthly: 99, highlight: true, blurb: "Book appointments and handle orders.", features: ["Everything in Starter", "2,000 conversations / mo", "Booking & order integrations", "Advanced analytics", "Basic automations", "3 team members"] },
  { id: "pro", name: "Pro", monthly: 199, blurb: "For busier or multi-site businesses.", features: ["Everything in Growth", "3 websites", "8,000 conversations / mo", "Advanced automations & leads", "10 team members", "Priority support"] },
];

export const compareTable: { feature: string; starter: string; growth: string; pro: string }[] = [
  { feature: "Websites", starter: "1", growth: "1", pro: "3" },
  { feature: "AI conversations / month", starter: "500", growth: "2,000", pro: "8,000" },
  { feature: "Knowledge base & FAQs", starter: "✓", growth: "✓", pro: "✓" },
  { feature: "Chat widget & branding", starter: "✓", growth: "✓", pro: "✓" },
  { feature: "Human handover", starter: "Basic", growth: "Advanced", pro: "Advanced" },
  { feature: "Booking / order integrations", starter: "—", growth: "✓", pro: "✓" },
  { feature: "Lead management", starter: "Basic", growth: "✓", pro: "Advanced" },
  { feature: "Analytics", starter: "Basic", growth: "Advanced", pro: "Advanced" },
  { feature: "Automations", starter: "—", growth: "Basic", pro: "Advanced" },
  { feature: "Team members", starter: "1", growth: "3", pro: "10" },
  { feature: "Priority support", starter: "—", growth: "—", pro: "✓" },
];

export const addons: [string, string][] = [
  ["Assisted setup", "One-time $99–$199: we configure your knowledge base, tone and integrations."],
  ["Extra locations", "Monthly fee per additional location."],
  ["Extra conversations", "Top-up packs if you go over your monthly limit. No surprise overage."],
  ["Advanced integrations", "Premium connectors as they’re released."],
];

export const pricingFaq: [string, string][] = [
  ["What counts as a conversation?", "One continuous chat session with a visitor, however many messages it contains."],
  ["What happens if I go over my limit?", "You’re notified before you reach it, and can upgrade or buy a top-up pack. The assistant never silently stops without warning."],
  ["Is there a free trial?", "Yes — start free, no card required for the trial. Details are confirmed at launch."],
  ["Can I cancel anytime?", "Yes. Monthly plans can be cancelled at any time; annual plans are discounted."],
  ["Are these final prices?", "No. They’re launch estimates and may change. Founding customers lock in their rate."],
];
