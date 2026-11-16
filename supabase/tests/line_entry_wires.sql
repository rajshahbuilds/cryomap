\set ON_ERROR_STOP on
create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid::text,'role','authenticated')::text,true);
end $$;

do $$ declare item jsonb; begin
  if not exists(select 1 from public.lines where id='eeeeeeee-0000-4000-8000-000000000028' and entry_wire_properties='{"construction":"unspecified","show_label":false}'::jsonb) then raise exception 'FAIL entry default changed'; end if;
  foreach item in array array['null'::jsonb,'[]','{"construction":"invalid"}','{"show_label":"yes"}','{"datasheet_url":1}','{"length":{"value":0,"unit":"m"}}','{"unknown":true}'] loop
    begin
      update public.lines set entry_wire_properties=item where id='eeeeeeee-0000-4000-8000-000000000028';
      raise exception 'FAIL accepted invalid entry wire %',item;
    exception when check_violation then null; end;
  end loop;
  begin
    update public.lines set entry_wire_properties=null where id='eeeeeeee-0000-4000-8000-000000000028';
    raise exception 'FAIL accepted null entry properties';
  exception when not_null_violation then null; end;
  raise notice '[pass] line entry uses the shared wire defaults and validation';
end $$;

do $$ declare n int; begin
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000002');
  update public.lines set entry_wire_properties='{"construction":"twisted_pair","label":"Entry feed","show_label":false,"material":"copper","datasheet_url":"https://example.com/wire.pdf","length":{"value":1.2,"unit":"m"},"size":{"value":36,"unit":"awg"},"conductor_count":2}' where id='eeeeeeee-0000-4000-8000-000000000028';
  if not exists(select 1 from public.lines where id='eeeeeeee-0000-4000-8000-000000000028' and entry_wire_properties->>'label'='Entry feed' and entry_wire_properties->>'datasheet_url'='https://example.com/wire.pdf') then raise exception 'FAIL editor entry save'; end if;
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000003');
  if not exists(select 1 from public.lines where id='eeeeeeee-0000-4000-8000-000000000028' and entry_wire_properties->>'label'='Entry feed') then raise exception 'FAIL viewer entry read'; end if;
  update public.lines set entry_wire_properties='{}' where id='eeeeeeee-0000-4000-8000-000000000028';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL viewer entry write'; end if;
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000004');
  if exists(select 1 from public.lines where id='eeeeeeee-0000-4000-8000-000000000028') then raise exception 'FAIL outsider entry read'; end if;
  update public.lines set entry_wire_properties='{}' where id='eeeeeeee-0000-4000-8000-000000000028';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL outsider entry write'; end if;
  raise notice '[pass] entry-wire attributes preserve editor, viewer, and tenant permissions';
end $$;
