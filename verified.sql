-- verified.sql: the white verified tick. Run once in the Supabase SQL editor (after admin.sql). Safe to run again.

create table if not exists public.verified_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.verified_users enable row level security;

drop policy if exists "anyone can see who is verified" on public.verified_users;
create policy "anyone can see who is verified" on public.verified_users
  for select to anon, authenticated using (true);

-- nobody can change it from the app directly, only admins through the function below
revoke all on public.verified_users from anon, authenticated;
grant select on public.verified_users to anon, authenticated;

create or replace function public.admin_set_verified(target uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_on then
    insert into public.verified_users (user_id) values (target) on conflict do nothing;
  else
    delete from public.verified_users where user_id = target;
  end if;
end;
$$;

revoke execute on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- your own account gets the tick
insert into public.verified_users (user_id)
select id from public.profiles where lower(username) = 'mohamedelzeibak'
on conflict do nothing;

notify pgrst, 'reload schema';
