-- admin.sql: admin + ban powers for vibin.
-- Run this once in the Supabase SQL editor (after setup.sql and messages.sql). Safe to run again.
-- The @mohamedelzeibak account must already exist when you run it (sign up first, then run this).

-- who is an admin (nobody can read or change this from the app)
create table if not exists public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

insert into public.admins (user_id)
select id from public.profiles where lower(username) = 'mohamedelzeibak'
on conflict do nothing;

-- bans: one row per banned person. expires_at null = forever.
create table if not exists public.bans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  banned_by uuid references public.profiles(id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.bans enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_banned(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bans
    where user_id = uid and (expires_at is null or expires_at > now())
  );
$$;

-- admins can see every ban, everyone else only their own
drop policy if exists "see own ban or admin sees all" on public.bans;
create policy "see own ban or admin sees all" on public.bans
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.bans from anon, authenticated;
grant select on public.bans to authenticated;

-- ban someone (p_days null or 0 = forever). Only admins can call this.
create or replace function public.admin_ban(target uuid, p_days int default null, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if target = auth.uid() then raise exception 'you cannot ban yourself'; end if;
  if exists (select 1 from public.admins where user_id = target) then raise exception 'you cannot ban an admin'; end if;
  insert into public.bans (user_id, banned_by, reason, expires_at)
  values (
    target, auth.uid(), nullif(left(coalesce(p_reason, ''), 200), ''),
    case when p_days is null or p_days <= 0 then null else now() + make_interval(days => least(p_days, 3650)) end
  )
  on conflict (user_id) do update
    set banned_by = excluded.banned_by, reason = excluded.reason,
        created_at = now(), expires_at = excluded.expires_at;
end;
$$;

create or replace function public.admin_unban(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  delete from public.bans where user_id = target;
end;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_banned(uuid) from public, anon;
revoke execute on function public.admin_ban(uuid, int, text) from public, anon;
revoke execute on function public.admin_unban(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_banned(uuid) to authenticated;
grant execute on function public.admin_ban(uuid, int, text) to authenticated;
grant execute on function public.admin_unban(uuid) to authenticated;

-- the actual lock: banned accounts cannot add anything (works on top of your existing policies)
do $$
declare t text;
begin
  foreach t in array array['videos','comments','messages','likes','comment_likes','saves','reposts','follows','follow_requests','message_reactions','blocks'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "banned cannot insert" on public.%I', t);
      execute format('create policy "banned cannot insert" on public.%I as restrictive for insert to authenticated with check (not public.is_banned(auth.uid()))', t);
    end if;
  end loop;
  foreach t in array array['videos','comments'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "banned cannot edit" on public.%I', t);
      execute format('create policy "banned cannot edit" on public.%I as restrictive for update to authenticated using (not public.is_banned(auth.uid()))', t);
    end if;
  end loop;
end $$;

-- banned accounts cannot upload videos, photos or avatars either
do $$
begin
  drop policy if exists "banned cannot upload" on storage.objects;
  create policy "banned cannot upload" on storage.objects
    as restrictive for insert to authenticated
    with check (not public.is_banned(auth.uid()));
exception when others then
  raise notice 'Could not add the upload rule: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
