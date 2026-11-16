-- admin-powers.sql: lets admins message anyone and moderate content.
-- Run once in the Supabase SQL editor, after admin.sql. Safe to run again.

-- the list of admin ids (so people can reply when an admin writes to them)
create or replace function public.admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.admins;
$$;

create or replace function public.admin_messaged(admin_id uuid, other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = admin_id)
     and exists (select 1 from public.messages where sender_id = admin_id and receiver_id = other_id);
$$;

revoke execute on function public.admin_ids() from public, anon;
revoke execute on function public.admin_messaged(uuid, uuid) from public, anon;
grant execute on function public.admin_ids() to authenticated;
grant execute on function public.admin_messaged(uuid, uuid) to authenticated;

-- admins can message anyone (works alongside your existing messaging rules)
drop policy if exists "admin can message anyone" on public.messages;
create policy "admin can message anyone" on public.messages
  for insert to authenticated
  with check (auth.uid() = sender_id and public.is_admin());

-- anyone can reply to an admin who has already written to them
drop policy if exists "reply to admin" on public.messages;
create policy "reply to admin" on public.messages
  for insert to authenticated
  with check (auth.uid() = sender_id and public.admin_messaged(receiver_id, sender_id));

-- admins can edit and delete any video or comment
do $$
declare t text;
begin
  foreach t in array array['videos','comments'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "admin can delete any" on public.%I', t);
      execute format('create policy "admin can delete any" on public.%I for delete to authenticated using (public.is_admin())', t);
      execute format('drop policy if exists "admin can edit any" on public.%I', t);
      execute format('create policy "admin can edit any" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    end if;
  end loop;
end $$;

-- admins can remove other people's uploaded files too
do $$
begin
  drop policy if exists "admin can delete any file" on storage.objects;
  create policy "admin can delete any file" on storage.objects
    for delete to authenticated using (public.is_admin());
exception when others then
  raise notice 'Could not add the file rule: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
