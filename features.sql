-- features.sql: blocking, display names, comment replies/hearts, reposts, video descriptions/editing,
-- message reactions, and picture/GIF/sticker messages for vibin.
-- Run once in the Supabase SQL editor AFTER setup.sql and messages.sql. Safe to run again.

-- ---------- profiles: display name + editing ----------
alter table public.profiles add column if not exists display_name text check (char_length(display_name) <= 30);
grant update (bio, display_name, username) on public.profiles to authenticated;
drop policy if exists "owner updates profile" on public.profiles;
create policy "owner updates profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- videos: description + editing ----------
alter table public.videos add column if not exists description text check (char_length(description) <= 500);
grant update (caption, description) on public.videos to authenticated;
drop policy if exists "owner edits video" on public.videos;
create policy "owner edits video" on public.videos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- comments: replies + hearts ----------
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
alter table public.comment_likes enable row level security;
drop policy if exists "read comment likes" on public.comment_likes;
create policy "read comment likes" on public.comment_likes for select using (true);
drop policy if exists "like comments" on public.comment_likes;
create policy "like comments" on public.comment_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "unlike comments" on public.comment_likes;
create policy "unlike comments" on public.comment_likes for delete to authenticated using (auth.uid() = user_id);
grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;

-- ---------- reposts ----------
create table if not exists public.reposts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
alter table public.reposts enable row level security;
drop policy if exists "read reposts" on public.reposts;
create policy "read reposts" on public.reposts for select using (true);
drop policy if exists "repost" on public.reposts;
create policy "repost" on public.reposts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "undo repost" on public.reposts;
create policy "undo repost" on public.reposts for delete to authenticated using (auth.uid() = user_id);
grant select on public.reposts to anon, authenticated;
grant insert, delete on public.reposts to authenticated;

-- ---------- blocking ----------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "see own blocks" on public.blocks;
create policy "see own blocks" on public.blocks for select to authenticated using (auth.uid() = blocker_id);
drop policy if exists "unblock" on public.blocks;
create policy "unblock" on public.blocks for delete to authenticated using (auth.uid() = blocker_id);
revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;

-- blocking also removes the follow in both directions (needs elevated rights, so it is a function)
create or replace function public.block_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  if target = auth.uid() then raise exception 'cannot block yourself'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), target) on conflict do nothing;
  delete from public.follows
   where (follower_id = auth.uid() and following_id = target)
      or (follower_id = target and following_id = auth.uid());
end;
$$;
grant execute on function public.block_user(uuid) to authenticated;

-- friends are mutual follows, and a block in either direction ends the friendship
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.follows where follower_id = a and following_id = b)
     and exists (select 1 from public.follows where follower_id = b and following_id = a)
     and not exists (select 1 from public.blocks
                      where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

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
    and not exists (select 1 from public.blocks b
                     where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
                        or (b.blocker_id = p.id and b.blocked_id = auth.uid()))
  order by p.username;
$$;

-- ---------- messages: pictures, GIFs, stickers ----------
alter table public.messages add column if not exists kind text not null default 'text' check (kind in ('text','image','gif','sticker'));
alter table public.messages add column if not exists media_url text check (media_url is null or media_url like 'https://%');

-- ---------- message reactions ----------
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;
drop policy if exists "read reactions in my chats" on public.message_reactions;
create policy "read reactions in my chats" on public.message_reactions
  for select to authenticated
  using (exists (select 1 from public.messages m
                  where m.id = message_id and (m.sender_id = auth.uid() or m.receiver_id = auth.uid())));
drop policy if exists "react in my chats" on public.message_reactions;
create policy "react in my chats" on public.message_reactions
  for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.messages m
                  where m.id = message_id and (m.sender_id = auth.uid() or m.receiver_id = auth.uid())));
drop policy if exists "remove my reaction" on public.message_reactions;
create policy "remove my reaction" on public.message_reactions
  for delete to authenticated using (auth.uid() = user_id);
revoke all on public.message_reactions from anon, authenticated;
grant select, insert, delete on public.message_reactions to authenticated;

-- ---------- storage for chat pictures ----------
insert into storage.buckets (id, name, public) values ('chat', 'chat', true) on conflict (id) do nothing;
drop policy if exists "upload chat media to own folder" on storage.objects;
create policy "upload chat media to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
