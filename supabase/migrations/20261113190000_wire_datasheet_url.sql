-- Extend the shared payload without rewriting existing wires or snapshots.
-- As with component datasheets, the application validates URL syntax; SQL
-- accepts an optional text value. Both wire tables use this validator.
create or replace function public.valid_wire_properties(properties jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare key text; item jsonb; value numeric; unit text;
begin
  if jsonb_typeof(properties) is distinct from 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(properties) k where k not in
    ('construction','label','show_label','material','inner_shield_material',
     'outer_shield_material','length','size','conductor_count','datasheet_url','notes')) then return false; end if;
  if properties ? 'construction' and
     (jsonb_typeof(properties->'construction') <> 'string' or
      properties->>'construction' not in ('unspecified','single','parallel_pair',
       'twisted_pair','two_twisted_pairs','ribbon','multicore','coaxial','triaxial','custom')) then return false; end if;
  if properties ? 'show_label' and jsonb_typeof(properties->'show_label') <> 'boolean' then return false; end if;
  foreach key in array array['label','material','inner_shield_material','outer_shield_material','datasheet_url','notes'] loop
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
