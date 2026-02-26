-- Coin gifting is now server-authoritative via send-coin-gift -> atomic_send_coin_gift.
-- Remove direct client INSERT ability to prevent fake gift records without balance transfer.

DROP POLICY IF EXISTS "Users can send gifts" ON public.coin_gifts;

COMMENT ON TABLE public.coin_gifts
  IS 'Coin gift transfer records. Inserts are server-side only via atomic_send_coin_gift (service role).';
