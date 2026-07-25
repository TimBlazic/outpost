-- Realtime RLS: tighten portal_messages + portal_message_reactions policies
-- so Client role only sees messages for projects they own, while Studio
-- (Admin/Member) retains full access. Enable realtime publication.

-- 1. Drop overly-permissive policies
drop policy if exists "portal_messages all" on public.portal_messages;
drop policy if exists "portal_message_reactions all" on public.portal_message_reactions;

-- 2. portal_messages policies
-- Studio (Admin/Member): full access
create policy "portal_messages_studio_all"
  on public.portal_messages for all to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  );

-- Client: SELECT only for projects they own
create policy "portal_messages_client_select"
  on public.portal_messages for select to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and project_id in (
      select p.id from public.projects p
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- Client: INSERT own messages (for direct RLS writes if needed in future)
create policy "portal_messages_client_insert"
  on public.portal_messages for insert to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and author_kind = 'client'
    and project_id in (
      select p.id from public.projects p
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- 3. portal_message_reactions policies
-- Studio (Admin/Member): full access
create policy "portal_message_reactions_studio_all"
  on public.portal_message_reactions for all to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('Admin', 'Member')
  );

-- Client: SELECT reactions for messages in their projects
create policy "portal_message_reactions_client_select"
  on public.portal_message_reactions for select to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and message_id in (
      select pm.id from public.portal_messages pm
      join public.projects p on p.id = pm.project_id
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- Client: INSERT own reactions
create policy "portal_message_reactions_client_insert"
  on public.portal_message_reactions for insert to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) = 'Client'
    and author_kind = 'client'
    and message_id in (
      select pm.id from public.portal_messages pm
      join public.projects p on p.id = pm.project_id
      join public.clients c on c.id = p.client_id
      where c.auth_user_id = auth.uid()
    )
  );

-- 4. Add tables to supabase_realtime publication (safe: no-op if already added)
do $$
begin
  alter publication supabase_realtime add table public.portal_messages;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.portal_message_reactions;
exception when duplicate_object then
  null;
end;
$$;
