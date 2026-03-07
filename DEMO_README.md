# Investor Demo Mode

## Start

```bash
npm run demo
```

This uses Vite `--mode demo`, which loads `.env.demo` and enables local simulation mode.

## What Demo Mode Simulates

- Authentication/session (`AuthContext`) with a deterministic demo user.
- Wallet balances and reward flows using local storage state.
- Subscription checkout/portal flows with local tier simulation.
- Payout flows with local mock payment methods + payout history.
- Notifications/messages with local demo data.
- Feed/map/check-in flows without requiring live Supabase/Stripe/Mapbox.

## Optional Real Integrations During Demo

- Add `VITE_MAPBOX_TOKEN` to `.env.demo` if you want live map tiles.
- Add Supabase env vars to `.env.demo` only if you intentionally want to hit real backend data.

## Investor Walkthrough (3-5 min)

1. Open feed, swipe content, trigger a promo reward.
2. Open Wallet and show balances + transaction history.
3. Show conversion and payout simulation (no external dependency required).
4. Open Discovery Map and check-in flow.
5. Open checkout receipt timeline and switch demo outcomes (`completed`, `pending`, `reversed`) via demo controls.

## Notes

- Production mode is unchanged (`npm run dev` / `npm run build`).
- Demo state is stored in local storage and can be reset by clearing site data.
