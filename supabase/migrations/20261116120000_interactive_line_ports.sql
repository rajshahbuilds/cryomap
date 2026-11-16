-- Line endpoints reuse ordinary I/O components, existing connection FKs, and
-- component placement. Legacy endpoints are materialized on the first edit.
-- Existing diagrams and wires are unchanged by this additive migration.
alter table public.components
  add column line_endpoint_id uuid references public.lines(id) on delete cascade,
  add constraint components_one_endpoint_per_line unique(line_endpoint_id),
  add constraint components_line_endpoint_type check (
    line_endpoint_id is null or (
      component_type in ('input_port','output_port','bidir_port')
      and line_id is null and custom_def_id is null
    )
  );

create function public.validate_line_endpoint_scope()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.line_endpoint_id is not null and not exists (
    select 1 from public.lines l join public.sheets s on s.id = l.sheet_id
    where l.id = new.line_endpoint_id and l.fridge_id = new.fridge_id
      and l.sheet_id = new.sheet_id and s.fridge_id = new.fridge_id and s.kind = 'fridge'
  ) then
    raise check_violation using message = 'Line endpoint must belong to its fridge and sheet.';
  end if;
  return new;
end $$;
create trigger line_endpoint_scope before insert or update on public.components
  for each row execute function public.validate_line_endpoint_scope();
