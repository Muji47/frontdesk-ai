import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  calculatePlanCharge,
  getMerchantOfRecordStatus,
  type BillingCurrency,
  type BillingCycleType,
  type BillingPlanTier,
  type BillingProvider,
} from "@/lib/billing-config";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const plan: BillingPlanTier =
      body.plan === "starter" || body.plan === "scale" ? body.plan : "growth";
    const billingCycle: BillingCycleType =
      body.billingCycle === "biannual" || body.billingCycle === "annual"
        ? body.billingCycle
        : "monthly";
    const currency: BillingCurrency =
      body.currency === "USD" || body.currency === "GBP" || body.currency === "EUR"
        ? body.currency
        : "AUD";
    const provider: BillingProvider =
      body.provider === "paddle" ? "paddle" : "lemonsqueezy";

    const charge = calculatePlanCharge(plan, billingCycle, currency);
    const morStatus = getMerchantOfRecordStatus();

    // 1. Live Lemon Squeezy Checkout API integration when LEMONSQUEEZY_API_KEY & LEMONSQUEEZY_STORE_ID are set
    if (
      provider === "lemonsqueezy" &&
      process.env.LEMONSQUEEZY_API_KEY &&
      process.env.LEMONSQUEEZY_STORE_ID
    ) {
      const lsRes = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
        method: "POST",
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
        },
        body: JSON.stringify({
          data: {
            type: "checkouts",
            attributes: {
              checkout_data: {
                email: user.email,
                name: user.name,
                custom: {
                  organization_id: user.orgId,
                  plan,
                  billing_cycle: billingCycle,
                  currency,
                },
              },
            },
            relationships: {
              store: {
                data: { type: "stores", id: String(process.env.LEMONSQUEEZY_STORE_ID) },
              },
              variant: {
                data: { type: "variants", id: String(charge.lemonSqueezyVariantId) },
              },
            },
          },
        }),
      });

      if (lsRes.ok) {
        const lsData = await lsRes.json();
        const checkoutUrl = lsData?.data?.attributes?.url;
        return NextResponse.json({
          success: true,
          mode: "live",
          provider: "lemonsqueezy",
          checkoutUrl,
          charge,
        });
      }
    }

    // 2. Live Paddle Billing API integration when PADDLE_API_KEY is set
    if (provider === "paddle" && process.env.PADDLE_API_KEY) {
      const paddleBase =
        process.env.PADDLE_ENV === "sandbox"
          ? "https://sandbox-api.paddle.com"
          : "https://api.paddle.com";
      const padRes = await fetch(`${paddleBase}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
        },
        body: JSON.stringify({
          items: [{ price_id: charge.paddlePriceId, quantity: 1 }],
          currency_code: currency,
          custom_data: {
            organization_id: user.orgId,
            plan,
            billing_cycle: billingCycle,
            currency,
          },
        }),
      });

      if (padRes.ok) {
        const padData = await padRes.json();
        const checkoutUrl = padData?.data?.checkout?.url;
        return NextResponse.json({
          success: true,
          mode: "live",
          provider: "paddle",
          transactionId: padData?.data?.id,
          checkoutUrl,
          charge,
        });
      }
    }

    // 3. Interactive Sandbox Overlay Mode (works out-of-the-box before live API keys are pasted in .env)
    const fallbackCheckoutUrl =
      provider === "paddle"
        ? `https://sandbox-checkout.paddle.com/checkout/${charge.paddlePriceId}?org=${user.orgId}&currency=${currency}`
        : `https://echo-ai.lemonsqueezy.com/checkout/buy/${charge.lemonSqueezyVariantId}?checkout[custom][organization_id]=${user.orgId}&checkout[email]=${encodeURIComponent(user.email)}`;

    return NextResponse.json({
      success: true,
      mode: morStatus.mode,
      provider,
      checkoutUrl: fallbackCheckoutUrl,
      charge,
      supportedGateways: morStatus.supportedGateways,
      payoutRails: morStatus.payoutRails,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to initialize global Merchant of Record checkout" },
      { status: 500 }
    );
  }
}
