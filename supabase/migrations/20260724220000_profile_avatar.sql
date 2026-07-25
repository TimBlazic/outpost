-- Profile avatar URL + public avatars storage bucket

alter table public.profiles
  add column if not exists avatar_url text;

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars storage read" on storage.objects;
create policy "avatars storage read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars storage insert own" on storage.objects;
create policy "avatars storage insert own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars storage update own" on storage.objects;
create policy "avatars storage update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars storage delete own" on storage.objects;
create policy "avatars storage delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
