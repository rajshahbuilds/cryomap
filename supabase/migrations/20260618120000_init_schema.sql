-- CryoMap initial schema
--
-- Tables: profiles, fridges, stages, lines, custom_component_defs,
--         components, locks, versions.
--
-- RLS: enabled on every table. MVP policy is intentionally permissive —
-- any authenticated user can read and write everything. Tighter,
-- role-based access is explicitly out of scope for Phase 1.
--
-- This file is the authoritative contract for the TypeScript types.

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Shared helper: keep updated_at current on row updates ---------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles -----------------------------------------------------------------
-- Mirrors display info from auth.users into a public table.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: authenticated full access"
  on public.profiles for all to authenticated
  using (true) with check (true);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- fridges ------------------------------------------------------------------
create table public.fridges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor text,
  model text,
  description text,
  location text,
  archived boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fridges enable row level security;

create policy "fridges: authenticated full access"
  on public.fridges for all to authenticated
  using (true) with check (true);

create trigger fridges_set_updated_at
  before update on public.fridges
  for each row execute function public.set_updated_at();

-- stages -------------------------------------------------------------------
-- Ordered temperature bands, per fridge.
create table public.stages (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid references public.fridges (id) on delete cascade,
  name text not null,
  nominal_temp text,
  color text,
  sort_order integer not null,
  height_px integer not null default 120,
  hidden boolean not null default false,
  locked boolean not null default false
);

alter table public.stages enable row level security;

create policy "stages: authenticated full access"
  on public.stages for all to authenticated
  using (true) with check (true);

create index stages_fridge_id_idx on public.stages (fridge_id);

-- lines --------------------------------------------------------------------
-- Vertical signal chains.
create table public.lines (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid references public.fridges (id) on delete cascade,
  name text not null,
  line_type text,
  direction text,
  status text not null default 'planned',
  owner text,
  description text,
  connector_type text,
  cable_type text,
  frequency_range text,
  line_impedance text,
  last_verified_date date,
  notes text,
  sort_order integer not null,
  show_label boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lines enable row level security;

create policy "lines: authenticated full access"
  on public.lines for all to authenticated
  using (true) with check (true);

create index lines_fridge_id_idx on public.lines (fridge_id);

-- custom_component_defs ----------------------------------------------------
-- Reusable custom component definitions, per fridge.
create table public.custom_component_defs (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid references public.fridges (id) on delete cascade,
  name text not null,
  width_px integer not null default 80,
  height_px integer not null default 40,
  ports jsonb not null default '[]',
  extra_field_keys text[],
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.custom_component_defs enable row level security;

create policy "custom_component_defs: authenticated full access"
  on public.custom_component_defs for all to authenticated
  using (true) with check (true);

create index custom_component_defs_fridge_id_idx
  on public.custom_component_defs (fridge_id);

-- components ---------------------------------------------------------------
-- Component instances placed on the diagram.
create table public.components (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid references public.fridges (id) on delete cascade,
  line_id uuid references public.lines (id) on delete set null,
  stage_id uuid references public.stages (id) on delete set null,
  component_type text not null,
  custom_def_id uuid references public.custom_component_defs (id) on delete set null,
  label text,
  value text,
  manufacturer text,
  part_number text,
  serial_number text,
  frequency_range text,
  power_rating text,
  datasheet_url text,
  install_date date,
  removed_date date,
  status text not null default 'planned',
  notes text,
  extra_fields jsonb not null default '{}',
  x_offset integer not null default 0,
  rotation integer not null default 0,
  free_floating boolean not null default false,
  x_abs integer,
  y_abs integer,
  last_edited_by uuid references public.profiles (id),
  last_edited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.components enable row level security;

create policy "components: authenticated full access"
  on public.components for all to authenticated
  using (true) with check (true);

create index components_fridge_id_idx on public.components (fridge_id);
create index components_line_id_idx on public.components (line_id);
create index components_stage_id_idx on public.components (stage_id);

-- locks --------------------------------------------------------------------
-- One row per fridge while it is checked out for editing.
create table public.locks (
  fridge_id uuid primary key references public.fridges (id) on delete cascade,
  locked_by uuid references public.profiles (id),
  locked_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.locks enable row level security;

create policy "locks: authenticated full access"
  on public.locks for all to authenticated
  using (true) with check (true);

-- versions -----------------------------------------------------------------
-- Immutable point-in-time snapshots of a fridge's diagram.
create table public.versions (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid references public.fridges (id) on delete cascade,
  snapshot jsonb not null,
  commit_message text not null,
  tag text,
  snapshot_type text not null default 'current',
  author_id uuid references public.profiles (id),
  author_name text,
  created_at timestamptz not null default now()
);

alter table public.versions enable row level security;

create policy "versions: authenticated full access"
  on public.versions for all to authenticated
  using (true) with check (true);

create index versions_fridge_id_created_at_idx
  on public.versions (fridge_id, created_at desc);
