-- Entry-cable details belong to the line's I/O connection. They remain with
-- that entry when its first component changes or the line is temporarily empty.
alter table public.lines
  add column entry_wire_properties jsonb not null
    default '{"construction":"unspecified","show_label":false}'::jsonb,
  add constraint lines_entry_wire_properties_valid
    check (public.valid_wire_properties(entry_wire_properties));
