-- Realtime RLS: tighten ticket_comments + ticket_comment_reactions policies
-- so Client role only sees comments for tickets on their projects.
-- Enable realtime publication. Mirrors 20260725300000 pattern.

-- 1. Drop overly-permissive policies
drop policy if exists "ticket_comments all" on public.ticket_comments;
drop policy if exists "ticket_comment_reactions all" on public.ticket_comment_reactions;

-- 2. ticket_comments policies
-- Studio (Admin/Member): full access
create policy "ticket_comments_studio_all"
  on public.ticket_comments for all to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  );

-- Client: SELECT comments for tickets in their projects
create policy "ticket_comments_client_select"
  on public.ticket_comments for select to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and ticket_id in (
      select t.id from public.tickets t
      join public.projects p on p.id = t.project_id
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- Client: INSERT own comments on tickets in their projects
create policy "ticket_comments_client_insert"
  on public.ticket_comments for insert to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and author_kind = 'client'
    and ticket_id in (
      select t.id from public.tickets t
      join public.projects p on p.id = t.project_id
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- 3. ticket_comment_reactions policies
-- Studio (Admin/Member): full access
create policy "ticket_comment_reactions_studio_all"
  on public.ticket_comment_reactions for all to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  );

-- Client: SELECT reactions for comments on tickets in their projects
create policy "ticket_comment_reactions_client_select"
  on public.ticket_comment_reactions for select to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and comment_id in (
      select tc.id from public.ticket_comments tc
      join public.tickets t on t.id = tc.ticket_id
      join public.projects p on p.id = t.project_id
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- Client: INSERT own reactions
create policy "ticket_comment_reactions_client_insert"
  on public.ticket_comment_reactions for insert to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and author_kind = 'client'
    and comment_id in (
      select tc.id from public.ticket_comments tc
      join public.tickets t on t.id = tc.ticket_id
      join public.projects p on p.id = t.project_id
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- 4. Add tables to supabase_realtime publication (safe: no-op if already added)
do $$
begin
  alter publication supabase_realtime add table public.ticket_comments;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.ticket_comment_reactions;
exception when duplicate_object then
  null;
end;
$$;
