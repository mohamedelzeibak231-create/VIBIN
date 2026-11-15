-- settings.sql: private accounts + follow requests, who-can-message / who-can-comment,
-- deactivate and delete account. Run once in the Supabase SQL editor AFTER
-- setup.sql, messages.sql and features.sql. Safe to run again.

-- ---------- profile settings ----------
alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists deactivated boolean not null default false;
alter table public.profiles add column if not exists who_can_message text not null default 'friends' check (who_can_message in ('friends','nobody'));
alter table public.profiles add column if not exists who_can_comment text not null default 'everyone' check (who_can_comment in ('everyone','friends','nobody'));
grant update (is_private, deactivated, who_can_message, who_can_comment) on public.profiles to authenticated;

-- ---------- helper functions (run with elevated rights so they can look across users) ----------
create or replace function public.can_view_user(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select uid = auth.uid()
      or exists (select 1 from public.profiles p
                  where p.id = uid and not p.deactivated
                    and (not p.is_private
                         or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = uid)));
$$;
create or replace function public.is_private(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_private from public.profiles where id = uid), false);
$$;
create or replace function public.accepts_messages(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select who_can_message <> 'nobody' from public.profiles where id = uid), false);
$$;
create or replace function public.can_comment_on(vid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p.who_can_comment
             when 'everyone' then true
             when 'nobody' then v.user_id = auth.uid()
             when 'friends' then (v.user_id = auth.uid() or public.are_friends(v.user_id, auth.uid()))
             else false end
      from public.videos v join public.profiles p on p.id = v.user_id
     where v.id = vid), false);
$$;
grant execute on function public.can_view_user(uuid) to anon, authenticated;
grant execute on function public.is_private(uuid) to authenticated;
grant execute on function public.accepts_messages(uuid) to authenticated;
grant execute on function public.can_comment_on(uuid) to authenticated;

-- ---------- follow requests ----------
create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  check (requester_id <> target_id)
);
alter table public.follow_requests enable row level security;
drop policy if exists "see my requests" on public.follow_requests;
create policy "see my requests" on public.follow_requests for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = target_id);
drop policy if exists "send request" on public.follow_requests;
create policy "send request" on public.follow_requests for insert to authenticated
  with check (auth.uid() = requester_id);
drop policy if exists "cancel or decline request" on public.follow_requests;
create policy "cancel or decline request" on public.follow_requests for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = target_id);
revoke all on public.follow_requests from anon, authenticated;
grant select, insert, delete on public.follow_requests to authenticated;

create or replace function public.accept_follow_request(requester uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.follow_requests where requester_id = requester and target_id = auth.uid()) then
    raise exception 'no such request';
  end if;
  insert into public.follows (follower_id, following_id) values (requester, auth.uid()) on conflict do nothing;
  delete from public.follow_requests where requester_id = requester and target_id = auth.uid();
end;
$$;
grant execute on function public.accept_follow_request(uuid) to authenticated;

-- ---------- rules that apply on top of your existing policies ----------
-- (restrictive policies are ANDed with the policies you already have)
drop policy if exists "respect privacy" on public.videos;
create policy "respect privacy" on public.videos as restrictive for select to anon, authenticated
  using (public.can_view_user(user_id));

drop policy if exists "hide deactivated profiles" on public.profiles;
create policy "hide deactivated profiles" on public.profiles as restrictive for select to anon, authenticated
  using (not deactivated or id = auth.uid());

drop policy if exists "private accounts need approval" on public.follows;
create policy "private accounts need approval" on public.follows as restrictive for insert to authenticated
  with check (not public.is_private(following_id));

drop policy if exists "receiver allows messages" on public.messages;
create policy "receiver allows messages" on public.messages as restrictive for insert to authenticated
  with check (public.accepts_messages(receiver_id));

drop policy if exists "comment settings" on public.comments;
create policy "comment settings" on public.comments as restrictive for insert to authenticated
  with check (public.can_comment_on(video_id));

-- ---------- delete my account ----------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not logged in'; end if;
  delete from public.videos where user_id = me;
  delete from public.comments where user_id = me;
  delete from public.likes where user_id = me;
  delete from public.saves where user_id = me;
  delete from public.follows where follower_id = me or following_id = me;
  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
