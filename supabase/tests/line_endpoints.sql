-- Runs after wire_properties.sql, reusing its disposable tenant fixtures.
\set ON_ERROR_STOP on
create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid::text,'role','authenticated')::text,true);
end $$;
do $$ declare port jsonb; begin
  if exists(select 1 from public.lines where direction is null) then raise exception 'FAIL undefined direction'; end if;
  insert into public.lines(fridge_id,sheet_id,name,sort_order)
    values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','Default input',4);
  if not exists(select 1 from public.lines where name='Default input' and direction='input') then raise exception 'FAIL direction default'; end if;
  begin
    update public.lines set direction=null where id='eeeeeeee-0000-4000-8000-000000000028';
    raise exception 'FAIL accepted null direction';
  exception when not_null_violation then null; end;
  begin
    update public.lines set direction='unspecified' where id='eeeeeeee-0000-4000-8000-000000000028';
    raise exception 'FAIL accepted unspecified direction';
  exception when check_violation then null; end;
  foreach port in array array['null'::jsonb,'{}','[]','{"side":"left"}','{"side":"diagonal","index":0}','{"side":"left","index":-1}','{"side":"left","index":0.5}','{"side":"left","index":"bad"}','{"side":"left","index":2147483648}','{"side":"left","index":0,"extra":true}'] loop
    if public.valid_line_port(port) then raise exception 'FAIL accepted malformed port %',port; end if;
    begin
      update public.components set line_entry_port=port where id='eeeeeeee-0000-4000-8000-000000000033';
      raise exception 'FAIL persisted malformed port %',port;
    exception when check_violation then null; end;
  end loop;
  if not public.valid_line_port(null) or not public.valid_line_port('{"side":"top","index":0}') then raise exception 'FAIL valid port rejected'; end if;
  raise notice '[pass] line directions and port identities are validated';
end $$;

do $$ declare n int; begin
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000002');
  update public.components set line_entry_port='{"side":"left","index":0}', line_exit_port='{"side":"right","index":0}' where id='eeeeeeee-0000-4000-8000-000000000033';
  if not exists(select 1 from public.components where id='eeeeeeee-0000-4000-8000-000000000033' and line_entry_port->>'side'='left' and line_exit_port->>'side'='right') then raise exception 'FAIL editor port choices'; end if;
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000003');
  update public.components set line_entry_port=null where id='eeeeeeee-0000-4000-8000-000000000033';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL viewer changed ports'; end if;
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000004');
  if exists(select 1 from public.components where id='eeeeeeee-0000-4000-8000-000000000033') then raise exception 'FAIL cross-tenant port read'; end if;
  raise notice '[pass] component port choices preserve tenant permissions';
end $$;
