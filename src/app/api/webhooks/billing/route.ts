import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { DashboardService } from "@/server/services/dashboard.service";
import { getCurrentUser } from "@/lib/auth";
import type { BillingCurrency, BillingProvider, PaymentMethodBrand } from "@/lib/billing-config";

function verifyLemonSqueezySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const hmac = createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signature = Buffer.from(signatureHeader, "utf8");
  if (digest.length !== signature.length) return false;
  return timingSafeEqual(digest, signature);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody || "{}");

    const lsSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const lsSignature = request.headers.get("x-signature");

    let verifiedOrgId: string | null = null;

    if (lsSignature) {
      if (!lsSecret) {
        return NextResponse.json({ error: "Webhook secret not configured on server" }, { status: 500 });
      }
      const valid = verifyLemonSqueezySignature(rawBody, lsSignature, lsSecret);
      if (!valid) {
        return NextResponse.json({ error: "Invalid webhook HMAC signature" }, { status: 401 });
      }
      const customData =
        payload?.meta?.custom_data ||
        payload?.data?.custom_data ||
        payload?.customData;
      verifiedOrgId = customData?.organization_id || customData?.orgId || null;
      if (!verifiedOrgId) {
        return NextResponse.json({ error: "Missing organization_id in verified webhook payload" }, { status: 400 });
      }
    } else {
      // No webhook signature: strictly require an authenticated dashboard user session
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized: Webhook signature or active session required" }, { status: 401 });
      }
      // Strictly bind to the authenticated user's organization — prohibit cross-tenant hijacking
      verifiedOrgId = user.orgId;
    }

    // Parse Lemon Squeezy, Paddle, or unified MoR payload structure
    const rawEvent =
      payload?.meta?.event_name ||
      payload?.event_type ||
      payload?.eventName ||
      "subscription_payment_success";

    const customData =
      payload?.meta?.custom_data ||
      payload?.data?.custom_data ||
      payload?.customData ||
      payload;

    const orgId = verifiedOrgId;
    const rawPlan = String(customData?.plan || "growth").toLowerCase();
    const plan: "starter" | "growth" | "scale" =
      rawPlan === "starter" ? "starter" : rawPlan === "scale" ? "scale" : "growth";

    const rawCycle = String(customData?.billing_cycle || customData?.billingCycle || "monthly").toLowerCase();
    const billingCycle: "monthly" | "biannual" | "annual" =
      rawCycle === "biannual" ? "biannual" : rawCycle === "annual" ? "annual" : "monthly";

    const rawCurr = String(customData?.currency || payload?.data?.attributes?.currency || "USD").toUpperCase();
    const currency: BillingCurrency =
      rawCurr === "AUD" || rawCurr === "GBP" || rawCurr === "EUR" ? rawCurr : "USD";

    const provider: BillingProvider =
      customData?.provider === "paddle" || payload?.event_type ? "paddle" : "lemonsqueezy";

    const rawGateway = String(
      customData?.paymentGateway || payload?.data?.attributes?.card_brand || "PAYPAL"
    ).toUpperCase();
    const paymentGateway: PaymentMethodBrand =
      rawGateway === "VISA" ||
      rawGateway === "MASTERCARD" ||
      rawGateway === "AMEX" ||
      rawGateway === "APPLE_PAY" ||
      rawGateway === "GOOGLE_PAY"
        ? rawGateway
        : "PAYPAL";

    const cardLast4 = String(
      customData?.cardLast4 || payload?.data?.attributes?.card_last_four || "4242"
    );
    const payerEmail = String(
      customData?.payerEmail || payload?.data?.attributes?.user_email || "customer@globalclinic.com"
    );
    const externalSubscriptionId = String(
      payload?.data?.id || customData?.externalSubscriptionId || `sub_${provider}_live`
    );
    const customerPortalUrl =
      payload?.data?.attributes?.urls?.customer_portal || customData?.customerPortalUrl;

    // Normalize event name
    let eventName:
      | "subscription_created"
      | "subscription_updated"
      | "subscription_payment_success"
      | "subscription_payment_failed"
      | "subscription_cancelled" = "subscription_payment_success";

    if (
      rawEvent.includes("failed") ||
      rawEvent === "transaction.payment_failed"
    ) {
      eventName = "subscription_payment_failed";
    } else if (
      rawEvent.includes("created") ||
      rawEvent === "subscription.created"
    ) {
      eventName = "subscription_created";
    } else if (
      rawEvent.includes("updated") ||
      rawEvent === "subscription.updated"
    ) {
      eventName = "subscription_updated";
    } else if (
      rawEvent.includes("cancelled") ||
      rawEvent === "subscription.canceled"
    ) {
      eventName = "subscription_cancelled";
    }

    const result = DashboardService.processMoRWebhookEvent({
      orgId,
      eventName,
      plan,
      billingCycle,
      currency,
      provider,
      paymentGateway,
      cardLast4,
      payerEmail,
      externalSubscriptionId,
      customerPortalUrl,
      failureReason: customData?.failureReason,
    });

    return NextResponse.json({
      received: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Webhook processing error" },
      { status: 400 }
    );
  }
}
