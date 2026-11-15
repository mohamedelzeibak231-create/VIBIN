-- avatars.sql: profile pictures. Run once in the Supabase SQL editor. Safe to run again.
alter table public.profiles add column if not exists avatar_url text check (avatar_url is null or avatar_url like 'https://%');
grant update (avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "upload own avatar" on storage.objects;
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own avatar" on storage.objects;
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
