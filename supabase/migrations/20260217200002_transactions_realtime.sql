-- Enable realtime for transactions table for live transaction updates in wallet
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
