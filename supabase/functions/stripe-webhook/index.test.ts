/**
 * Critical-path tests: Stripe webhook must never upgrade tier for unknown product id.
 * Unknown product id → free tier (no privilege escalation).
 */
import { assertEquals } from "jsr:@std/assert";
import { FREE_TIER, getTierFromProduct } from "./tier.ts";

Deno.test("getTierFromProduct: unknown product id returns free tier (no privilege escalation)", () => {
  const unknown = "prod_unknown_fake_id_12345";
  const t = getTierFromProduct(unknown);
  assertEquals(t.tier, "free");
  assertEquals(t.tier_name, "Free");
  assertEquals(t.reward_multiplier, 1);
  assertEquals(t, FREE_TIER);
});

Deno.test("getTierFromProduct: empty string returns free tier", () => {
  const t = getTierFromProduct("");
  assertEquals(t.tier, "free");
  assertEquals(t.reward_multiplier, 1);
});

Deno.test("getTierFromProduct: known pro product returns pro tier", () => {
  const t = getTierFromProduct("prod_TgTDyU5HXIH8hh");
  assertEquals(t.tier, "pro");
  assertEquals(t.tier_name, "Pro");
  assertEquals(t.reward_multiplier, 2);
});

Deno.test("getTierFromProduct: known creator product returns creator tier", () => {
  const t = getTierFromProduct("prod_TgTDRhBdlgafaX");
  assertEquals(t.tier, "creator");
  assertEquals(t.reward_multiplier, 3);
});
