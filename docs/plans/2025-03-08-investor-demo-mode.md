# Investor Demo Mode Implementation Plan

> **For Claude:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement an investor-ready demo mode with Hero Entry, scenario selector, fintech-style wallet, unified 4-step checkout, media/promo flows, and presenter controls.

**Architecture:** Two interaction modes: Immersive (media—hidden controls, gestures) vs Transaction (wallet/checkout—visible labels, persistent nav). Demo mode gates flows with a Hero Entry and scenario selector. All checkout flows share one 4-step skeleton (Amount → Destination → Review → Confirm).

**Tech Stack:** React, Tailwind, Radix UI, existing Auth/Localization/Accessibility contexts.

---

## Phase 1: Entry & Demo Structure

### Task 1: Hero Entry Screen
**Files:** Create `src/components/demo/HeroEntry.tsx`
**Steps:** Implement investor landing per wireframe: logo, headline "Verified attention becomes usable value", subheadline, primary CTA "Enter Demo", secondary "Investor Walkthrough", footer "Demo Mode" badge. 5-tap logo opens Presenter Panel. Respect safe areas, 8pt spacing.

### Task 2: Wire Hero → Scenario Selector
**Files:** Modify `src/pages/Index.tsx`
**Steps:** In demo mode, show HeroEntry first. "Enter Demo" opens DemoScenarioSelector. "Investor Walkthrough" opens selector with guided-tour hint. Add DEMO_HERO_SEEN_KEY for session/skip logic if needed.

### Task 3: Demo Mode Badge
**Files:** Create `src/components/demo/DemoModeBadge.tsx`, add to WalletScreen, KYC/verification flows, withdraw confirmation
**Steps:** Small pill "Demo Mode" visible on verification-heavy screens. AA contrast.

### Task 4: Presenter Panel (5-tap logo)
**Files:** Extend `DemoControlsSheet` or create `PresenterPanel.tsx`
**Steps:** 5 taps on Hero logo opens panel: reward amount, attention result, pending delay, reversal sim, locale (US/BR), seeded balances. Persist to localStorage.

---

## Phase 2: Media & Promo Polish

### Task 5: Media Home Full-Screen
**Files:** Modify `MediaCard`, feed layout in `Index.tsx`
**Steps:** True full-screen media when in immersive mode. No persistent title/comments. Swipe nav with edge preview hints.

### Task 6: Reward Chip & Transition
**Files:** Modify `MediaCard`, `CoinSlideAnimation`
**Steps:** Reward chip top-right 3s (+$1.00 / +R$1,00). On complete: coin animation → wallet, activity Pending → Completed after delay. Early exit: "No reward earned. Full watch required."

### Task 7: Controls Reveal
**Files:** `FloatingControls`, tap zones
**Steps:** Persistent micro-handle. Tap zones reveal Like/Comment/Share. Long-press 2s = move mode. Reset Layout in settings.

---

## Phase 3: Wallet Dashboard (Fintech)

### Task 8: Wallet Layout Refactor
**Files:** Modify `WalletScreen.tsx` overview tab
**Steps:** Total Balance + Available/Pending chips. Two asset cards (Icoins, Vicoins) side-by-side. Three CTAs: Withdraw, Convert, Pay. Recent Activity with Pending/Completed/Reversed pills. Tap Pending → explanation sheet.

### Task 9: Limits & Fees Upfront
**Files:** Wallet home, checkout entry
**Steps:** Show "Withdraw min $10", "Instant fee 1.5%" etc. on wallet home. Region-aware (US: ACH, Brazil: Pix).

---

## Phase 4: Unified Checkout

### Task 10: Convert 4-Step Flow
**Files:** Refactor convert section in `WalletScreen` or extract `UnifiedCheckoutFlow`
**Steps:** Step 1 Amount (presets, balance, fee), Step 2 Destination (V→I / I→V, rate+spread), Step 3 Review, Step 4 Confirm. Rate lock 30s in demo.

### Task 11: Withdraw 4-Step Flow
**Files:** Payout section
**Steps:** Amount → Destination (Bank, PayPal, Instant) → Review → Confirm (biometric/PIN modal) → Success (ID, timeline). No default to Instant.

### Task 12: Pay 4-Step Flow
**Files:** `MerchantCheckoutSheet`
**Steps:** Method → Amount+Source → Review → Confirm. Merchant identity, fees in Step 1+3.

### Task 13: Checkout UX Fixes
**Steps:** Fees in Step 1 and Step 3. No instant default. Reversal reasons human-readable.

---

## Phase 5: Activity & Accessibility

### Task 14: Activity List + Receipt
**Files:** Transactions tab, new `ReceiptDetailSheet`
**Steps:** Filter chips (All, Earned, Converted, Paid, Withdrawn). Receipt detail: status, amount, campaign, timestamp, ID. Edit links in review.

### Task 15: Accessibility (AA)
**Files:** Global: tap targets 44x44, contrast 4.5:1, non-color status. `useReducedMotion` hook, coin animation → fade/scale when reduced.

---

## Execution Order (Fast Investor Proof)

1. Hero Entry + wire to scenario selector
2. Demo badge
3. Presenter panel (5-tap)
4. Wallet layout (fintech)
5. Unified checkout skeleton
6. Media/reward polish
7. Activity + receipt
8. Accessibility pass
