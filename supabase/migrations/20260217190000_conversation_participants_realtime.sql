-- Enable realtime for conversation_participants so unread counts and read receipts
-- update in real time across clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
