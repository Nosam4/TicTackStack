create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

grant usage on schema public to anon, authenticated;

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null check (room_code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  game_state jsonb not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_players (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol in ('X', 'O')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id),
  unique (room_id, symbol)
);

create index if not exists game_rooms_room_code_idx
on public.game_rooms (room_code);

create index if not exists room_players_user_idx
on public.room_players (user_id, room_id);

drop trigger if exists game_rooms_set_updated_at on public.game_rooms;

create trigger game_rooms_set_updated_at
before update on public.game_rooms
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.game_rooms to authenticated;
grant select, insert, delete on public.room_players to authenticated;

alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;

create or replace function public.is_room_participant(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_players rp
    where rp.room_id = target_room_id
      and rp.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_room_participant(uuid) from public, anon;
grant execute on function public.is_room_participant(uuid) to authenticated;

drop policy if exists "Participants can view rooms" on public.game_rooms;
create policy "Participants can view rooms"
on public.game_rooms
for select
to authenticated
using (
  (select public.is_room_participant(id))
  or status = 'waiting'
);

drop policy if exists "Hosts can create rooms" on public.game_rooms;
create policy "Hosts can create rooms"
on public.game_rooms
for insert
to authenticated
with check ((select auth.uid()) = host_user_id);

drop policy if exists "Participants can update rooms" on public.game_rooms;
create policy "Participants can update rooms"
on public.game_rooms
for update
to authenticated
using ((select public.is_room_participant(id)))
with check ((select public.is_room_participant(id)));

drop policy if exists "Participants can read room players" on public.room_players;
create policy "Participants can read room players"
on public.room_players
for select
to authenticated
using (
  (select public.is_room_participant(room_id))
  or exists (
    select 1
    from public.game_rooms gr
    where gr.id = room_id and gr.status = 'waiting'
  )
);

drop policy if exists "Users can join rooms as themselves" on public.room_players;
create policy "Users can join rooms as themselves"
on public.room_players
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.game_rooms gr
    where gr.id = room_id
      and gr.status in ('waiting', 'active')
  )
);

drop policy if exists "Users can leave their own room slot" on public.room_players;
create policy "Users can leave their own room slot"
on public.room_players
for delete
to authenticated
using ((select auth.uid()) = user_id);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      alter publication supabase_realtime add table public.game_rooms;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.room_players;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
