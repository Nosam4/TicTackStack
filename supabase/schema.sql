create extension if not exists pgcrypto;

create table if not exists public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  game_state jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists game_saves_user_id_updated_at_idx
on public.game_saves (user_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists game_saves_set_updated_at on public.game_saves;

create trigger game_saves_set_updated_at
before update on public.game_saves
for each row
execute function public.set_updated_at();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.game_saves to authenticated;

alter table public.game_saves enable row level security;

drop policy if exists "Users can read their own saves" on public.game_saves;
create policy "Users can read their own saves"
on public.game_saves
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own saves" on public.game_saves;
create policy "Users can insert their own saves"
on public.game_saves
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own saves" on public.game_saves;
create policy "Users can update their own saves"
on public.game_saves
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own saves" on public.game_saves;
create policy "Users can delete their own saves"
on public.game_saves
for delete
to authenticated
using ((select auth.uid()) = user_id);
