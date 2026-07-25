-- Full replica identity so Realtime can deliver filtered UPDATE/DELETE
-- events on portal chat tables (postgres_changes with filters).
alter table public.portal_messages replica identity full;
alter table public.portal_message_reactions replica identity full;
