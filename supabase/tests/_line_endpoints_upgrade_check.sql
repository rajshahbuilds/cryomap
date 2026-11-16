do $$ begin
  if not exists(select 1 from public.lines where id='eeeeeeee-0000-4000-8000-000000000028' and direction='input') then raise exception 'FAIL historical empty direction was not backfilled'; end if;
  if exists(select 1 from public.components where line_entry_port is not null or line_exit_port is not null) then raise exception 'FAIL upgrade invented component port choices'; end if;
  raise notice '[pass] empty directions upgrade to Input without inventing port choices';
end $$;
