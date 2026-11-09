import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const billing = DashboardService.getBillingData(user.orgId);
  return NextResponse.json({ billing });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    if (action === "update_preferences") {
      const billing = DashboardService.updateBillingPreferences(user.orgId, {
        currency: body.currency,
        provider: body.provider,
      });
      return NextResponse.json({
        billing,
        message: `Billing preferences updated (${billing.currency} • ${billing.provider === "paddle" ? "Paddle" : "Lemon Squeezy"}).`,
      });
    }

    if (action === "update_subscription") {
      const plan =
        body.plan === "starter" || body.plan === "scale" ? body.plan : "growth";
      const billingCycle =
        body.billingCycle === "biannual" || body.billingCycle === "annual"
          ? body.billingCycle
          : "monthly";
      const result = DashboardService.updateSubscription(
        user.orgId,
        plan,
        billingCycle,
        Boolean(body.simulateFailedCharge),
        body.currency
      );
      return NextResponse.json(result);
    }

    if (action === "add_payment_method") {
      const billing = DashboardService.addPaymentMethod(user.orgId, {
        brand: body.brand,
        cardNumber: String(body.cardNumber || ""),
        expMonth: String(body.expMonth || "12"),
        expYear: String(body.expYear || "2029"),
        cardholderName: String(body.cardholderName || user.name || "Clinic Account"),
        setAsDefault: body.setAsDefault !== false,
      });
      return NextResponse.json({ billing, message: "Payment method added successfully." });
    }

    if (action === "set_default_payment_method") {
      const billing = DashboardService.setDefaultPaymentMethod(
        user.orgId,
        String(body.paymentMethodId || "")
      );
      return NextResponse.json({ billing, message: "Default payment method updated." });
    }

    if (action === "delete_payment_method") {
      const billing = DashboardService.deletePaymentMethod(
        user.orgId,
        String(body.paymentMethodId || "")
      );
      return NextResponse.json({ billing, message: "Payment method removed." });
    }

    return NextResponse.json({ error: "Invalid billing action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Billing operation failed" },
      { status: 400 }
    );
  }
}
