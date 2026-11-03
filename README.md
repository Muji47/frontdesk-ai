# FrontDesk AI — Autonomous Front Desk SaaS Platform

FrontDesk AI is an autonomous, 24/7 AI receptionist SaaS platform designed for service and retail businesses (physiotherapy clinics, allied health, e-commerce stores, real estate, and wellness studios).

Instead of a basic FAQ chatbot, FrontDesk AI connects to practice management systems (Cliniko) and stores (Shopify) to answer questions, check live appointment availability, confirm bookings, look up order statuses, and gracefully escalate complex or clinical queries to human staff.

---

## 🌟 Key Features

* **Multi-Industry Dynamic Engine**: Dedicated workflows and configurations for:
  * **Physiotherapy & Allied Health**: Cliniko integration, live practitioner booking, zero medical diagnosis guarantee.
  * **E-Commerce & Retail**: Shopify/WooCommerce sync, order tracking (#WISMO), product recommendations, return rules.
  * **Real Estate**: Listing inquiry Q&A, inspection scheduling, buyer qualification.
  * **Salons & Wellness**: Stylist scheduling, service menus, reminders.
* **Autonomous Action Engine**:
  * Live slot availability verification & booking confirmation.
  * Direct order status tracking via shipping APIs.
* **Full Authentication & Multi-Tenancy**:
  * Multi-tenant data isolation.
  * Secure, HTTP-only cookie sessions.
  * Cryptographic password salt & `scrypt` hashing.
* **Business Dashboard**:
  * **Overview**: Real-time resolution rates, appointments generated, and KPI metrics.
  * **AI Receptionist Configurator**: Live persona, tone, branding colors, and 1-click embed script.
  * **Knowledge Base**: Document and website ingestion + **Unanswered Questions Queue** with 1-click approval.
  * **Conversations (AI Inbox)**: 3-pane chat inbox with human takeover and staff assignment.
* **Marketing Website (20+ routes)**:
  * Interactive ROI & staff savings calculator.
  * Interactive multi-industry live demo playground.
  * Security & Australian Privacy Act / OAIC compliance specifications.
  * Feature matrices, annual/monthly pricing toggle, and onboarding wizard.

---

## 🛠️ Technology Stack

* **Framework**: Next.js 16 (App Router + Turbopack)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **Database**: SQLite (Node 22 built-in `node:sqlite`) with relational schema
* **Security**: `node:crypto` (`scryptSync` + timing-safe equality)
* **Session Management**: Secure HttpOnly cookies

---

## 🚀 Getting Started

### Prerequisites

* Node.js v20+ or v22+
* npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/frontdesk-ai.git
   cd frontdesk-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo Account Credentials

You can test the authentication and Business Dashboard using the pre-seeded account:

* **Email**: `demo@frontdesk.ai`
* **Password**: `password123`
* **Dashboard URL**: [http://localhost:3000/login](http://localhost:3000/login)

---

## 📄 License

MIT License. Designed and built with Next.js & TypeScript.
