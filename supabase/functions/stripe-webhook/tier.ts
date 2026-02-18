/**
 * Product ID → tier mapping. Isolated so tests can assert unknown product → free without starting the server.
 */

export const PRODUCT_TIERS: Record<string, { tier: string; tier_name: string; reward_multiplier: number }> = {
  "prod_TgTDyU5HXIH8hh": { tier: "pro", tier_name: "Pro", reward_multiplier: 2 },
  "prod_TgTDRhBdlgafaX": { tier: "creator", tier_name: "Creator", reward_multiplier: 3 },
};

/** Unknown product must never upgrade tier (no privilege escalation). */
export const FREE_TIER = { tier: "free", tier_name: "Free", reward_multiplier: 1 } as const;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

export function getTierFromProduct(productId: string): { tier: string; tier_name: string; reward_multiplier: number } {
  const t = PRODUCT_TIERS[productId];
  if (t) return t;
  logStep("Unknown product id, mapping to free tier (no privilege escalation)", { productId });
  return { ...FREE_TIER };
}
