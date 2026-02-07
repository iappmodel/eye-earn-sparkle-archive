
# Fix Race Conditions in Balance Transfer Edge Functions

## The Problem
Five edge functions handle coin balances using a vulnerable pattern:
1. **Read** the current balance from the database
2. **Calculate** the new balance in JavaScript
3. **Write** the new balance back

If two requests arrive simultaneously, both read the same balance (e.g., 1000 coins), both calculate independently (e.g., subtract 800), and both write their result (200). The user spent 1600 coins but only lost 800 from their balance -- classic double-spending.

**Affected functions:**
- `transfer-coins` -- Icoin-to-Vicoin conversion
- `tip-creator` -- Sending tips between users
- `request-payout` -- Withdrawing coins
- `issue-reward` -- Earning rewards from content
- `verify-checkin` -- Check-in location rewards

## The Solution
Move all balance operations into **database-level stored procedures** that use PostgreSQL advisory locks (`pg_advisory_xact_lock`) to serialize access per user. Each procedure runs as a single atomic transaction -- if any step fails, everything rolls back automatically.

This means the edge functions will call a single `supabase.rpc(...)` instead of performing multiple separate reads and writes.

## What Changes

### 1. New Database Functions (via migration)

**`atomic_convert_coins(p_user_id, p_icoin_amount, p_exchange_rate)`**
- Acquires an advisory lock on the user's balance
- Validates the user has sufficient Icoin balance (using the live database value, not a stale read)
- Deducts Icoins and adds Vicoins in a single UPDATE
- Inserts both transaction records
- Returns the new balances or raises an exception on failure

**`atomic_tip_creator(p_tipper_id, p_creator_id, p_amount, p_coin_type, p_content_id)`**
- Acquires advisory locks on both the tipper and creator (ordered by user ID to prevent deadlocks)
- Validates tipper has sufficient balance
- Deducts from tipper and adds to creator in two atomic UPDATEs
- Inserts transaction records and notification
- Returns the tip ID and new tipper balance

**`atomic_request_payout(p_user_id, p_amount, p_coin_type, p_method)`**
- Acquires an advisory lock on the user's balance
- Validates KYC status and sufficient balance
- Deducts balance and creates the transaction record
- Returns the transaction ID and new balance

**`atomic_update_balance(p_user_id, p_amount, p_coin_type, p_description, p_reference_id)`**
- A shared utility function used by `issue-reward` and `verify-checkin`
- Acquires advisory lock, adds coins to the user's balance
- Creates a transaction record
- Returns the new balance

### 2. Updated Edge Functions

Each edge function keeps its existing authentication, input validation, and business logic checks, but replaces the multi-step read-calculate-write block with a single `supabase.rpc()` call:

**`transfer-coins/index.ts`** -- Replace lines 65-127 (read balance, check, update, insert transactions) with a single `supabase.rpc('atomic_convert_coins', {...})` call.

**`tip-creator/index.ts`** -- Replace lines 66-172 (read tipper, read creator, deduct, add, insert transactions, insert notification) with `supabase.rpc('atomic_tip_creator', {...})`.

**`request-payout/index.ts`** -- Replace lines 83-151 (read profile, check KYC, deduct, insert transaction, rollback logic) with `supabase.rpc('atomic_request_payout', {...})`. KYC check moves into the stored procedure.

**`issue-reward/index.ts`** -- Replace lines 220-245 (read balance, calculate, update) with `supabase.rpc('atomic_update_balance', {...})`.

**`verify-checkin/index.ts`** -- Replace lines 218-232 (read balance, calculate, update) with `supabase.rpc('atomic_update_balance', {...})`.

### 3. No UI Changes
All changes are backend-only. The edge functions return the same response shapes, so no frontend code needs updating.

---

## Technical Details

### Advisory Lock Strategy
Each function uses `pg_advisory_xact_lock(hashtext('balance_' || user_id::text))` to serialize access per user. The lock is automatically released when the transaction ends (commit or rollback). For tip-creator, both user locks are acquired in a deterministic order (sorted by UUID) to prevent deadlocks.

### Error Handling
Database functions use `RAISE EXCEPTION` for business logic failures (insufficient balance, KYC not verified, etc.). The edge functions catch these in the RPC error response and return appropriate HTTP status codes.

### Migration SQL Structure
```text
-- 1. atomic_convert_coins: Lock user -> check balance -> deduct icoins + add vicoins -> log transactions
-- 2. atomic_tip_creator: Lock both users -> check balance -> deduct from tipper + add to creator -> log + notify
-- 3. atomic_request_payout: Lock user -> check KYC + balance -> deduct -> log transaction
-- 4. atomic_update_balance: Lock user -> add coins -> log transaction (used by reward + checkin)
```

### Files to create/modify:
- **Database migration**: 4 new stored procedures
- `supabase/functions/transfer-coins/index.ts` -- Use `atomic_convert_coins` RPC
- `supabase/functions/tip-creator/index.ts` -- Use `atomic_tip_creator` RPC
- `supabase/functions/request-payout/index.ts` -- Use `atomic_request_payout` RPC
- `supabase/functions/issue-reward/index.ts` -- Use `atomic_update_balance` RPC
- `supabase/functions/verify-checkin/index.ts` -- Use `atomic_update_balance` RPC
