-- Client portal accounts (magic link)

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('Admin', 'Member', 'Client'));

alter table public.clients
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists portal_email text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists billing_kind text
    check (billing_kind is null or billing_kind in ('person', 'company')),
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';

create index if not exists clients_auth_user_id_idx on public.clients (auth_user_id);

-- Recreate handle_new_user to honor invite metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  kind text := coalesce(meta->>'kind', '');
  client_id text := meta->>'client_id';
  display_name text := coalesce(
    meta->>'name',
    split_part(coalesce(new.email, 'Client'), '@', 1),
    'Client'
  );
  initials text := upper(left(display_name, 2));
  new_role text := case when kind = 'client' then 'Client' else 'Member' end;
begin
  insert into public.profiles (id, name, initials, role)
  values (new.id, display_name, initials, new_role)
  on conflict (id) do nothing;

  if kind = 'client' and client_id is not null then
    update public.clients
    set auth_user_id = new.id,
        portal_email = coalesce(portal_email, new.email)
    where id = client_id
      and (auth_user_id is null or auth_user_id = new.id);
  end if;

  return new;
end;
$$;
