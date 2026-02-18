# Reward Watch Policy — Single Source of Truth

## Rule: All-or-nothing (no partial credit)

**If the user stops before completing the video, they receive no credit.**

- Full watch required. A tiny tolerance (99%) is allowed only for timing drift (e.g., client vs server clock).
- No partial credit for 70%, 80%, or any incomplete view.
- This is defensible to advertisers: you only pay for completed views.

## Implementation

| Location | Threshold | Behavior |
|----------|-----------|----------|
| `supabase/functions/validate-attention` | `FULL_WATCH_RATIO = 0.99` | Hard gate: `watchRatio < 0.99` → `validated: false`, no reward |
| `src/services/security.service` | `0.99` | Hard block: `watchDuration < requiredDuration * 0.99` → `valid: false` |

## User-facing messaging

- On incomplete watch: *"Full watch required. No credit for partial views."*
- On validation fail: *"Keep watching with attention to earn rewards"* (when attention is the issue)
- In-app guidance: *"Watch to the end to earn"*

## Why all-or-nothing (not partial credit)

1. **Advertiser clarity**: Advertisers pay per completed view. No ambiguity.
2. **Dispute prevention**: Users cannot claim "I watched 70%, give me 70% credit."
3. **Fraud resistance**: Partial credit is easier to game (many quick partial views).
