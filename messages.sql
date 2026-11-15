-- messages.sql: friends-only messaging for vibin.
-- "Friends" = two people who follow each other.
-- Run this once in the Supabase SQL editor (after setup.sql). Safe to run again.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> receiver_id)
);

create index if not exists messages_pair_idx on public.messages (sender_id, receiver_id, created_at desc);
create index if not exists messages_inbox_idx on public.messages (receiver_id, read_at);

-- true when both people follow each other
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.follows where follower_id = a and following_id = b)
     and exists (select 1 from public.follows where follower_id = b and following_id = a);
$$;

-- the logged-in user's friends
create or replace function public.my_friends()
returns table (id uuid, username text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username
  from public.follows f1
  join public.follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
  join public.profiles p on p.id = f1.following_id
  where f1.follower_id = auth.uid()
  order by p.username;
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;

-- security: only the two people in a chat can see it, and you can only message friends
alter table public.messages enable row level security;

drop policy if exists "read own messages" on public.messages;
create policy "read own messages" on public.messages
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "send to friends only" on public.messages;
create policy "send to friends only" on public.messages
  for insert to authenticated
  with check (auth.uid() = sender_id and public.are_friends(sender_id, receiver_id));

drop policy if exists "mark received as read" on public.messages;
create policy "mark received as read" on public.messages
  for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

drop policy if exists "delete own sent messages" on public.messages;
create policy "delete own sent messages" on public.messages
  for delete to authenticated
  using (auth.uid() = sender_id);

-- permissions: the only column anyone can change is read_at
revoke all on public.messages from anon, authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

notify pgrst, 'reload schema';
