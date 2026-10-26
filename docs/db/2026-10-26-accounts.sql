-- Ki Legends accounts, cloud saves and the game-master panel (owner decision 26.10.2026).
-- Additive and idempotent: safe to run again; does not touch the sketch tables.
-- Applied to the Lovable Cloud database with the project's SQL access; keep this file as the record.

do $$ begin
  create type public.app_role as enum ('admin', 'gm');
exception when duplicate_object then null; end $$;

-- One profile per Supabase Auth user; the nick is chosen at sign-up.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nick text not null check (char_length(nick) between 3 and 20),
  created_at timestamptz not null default now(),
  last_seen timestamptz
);
create unique index if not exists profiles_nick_key on public.profiles (lower(nick));

-- Staff roles. Nobody grants a role to themselves; only an admin grants or revokes.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Cloud copy of the browser saves: one row per local save key of the player.
create table if not exists public.characters (
  user_id uuid not null references auth.users (id) on delete cascade,
  save_key text not null check (char_length(save_key) between 1 and 200),
  data jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (user_id, save_key)
);

-- Every staff change to someone else's data, written by triggers (never by the client).
create table if not exists public.admin_audit (
  id bigserial primary key,
  actor uuid references auth.users (id), -- null: a direct SQL change by the project owner's tooling
  action text not null,
  target_user uuid,
  target_key text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create or replace function public.has_role(_user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and role = _role)
$$;

create or replace function public.is_staff(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user)
$$;

-- Profile from the sign-up metadata; an invalid or taken nick falls back to a unique default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _nick text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nick'), ''), '');
begin
  if char_length(_nick) not between 3 and 20
     or exists (select 1 from public.profiles where lower(nick) = lower(_nick)) then
    _nick := 'Gracz-' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, nick) values (new.id, _nick) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Revision, author and audit for character rows.
create or replace function public.characters_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if auth.uid() is distinct from new.user_id then
    insert into public.admin_audit (actor, action, target_user, target_key, before, after)
    values (auth.uid(), lower(tg_op), new.user_id, new.save_key,
            case when tg_op = 'UPDATE' then old.data end, new.data);
  end if;
  return new;
end $$;
drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before insert or update on public.characters
  for each row execute function public.characters_touch();

create or replace function public.characters_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is distinct from old.user_id then
    insert into public.admin_audit (actor, action, target_user, target_key, before)
    values (auth.uid(), 'delete', old.user_id, old.save_key, old.data);
  end if;
  return old;
end $$;
drop trigger if exists characters_deleted on public.characters;
create trigger characters_deleted after delete on public.characters
  for each row execute function public.characters_deleted();

create or replace function public.roles_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_audit (actor, action, target_user, after)
  values (auth.uid(), 'role-' || lower(tg_op), coalesce(new.user_id, old.user_id),
          to_jsonb(coalesce(new.role, old.role)));
  return coalesce(new, old);
end $$;
drop trigger if exists roles_audit on public.user_roles;
create trigger roles_audit after insert or delete on public.user_roles
  for each row execute function public.roles_audit();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.characters enable row level security;
alter table public.admin_audit enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "roles read" on public.user_roles;
create policy "roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
drop policy if exists "roles grant" on public.user_roles;
create policy "roles grant" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') and granted_by = auth.uid());
drop policy if exists "roles revoke" on public.user_roles;
create policy "roles revoke" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid());

drop policy if exists "characters read" on public.characters;
create policy "characters read" on public.characters for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
drop policy if exists "characters insert own" on public.characters;
create policy "characters insert own" on public.characters for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "characters update" on public.characters;
create policy "characters update" on public.characters for update to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (user_id = auth.uid() or public.is_staff(auth.uid()));
drop policy if exists "characters delete" on public.characters;
create policy "characters delete" on public.characters for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "audit read" on public.admin_audit;
create policy "audit read" on public.admin_audit for select to authenticated
  using (public.is_staff(auth.uid()));

-- Players may only touch their own last_seen and nick; the id never changes.
revoke update on public.profiles from authenticated;
grant update (nick, last_seen) on public.profiles to authenticated;
revoke insert, update, delete on public.admin_audit from authenticated, anon;
revoke all on public.profiles, public.user_roles, public.characters, public.admin_audit from anon;
