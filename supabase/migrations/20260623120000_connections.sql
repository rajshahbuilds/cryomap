-- connections --------------------------------------------------------------
-- Explicit port-to-port wires between two components (beyond the implicit
-- trunk wires derived from line/stage placement). Each endpoint references a
-- component plus a port (side + index). Deleting a component or the fridge
-- cascades to its connections.
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid references public.fridges (id) on delete cascade,
  from_component_id uuid not null references public.components (id) on delete cascade,
  from_port_side text not null,
  from_port_index integer not null default 0,
  to_component_id uuid not null references public.components (id) on delete cascade,
  to_port_side text not null,
  to_port_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.connections enable row level security;

create policy "connections: authenticated full access"
  on public.connections for all to authenticated
  using (true) with check (true);

create index connections_fridge_id_idx on public.connections (fridge_id);
create index connections_from_component_id_idx on public.connections (from_component_id);
create index connections_to_component_id_idx on public.connections (to_component_id);
