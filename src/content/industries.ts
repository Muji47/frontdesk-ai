/**
 * Single source of truth for the marketing site.
 * Add a new niche by adding one object here — pages, demo widget, pricing and FAQ all adapt.
 */

export type Item = [icon: string, title: string, description: string];

export type DemoReply = {
  /** lowercase keywords; first reply whose keyword appears in the user's message wins */
  match: string[];
  text: string;
  /** optional follow-up quick replies */
  chips?: string[];
  /** optional rich card rendered under the reply */
  card?: { title: string; lines: string[]; badge?: string };
};

export type Plan = { name: string; price: string; highlight?: boolean; features: string[] };

export type Industry = {
  slug: string;
  label: string;
  emoji: string;
  accent: string;
  badge: string;
  headline: string;
  sub: string;
  cta: string;
  stats: [value: string, label: string][];
  pains: Item[];
  features: Item[];
  steps: [title: string, description: string][];
  integrations: string[];
  demo: {
    site: string;
    agent: string;
    greeting: string;
    chips: string[];
    replies: DemoReply[];
    fallback: string;
    handover: string;
  };
  currency: string;
  plans: Plan[];
  faq: [question: string, answer: string][];
};

const commonStats: Industry["stats"] = [
  ["24/7", "Always-on replies"],
  ["< 30s", "Typical first response"],
  ["1 script", "To install"],
  ["Human", "Handover built in"],
];

export const industries: Record<string, Industry> = {
  general: {
    slug: "general",
    label: "Any business",
    emoji: "✨",
    accent: "#4f46e5",
    badge: "Works for service and retail businesses",
    headline: "The AI front desk for your business.",
    sub: "Answer customer questions, capture leads and take action — book, track, hand over — 24/7. Paste one script and you’re live.",
    cta: "Start free trial",
    stats: commonStats,
    pains: [
      ["🌙", "After-hours inquiries go cold", "Customers who can’t get an answer tonight buy from someone else tomorrow."],
      ["📞", "Your team is stretched", "Phones, email and walk-ins leave no time for website chats."],
      ["🔁", "Same questions, every day", "Hours, prices, policies — answered dozens of times a week."],
    ],
    features: [
      ["📚", "Learns your business", "Point it at your website, PDFs and FAQs. It answers only from what you approve."],
      ["⚡", "Takes real actions", "Connects to your booking, store or CRM tools — it doesn’t just chat."],
      ["🙋", "Human handover", "Complex or sensitive conversations go to your team with full context."],
      ["❓", "Unanswered questions", "See what it couldn’t answer, add an approved reply, and it improves."],
      ["🎨", "Fully customisable", "Your name, colours, tone, greeting and quick-reply buttons."],
      ["📈", "Clear results", "Track outcomes — bookings, orders, leads — not just message counts."],
    ],
    steps: [
      ["Connect", "Add your website and connect the tools you already use."],
      ["Customise", "Set the name, tone and look. Test it in the live preview."],
      ["Install", "Paste one script on your site and go live."],
    ],
    integrations: ["Website widget", "Email", "Calendars", "Shopify", "Cliniko", "Webhooks"],
    demo: {
      site: "Your Business",
      agent: "Alex",
      greeting: "Hi! I’m Alex, your business’s AI assistant. What can I help with?",
      chips: ["What are your hours?", "How much does it cost?", "Talk to a person"],
      replies: [
        { match: ["hour", "open", "close"], text: "We’re open Mon–Fri 9am–5pm. I’m here 24/7 to take your details if you message outside those hours." },
        { match: ["cost", "price", "pricing", "fee"], text: "Pricing comes from the information your business approves — I never guess. Want our team to send exact pricing?", chips: ["Yes, please", "Talk to a person"] },
        { match: ["yes, please"], text: "Done — I’ve passed your request to the team. What’s the best email to reach you?" },
      ],
      fallback: "I don’t have confirmed information on that, so I won’t guess. Want me to pass it to the team?",
      handover: "Of course — I’m connecting you with the team. They’ll reply right here.",
    },
    currency: "$",
    plans: [
      { name: "Starter", price: "39", features: ["1 website", "500 conversations", "Knowledge base & FAQs", "Email handover"] },
      { name: "Growth", price: "99", highlight: true, features: ["2,000 conversations", "Booking / order integrations", "Lead capture", "Analytics", "3 team members"] },
      { name: "Pro", price: "199", features: ["Multiple sites", "8,000 conversations", "Custom actions & API", "Priority support"] },
    ],
    faq: [
      ["Do I need a developer?", "No. Paste one script on your website. Guided setup covers the rest."],
      ["What if it doesn’t know the answer?", "It says so, offers a human, and logs the question so you can add an approved answer."],
      ["Can I change how it looks and sounds?", "Yes — name, colours, tone, greeting, quick replies and position are all configurable."],
      ["Which platforms does it work on?", "Any website that lets you add a script: WordPress, Webflow, Shopify, Wix, Squarespace or custom."],
    ],
  },

  clinic: {
    slug: "clinic",
    label: "Clinics & health",
    emoji: "🩺",
    accent: "#0d9488",
    badge: "Built for physio, dental and allied-health clinics",
    headline: "Turn website inquiries into booked appointments.",
    sub: "A virtual receptionist that answers service and pricing questions, checks real availability and books patients — while your team treats.",
    cta: "Start free trial",
    stats: commonStats,
    pains: [
      ["🌙", "11pm visitors never hear back", "Prospective patients search at night. No reply means they book the next clinic."],
      ["📞", "Reception is overloaded", "Calls, check-ins and email leave little time for web inquiries."],
      ["🔁", "Repetitive admin questions", "Opening hours, fees, parking, what to bring — every day."],
    ],
    features: [
      ["📅", "Appointment booking", "Reads live availability from your practice software and books only after it confirms."],
      ["📚", "Knows your clinic", "Services, fees and policies from your website and documents."],
      ["🙋", "Safe handover", "Clinical or sensitive questions go straight to your staff. No diagnosis, ever."],
      ["❓", "Unanswered questions", "Capture what patients ask that you haven’t covered yet."],
      ["🎯", "Lead capture", "Collect details from visitors who aren’t ready to book."],
      ["📈", "Bookings, not just chats", "See how many appointments the assistant generated."],
    ],
    steps: [
      ["Connect", "Add your website and connect your booking system."],
      ["Customise", "Set tone, hours and handover rules. Test with real questions."],
      ["Install", "Paste one script. Patients can book at any hour."],
    ],
    integrations: ["Cliniko", "Halaxy (planned)", "Google Calendar", "Email", "SMS (planned)"],
    demo: {
      site: "Healing Hands Physio",
      agent: "Maya",
      greeting: "Hi! Welcome to Healing Hands. I’m Maya, the clinic’s AI assistant. How can I help?",
      chips: ["Book appointment", "Pricing & fees", "Opening hours", "Do you take health insurance?"],
      replies: [
        { match: ["book", "appointment"], text: "Happy to help. Tomorrow I have these times with Dr. Lee:", chips: ["9:00 AM", "10:30 AM", "2:00 PM"] },
        { match: ["9:00", "10:30", "2:00"], text: "Great choice. I’ve checked the slot is still free.", card: { title: "Confirm appointment", lines: ["Initial consult · Dr. Lee", "Tomorrow", "Confirmation sent by email"], badge: "Ready to confirm" } },
        { match: ["price", "pricing", "fee", "cost"], text: "An initial consultation is $110 (60 min) and follow-ups are $85 (30 min). Health fund rebates may apply — our team can confirm yours." },
        { match: ["hour", "open", "close"], text: "Mon–Fri 7:30am–6:00pm, Sat 8:00am–12:00pm. Closed Sundays and public holidays." },
      ],
      fallback: "I don’t have confirmed information on that, so I won’t guess. Would you like our reception team to follow up?",
      handover: "Of course — I’m connecting you with our reception team. They’ll reply here shortly.",
    },
    currency: "$",
    plans: [
      { name: "Starter", price: "49", features: ["1 website", "300 conversations", "Knowledge base & FAQs", "Basic handover & leads"] },
      { name: "Growth", price: "99", highlight: true, features: ["1,000 conversations", "Practice-software integration", "Appointment booking", "Advanced analytics", "3 team members"] },
      { name: "Pro", price: "199", features: ["3 websites", "3,000 conversations", "Advanced automations", "10 team members", "Priority support"] },
    ],
    faq: [
      ["Does it give medical advice?", "No. It handles administrative questions only and escalates clinical questions to your staff."],
      ["What if it doesn’t know an answer?", "It says so, offers a human, and logs the question so you can add an approved answer."],
      ["Is patient information protected?", "Data is isolated per clinic, credentials are encrypted and we collect only what’s needed to book. Ask us for our privacy documentation."],
      ["Do I need to change my booking software?", "No. It connects to the software you already use."],
    ],
  },

  ecommerce: {
    slug: "ecommerce",
    label: "E-commerce",
    emoji: "🛍️",
    accent: "#e11d48",
    badge: "Shopify, WooCommerce and custom stores",
    headline: "An AI shopping assistant that answers, recommends and sells.",
    sub: "Track orders, recommend products, handle returns and recover hesitant carts — around the clock, from one script on your store.",
    cta: "Start free trial",
    stats: commonStats,
    pains: [
      ["📦", "“Where is my order?” all day", "Order-status questions swamp your inbox and slow real support."],
      ["🛒", "Shoppers leave with questions", "Size, stock and shipping doubts quietly kill conversions."],
      ["↩️", "Returns eat your time", "Every return needs policy checks, labels and back-and-forth."],
    ],
    features: [
      ["📦", "Live order tracking", "Verifies the customer, then shows real status from your store."],
      ["🛍️", "Product recommendations", "Cards with photo, price and Add to cart — only in-stock items."],
      ["↩️", "Returns & exchanges", "Applies your policy and escalates refunds and disputes."],
      ["🛒", "Cart help", "Answers sizing and shipping questions at the moment of doubt."],
      ["🙋", "Human handover", "Upset or high-value customers go to your team with context."],
      ["❓", "Unanswered questions", "Spot gaps — discounts, sizing, shipping zones — and fix them."],
    ],
    steps: [
      ["Connect store", "Link Shopify or WooCommerce. Products and policies sync."],
      ["Customise", "Brand colours, tone, quick replies and handover rules."],
      ["Install", "Paste one script or add the app block."],
    ],
    integrations: ["Shopify", "WooCommerce", "Shipping carriers", "Email", "Klaviyo (planned)"],
    demo: {
      site: "Aura Apparel",
      agent: "Aria",
      greeting: "Hi! I’m Aria, your shopping assistant. Looking for something or tracking an order?",
      chips: ["Track my order", "Find sneakers under $90", "Return an item", "Student discount?"],
      replies: [
        { match: ["track", "order", "where is"], text: "Found it — order #10842:", card: { title: "Order #10842", lines: ["FedEx · In transit", "Arrives tomorrow by 4:00 PM"], badge: "In transit" }, chips: ["Return an item"] },
        { match: ["sneaker", "shoe", "under", "product", "recommend", "find"], text: "Here’s a pick under $90 that’s in stock:", card: { title: "NeoRunner V2 — $79", lines: ["Was $110 · Sizes 7–12", "Free shipping over $100"], badge: "In stock" } },
        { match: ["return", "refund", "exchange"], text: "You can return unworn items within 30 days for a refund or free exchange. Want me to start a return?", chips: ["Start return"] },
        { match: ["start return"], text: "Started. I’ve emailed your prepaid return label." },
        { match: ["ship", "deliver"], text: "Standard shipping is 3–5 business days ($6.95), express 1–2 days ($12.95). Free standard shipping over $100." },
      ],
      fallback: "I don’t have confirmed information on that — I won’t guess. Want our support team to follow up?",
      handover: "Of course — I’m connecting you with our support team. They’ll reply here shortly.",
    },
    currency: "$",
    plans: [
      { name: "Starter", price: "39", features: ["500 conversations", "FAQ & policy answers", "Product recommendations", "Email handover"] },
      { name: "Growth", price: "99", highlight: true, features: ["2,000 conversations", "Live order tracking", "Returns workflow", "Analytics", "3 team members"] },
      { name: "Scale", price: "249", features: ["8,000 conversations", "Multiple stores", "Custom actions & API", "Priority support"] },
    ],
    faq: [
      ["Can it show real order status?", "Yes. It verifies order number and email, then reads live status from your store."],
      ["Will it invent discounts or stock?", "No. Prices, stock and policies come from your store and approved content, never guesses."],
      ["What about refunds?", "Exchanges within policy can be automatic. Refunds and disputes are handed to your team."],
      ["Does it work on Shopify?", "Yes — via script or app block. WooCommerce and custom stores are supported too."],
    ],
  },

  realestate: {
    slug: "realestate",
    label: "Real estate",
    emoji: "🏠",
    accent: "#2563eb",
    badge: "Agencies and independent agents",
    headline: "Never miss a buyer or renter inquiry again.",
    sub: "Qualify enquiries, answer listing questions and book inspections instantly — even at 10pm on a Sunday.",
    cta: "Start free trial",
    stats: commonStats,
    pains: [
      ["⏱️", "Speed wins the listing", "The first agent to reply usually gets the inspection."],
      ["🔍", "Unqualified enquiries", "Agents waste hours on people who aren’t ready or eligible."],
      ["📆", "Inspection scheduling chaos", "Back-and-forth messages just to lock in a time."],
    ],
    features: [
      ["🏡", "Listing Q&A", "Answers about price, size, features and pet rules from your listings."],
      ["🎯", "Lead qualification", "Captures budget, timeline and contact details automatically."],
      ["📅", "Inspection booking", "Offers real inspection slots and confirms by email."],
      ["🙋", "Agent handover", "Hot leads go straight to the right agent."],
      ["❓", "Unanswered questions", "Find out what buyers ask that your listings don’t say."],
      ["📈", "Lead pipeline", "See which enquiries turn into inspections."],
    ],
    steps: [
      ["Connect", "Add your site and listing feed or CRM."],
      ["Customise", "Set tone, qualification questions and agent routing."],
      ["Install", "Paste one script on your site."],
    ],
    integrations: ["Google Calendar", "Email", "CRM via webhook", "Listing feeds (planned)"],
    demo: {
      site: "Harbour Realty",
      agent: "Sam",
      greeting: "Hi! I’m Sam from Harbour Realty. Looking to buy, rent or book an inspection?",
      chips: ["Book an inspection", "Is the 2-bed pet friendly?", "Talk to an agent"],
      replies: [
        { match: ["inspection", "book", "viewing"], text: "Sure. Inspection times for 12 Park St this week:", chips: ["Thu 5:30 PM", "Sat 11:00 AM"] },
        { match: ["thu", "sat"], text: "Locked in. I’ll email the details.", card: { title: "Inspection requested", lines: ["12 Park St · 2 bed, 1 bath", "Agent: Priya"], badge: "Confirmed" } },
        { match: ["pet"], text: "Pets are considered case by case with owner approval. I can ask the agent to confirm for this property.", chips: ["Ask the agent"] },
      ],
      fallback: "I don’t have confirmed information on that. Want me to ask the agent to get back to you?",
      handover: "Of course — connecting you with an agent now.",
    },
    currency: "$",
    plans: [
      { name: "Solo", price: "49", features: ["1 agent", "300 conversations", "Lead capture", "Email handover"] },
      { name: "Agency", price: "129", highlight: true, features: ["10 agents", "1,500 conversations", "Inspection booking", "Lead pipeline", "Analytics"] },
      { name: "Group", price: "299", features: ["Multiple offices", "6,000 conversations", "CRM integration", "Priority support"] },
    ],
    faq: [
      ["Does it quote prices?", "Only prices and details present in your approved listings. Otherwise it hands over."],
      ["Can it route leads to specific agents?", "Yes — by suburb, property type or listing owner."],
      ["Does it replace my agents?", "No. It handles first response and qualification so agents spend time on serious leads."],
    ],
  },

  beauty: {
    slug: "beauty",
    label: "Salons & wellness",
    emoji: "💇",
    accent: "#9333ea",
    badge: "Salons, spas, barbers and studios",
    headline: "Fill your calendar while you’re behind the chair.",
    sub: "Answer treatment and pricing questions, offer open slots and book clients automatically — no more missed DMs and calls.",
    cta: "Start free trial",
    stats: commonStats,
    pains: [
      ["✂️", "Hands full, phone ringing", "You can’t answer while you’re mid-appointment."],
      ["📉", "Last-minute gaps", "Empty slots go unfilled because nobody replied in time."],
      ["💬", "Endless “how much?” messages", "Treatment prices and durations asked again and again."],
    ],
    features: [
      ["📅", "Auto booking", "Offers real openings by stylist and service."],
      ["💲", "Service & price answers", "From your menu — never invented."],
      ["🔔", "Reminders", "Reduce no-shows with confirmations and reminders."],
      ["🙋", "Human handover", "Special requests go to your team."],
      ["🎨", "Matches your brand", "Your colours, tone and logo."],
      ["📈", "Booking insights", "See which services people ask about most."],
    ],
    steps: [
      ["Connect", "Add your website and booking tool."],
      ["Customise", "Set your service menu, tone and brand."],
      ["Install", "Paste one script. Start taking bookings."],
    ],
    integrations: ["Google Calendar", "Email", "SMS (planned)", "Booking tools (planned)"],
    demo: {
      site: "Luna Studio",
      agent: "Lexi",
      greeting: "Hi! I’m Lexi from Luna Studio. Want to book a treatment or see our prices?",
      chips: ["Book a haircut", "Price list", "Do you do colour?"],
      replies: [
        { match: ["book", "haircut", "appointment"], text: "Lovely! Openings with Mia on Friday:", chips: ["10:00 AM", "1:30 PM"] },
        { match: ["10:00", "1:30"], text: "Booked.", card: { title: "Cut & style · Mia", lines: ["Friday", "60 min · $85"], badge: "Confirmed" } },
        { match: ["price", "menu", "cost"], text: "Cut & style from $85, colour from $140, treatments from $60. Exact quotes depend on hair length." },
        { match: ["colour", "color"], text: "Yes — balayage, full colour and toners. A quick consult helps us quote accurately.", chips: ["Book a consult"] },
      ],
      fallback: "I’m not sure about that, so I won’t guess. Want me to ask the team?",
      handover: "Of course — I’ll get a team member to reply here shortly.",
    },
    currency: "$",
    plans: [
      { name: "Solo", price: "29", features: ["1 chair / stylist", "300 conversations", "FAQ & menu answers"] },
      { name: "Studio", price: "79", highlight: true, features: ["5 team members", "1,000 conversations", "Auto booking", "Reminders"] },
      { name: "Multi-site", price: "179", features: ["Multiple locations", "4,000 conversations", "Analytics", "Priority support"] },
    ],
    faq: [
      ["Can it book by stylist?", "Yes — clients can choose a service and a team member."],
      ["Can it handle special requests?", "It hands those to your team with the full conversation."],
      ["Will it change my prices?", "No. It only quotes what’s on your approved menu."],
    ],
  },
};

export const industryList = Object.values(industries);
