-- Additive: existing connections and old clients keep working unchanged.
-- Properties are a validated JSON object shared by both kinds of wire.
create function public.valid_wire_properties(properties jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare key text; item jsonb; value numeric; unit text;
begin
  if jsonb_typeof(properties) is distinct from 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(properties) k where k not in
    ('construction','label','show_label','material','inner_shield_material',
     'outer_shield_material','length','size','conductor_count','notes')) then return false; end if;
  if properties ? 'construction' and
     (jsonb_typeof(properties->'construction') <> 'string' or
      properties->>'construction' not in ('unspecified','single','parallel_pair',
       'twisted_pair','two_twisted_pairs','ribbon','multicore','coaxial','triaxial','custom')) then return false; end if;
  if properties ? 'show_label' and jsonb_typeof(properties->'show_label') <> 'boolean' then return false; end if;
  foreach key in array array['label','material','inner_shield_material','outer_shield_material','notes'] loop
    if properties ? key and jsonb_typeof(properties->key) not in ('string','null') then return false; end if;
  end loop;
  if properties ? 'conductor_count' and properties->'conductor_count' <> 'null'::jsonb then
    if jsonb_typeof(properties->'conductor_count') <> 'number' then return false; end if;
    value := (properties->>'conductor_count')::numeric;
    if value <= 0 or value > 2147483647 or value <> trunc(value) then return false; end if;
  end if;
  foreach key in array array['length','size'] loop
    item := properties->key;
    if item is null or item = 'null'::jsonb then continue; end if;
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(item) k where k not in ('value','unit')) then return false; end if;
    if jsonb_typeof(item->'value') is distinct from 'number' or
       jsonb_typeof(item->'unit') is distinct from 'string' then return false; end if;
    value := (item->>'value')::numeric;
    unit := item->>'unit';
    if key = 'length' then
      if unit not in ('m','cm','mm') or value <= 0 then return false; end if;
    elsif unit = 'awg' then
      -- -1/-2/-3 encode 2/0, 3/0, and 4/0 AWG, respectively.
      if value < -3 or value <> trunc(value) then return false; end if;
    elsif unit not in ('mm','um') or value <= 0 then return false;
    end if;
  end loop;
  return true;
end $$;

alter table public.connections
  add column wire_properties jsonb not null default '{"construction":"unspecified","show_label":false}'::jsonb,
  add constraint connections_wire_properties_valid check (public.valid_wire_properties(wire_properties));

-- These rows describe automatically generated segments; they do not create
-- connectivity. Endpoint ordering is canonical, independent of drawing order.
create table public.wire_segment_properties (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid not null references public.fridges(id) on delete cascade,
  sheet_id uuid not null references public.sheets(id) on delete cascade,
  line_id uuid not null references public.lines(id) on delete cascade,
  from_component_id uuid not null references public.components(id) on delete cascade,
  to_component_id uuid not null references public.components(id) on delete cascade,
  wire_properties jsonb not null default '{"construction":"unspecified","show_label":false}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wire_segment_endpoint_order check (from_component_id < to_component_id),
  constraint wire_segment_unique unique (line_id, from_component_id, to_component_id),
  constraint wire_segment_properties_valid check (public.valid_wire_properties(wire_properties))
);
create index wire_segment_properties_fridge_idx on public.wire_segment_properties(fridge_id);
create index wire_segment_properties_sheet_idx on public.wire_segment_properties(sheet_id);
create index wire_segment_properties_from_idx on public.wire_segment_properties(from_component_id);
create index wire_segment_properties_to_idx on public.wire_segment_properties(to_component_id);

alter table public.wire_segment_properties enable row level security;
grant select, insert, update, delete on public.wire_segment_properties to authenticated;
create policy "wire segments: members read" on public.wire_segment_properties for select to authenticated
  using (public.can_read_fridge(fridge_id));
create policy "wire segments: editors insert" on public.wire_segment_properties for insert to authenticated
  with check (public.can_edit_fridge(fridge_id));
create policy "wire segments: editors update" on public.wire_segment_properties for update to authenticated
  using (public.can_edit_fridge(fridge_id)) with check (public.can_edit_fridge(fridge_id));
create policy "wire segments: editors delete" on public.wire_segment_properties for delete to authenticated
  using (public.can_edit_fridge(fridge_id));

-- Validate denormalized references even when a caller can edit both fridges.
-- Invoker rights preserve RLS; errors never disclose another tenant's rows.
create function public.validate_wire_segment_scope()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.lines l
    join public.sheets s on s.id = l.sheet_id and s.fridge_id = l.fridge_id and s.kind = 'fridge'
    join public.components a on a.id = new.from_component_id and a.line_id = l.id
      and a.sheet_id = s.id and a.fridge_id = l.fridge_id and not a.free_floating
    join public.components b on b.id = new.to_component_id and b.line_id = l.id
      and b.sheet_id = s.id and b.fridge_id = l.fridge_id and not b.free_floating
    where l.id = new.line_id and s.id = new.sheet_id and l.fridge_id = new.fridge_id
  ) then
    raise check_violation using message = 'Wire segment endpoints must belong to its fridge, sheet, and line.';
  end if;
  return new;
end $$;
create trigger wire_segment_scope before insert or update on public.wire_segment_properties
  for each row execute function public.validate_wire_segment_scope();

-- Layout-only moves preserve attributes. Reassigning a parent changes the
-- physical segment identity, so clear its old properties before the update.
create function public.clear_reassigned_wire_segments()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'components' then
    if (new.fridge_id,new.sheet_id,new.line_id,new.free_floating) is distinct from
       (old.fridge_id,old.sheet_id,old.line_id,old.free_floating) then
      delete from public.wire_segment_properties where from_component_id = old.id or to_component_id = old.id;
    end if;
  elsif tg_table_name = 'lines' then
    if (new.fridge_id,new.sheet_id) is distinct from (old.fridge_id,old.sheet_id) then
      delete from public.wire_segment_properties where line_id = old.id;
    end if;
  elsif new.fridge_id is distinct from old.fridge_id then
    delete from public.wire_segment_properties where sheet_id = old.id;
  end if;
  return new;
end $$;
create trigger clear_component_wire_segments before update of fridge_id,sheet_id,line_id,free_floating on public.components
  for each row execute function public.clear_reassigned_wire_segments();
create trigger clear_line_wire_segments before update of fridge_id,sheet_id on public.lines
  for each row execute function public.clear_reassigned_wire_segments();
create trigger clear_sheet_wire_segments before update of fridge_id on public.sheets
  for each row execute function public.clear_reassigned_wire_segments();
