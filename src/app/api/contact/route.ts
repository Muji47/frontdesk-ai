import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { handleApiError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const business = typeof body.business === "string" ? body.business.trim() : "";
    const industry = typeof body.industry === "string" ? body.industry.trim() : "clinic";
    const website = typeof body.website === "string" ? body.website.trim() : "";
    const message = typeof (body.message || body.notes) === "string" ? (body.message || body.notes).trim() : "";

    const fieldErrors: Record<string, string> = {};

    if (!name) {
      fieldErrors.name = "Your full name is required.";
    }
    if (!email) {
      fieldErrors.email = "Work email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = "Please enter a valid work email address (e.g. name@company.com).";
    }
    if (!message) {
      fieldErrors.notes = "Please tell us a little about your clinic, practice, or questions.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Please fill out all required fields.",
            details: fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const inquiryId = `inq_${randomBytes(8).toString("hex")}`;
    const nowIso = new Date().toISOString();

    // 1. Insert into marketing_inquiries table
    db.prepare(`
      INSERT INTO marketing_inquiries (id, name, email, business, industry, website, message, source, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'contact_form', 'new', ?)
    `).run(inquiryId, name, email, business, industry, website, message, nowIso);

    // 2. Also register as a platform lead for org_echo_sales
    try {
      const leadId = `lead_${randomBytes(8).toString("hex")}`;
      db.prepare(`
        INSERT INTO leads (id, organization_id, conversation_id, name, phone, email, intent, status, created_at)
        VALUES (?, 'org_echo_sales', NULL, ?, NULL, ?, 'pricing', 'new', ?)
      `).run(leadId, name, email, nowIso);
    } catch (e) {
      console.warn("Lead insert notice for marketing inquiry:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Your inquiry has been received. Our team will review and follow up shortly.",
      inquiryId,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
