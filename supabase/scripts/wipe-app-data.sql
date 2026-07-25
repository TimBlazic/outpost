-- Wipe all app data. Keeps:
--   - auth.users
--   - public.profiles
--   - public.firm_settings
--   - storage bucket "avatars" (profile photos)
--
-- Run in Supabase SQL Editor.
-- This is destructive — no undo.
--
-- Note: storage.objects cannot be deleted via SQL (protect_delete).
-- After this, empty the "attachments" bucket in Dashboard → Storage
-- (or via Storage API). Leave "avatars" alone.

begin;

truncate table
  public.ticket_comment_reactions,
  public.ticket_comments,
  public.tickets,
  public.portal_approvals,
  public.phase_checklist_items,
  public.project_phases,
  public.portal_comments,
  public.portal_updates,
  public.attachments,
  public.payments,
  public.tasks,
  public.notes,
  public.activities,
  public.projects,
  public.clients,
  public.docs,
  public.leads
restart identity cascade;

commit;
