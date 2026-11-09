export type BillingPlanTier = "starter" | "growth" | "scale";
export type BillingCycleType = "monthly" | "biannual" | "annual";
export type BillingCurrency = "USD" | "AUD" | "GBP" | "EUR";
export type BillingProvider = "lemonsqueezy" | "paddle";
export type PaymentMethodBrand = "VISA" | "MASTERCARD" | "AMEX" | "PAYPAL" | "APPLE_PAY" | "GOOGLE_PAY";

export interface CurrencyConfig {
  code: BillingCurrency;
  symbol: string;
  label: string;
  taxLabel: string;
  taxRate: number;
  monthlyBase: Record<BillingPlanTier, number>;
}

export const CURRENCY_CONFIGS: Record<BillingCurrency, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    label: "USD ($) • Global / US",
    taxLabel: "Sales Tax / VAT (Included via MoR)",
    taxRate: 0.08,
    monthlyBase: {
      starter: 39,
      growth: 79,
      scale: 199,
    },
  },
  AUD: {
    code: "AUD",
    symbol: "$",
    label: "AUD ($) • Australia",
    taxLabel: "GST (10%)",
    taxRate: 0.1,
    monthlyBase: {
      starter: 49,
      growth: 99,
      scale: 249,
    },
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    label: "GBP (£) • United Kingdom",
    taxLabel: "UK VAT (20%)",
    taxRate: 0.2,
    monthlyBase: {
      starter: 32,
      growth: 65,
      scale: 165,
    },
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    label: "EUR (€) • Europe",
    taxLabel: "EU VAT (20%)",
    taxRate: 0.2,
    monthlyBase: {
      starter: 36,
      growth: 75,
      scale: 189,
    },
  },
};

/**
 * Maps each (plan, billingCycle) pair to Lemon Squeezy Variant IDs and Paddle Price IDs.
 * Founders in Pakistan can configure these in .env from their Lemon Squeezy or Paddle dashboard.
 */
export function getProviderVariantIds(plan: BillingPlanTier, cycle: BillingCycleType) {
  const keySuffix = `${plan.toUpperCase()}_${cycle.toUpperCase()}`;
  const lemonSqueezyVariantId =
    process.env[`LEMONSQUEEZY_VARIANT_${keySuffix}`] || `ls_var_${plan}_${cycle}`;
  const paddlePriceId =
    process.env[`PADDLE_PRICE_${keySuffix}`] || `pri_${plan}_${cycle}`;

  return {
    lemonSqueezyVariantId,
    paddlePriceId,
  };
}

export function calculatePlanCharge(
  plan: BillingPlanTier,
  cycle: BillingCycleType,
  currency: BillingCurrency = "AUD"
) {
  const curr = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.AUD;
  const base = curr.monthlyBase[plan] || curr.monthlyBase.growth;

  // Monthly = 1x base, Bi-Annual (6 months) = 10% off * 6, Annual (12 months) = 20% off * 12
  const perMonthEffective =
    cycle === "biannual"
      ? Math.round(base * 0.9)
      : cycle === "annual"
      ? Math.round(base * 0.8)
      : base;

  const monthsMultiplier = cycle === "biannual" ? 6 : cycle === "annual" ? 12 : 1;
  const totalAmount = perMonthEffective * monthsMultiplier;
  const amountCents = totalAmount * 100;
  const amountFormatted = `${curr.symbol}${totalAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${curr.code}`;

  const planLabel =
    plan === "starter" ? "Starter Plan" : plan === "scale" ? "Scale Plan" : "Growth Plan";
  const cycleLabel =
    cycle === "biannual"
      ? "Bi-Annual (6 Months)"
      : cycle === "annual"
      ? "Annual (12 Months)"
      : "Monthly";

  const { lemonSqueezyVariantId, paddlePriceId } = getProviderVariantIds(plan, cycle);

  return {
    plan,
    cycle,
    currency: curr.code,
    symbol: curr.symbol,
    taxLabel: curr.taxLabel,
    taxRate: curr.taxRate,
    baseMonthly: base,
    perMonthEffective,
    monthsMultiplier,
    totalAmount,
    amountCents,
    amountFormatted,
    planLabel,
    cycleLabel,
    lemonSqueezyVariantId,
    paddlePriceId,
  };
}

export function getMerchantOfRecordStatus() {
  const provider: BillingProvider =
    process.env.BILLING_PROVIDER === "paddle" ? "paddle" : "lemonsqueezy";
  const hasLemonSqueezyLive = Boolean(
    process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID
  );
  const hasPaddleLive = Boolean(process.env.PADDLE_API_KEY && process.env.PADDLE_SELLER_ID);
  const isLiveConfigured = provider === "paddle" ? hasPaddleLive : hasLemonSqueezyLive;

  return {
    provider,
    providerDisplayName: provider === "paddle" ? "Paddle" : "Lemon Squeezy",
    isLiveConfigured,
    mode: isLiveConfigured ? ("live" as const) : ("sandbox" as const),
    supportedGateways: ["VISA", "MASTERCARD", "AMEX", "PAYPAL", "APPLE_PAY", "GOOGLE_PAY"] as PaymentMethodBrand[],
    payoutRails: ["Payoneer", "Elevate Pay", "Pakistani Bank IBAN (SWIFT)"],
  };
}
