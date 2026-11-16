-- Every line has a sheet-boundary endpoint with a defined signal direction.
update public.lines set direction = 'input' where direction is null;
alter table public.lines alter column direction set default 'input',
  alter column direction set not null,
  add constraint lines_direction_valid check (direction in ('input','output','bidirectional'));

-- Local (unrotated) port identities; null chooses a safe automatic port.
create or replace function public.valid_line_port(port jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare port_index numeric;
begin
  if port is null then return true; end if;
  if jsonb_typeof(port) is distinct from 'object' then return false; end if;
  if not (port ?& array['side','index']) or (port - 'side' - 'index') <> '{}'::jsonb
    or jsonb_typeof(port->'side') <> 'string'
    or port->>'side' not in ('left','right','top','bottom')
    or jsonb_typeof(port->'index') <> 'number' then return false; end if;
  port_index := (port->>'index')::numeric;
  return port_index between 0 and 2147483647 and port_index = trunc(port_index);
end $$;
alter table public.components
  add column line_entry_port jsonb check (public.valid_line_port(line_entry_port)),
  add column line_exit_port jsonb check (public.valid_line_port(line_exit_port));
