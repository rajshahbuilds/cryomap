do $$ begin
  if not exists(select 1 from public.connections where id='eeeeeeee-0000-4000-8000-00000000003c' and wire_properties='{"construction":"unspecified","show_label":false}'::jsonb and from_component_id='eeeeeeee-0000-4000-8000-000000000032' and to_component_id='eeeeeeee-0000-4000-8000-000000000033') then raise exception 'FAIL upgrade changed existing connection'; end if;
  if (select snapshot from public.versions where id='eeeeeeee-0000-4000-8000-000000000046') <> '{"stages":[],"lines":[],"components":[],"custom_defs":[],"connections":[],"snapshotted_at":"2026-11-13T00:00:00Z"}'::jsonb then raise exception 'FAIL upgrade changed historical snapshot'; end if;
  if exists(select 1 from public.wire_segment_properties) then raise exception 'FAIL upgrade invented segment metadata'; end if;
  raise notice '[pass] existing connections and historical snapshots survive upgrade';
end $$;
-- Old clients can still insert without supplying wire properties.
insert into public.connections(fridge_id,sheet_id,from_component_id,from_port_side,to_component_id,to_port_side) values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000032','left','eeeeeeee-0000-4000-8000-000000000033','right');
