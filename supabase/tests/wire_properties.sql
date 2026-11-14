-- Fresh-schema wire validation, role matrix, reference integrity, and cleanup.
\set ON_ERROR_STOP on
\ir _wire_properties_seed.sql
\ir _wire_properties_upgrade_check.sql
create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid::text,'role','authenticated')::text,true);
end $$;

do $$ declare item jsonb; begin
  foreach item in array array['{}'::jsonb,'{"datasheet_url":"https://example.com/wire.pdf"}','{"datasheet_url":null}','{"construction":"twisted_pair","label":"sensor","material":"copper","show_label":false,"length":{"value":1.2,"unit":"m"},"size":{"value":36,"unit":"awg"},"conductor_count":2}', '{"size":{"value":-3,"unit":"awg"}}', '{"size":{"value":0,"unit":"awg"}}', '{"length":null,"size":null,"conductor_count":null}'] loop
    if not public.valid_wire_properties(item) then raise exception 'FAIL rejected valid properties %',item; end if;
  end loop;
  foreach item in array array['null'::jsonb,'[]','{"construction":null}','{"construction":"twisted_quad"}','{"show_label":null}','{"show_label":"yes"}','{"material":1}','{"datasheet_url":123}','{"unknown":true}','{"conductor_count":0}','{"conductor_count":1.5}','{"conductor_count":2147483648}','{"length":{"value":0,"unit":"m"}}','{"length":{"value":2,"unit":"ft"}}','{"length":{"value":2}}','{"length":{"value":2,"unit":"m","extra":1}}','{"size":{"value":-4,"unit":"awg"}}','{"size":{"value":1.5,"unit":"awg"}}','{"size":{"value":0,"unit":"mm"}}'] loop
    if public.valid_wire_properties(item) then raise exception 'FAIL accepted invalid properties %',item; end if;
    begin
      update public.connections set wire_properties=item where id='eeeeeeee-0000-4000-8000-00000000003c';
      raise exception 'FAIL database accepted invalid properties %',item;
    exception when check_violation or not_null_violation then null; end;
  end loop;
  raise notice '[pass] database validates wire attributes';
end $$;

do $$ declare segment uuid; n int; begin
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000002');
  insert into public.wire_segment_properties(fridge_id,sheet_id,line_id,from_component_id,to_component_id,wire_properties) values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000028','eeeeeeee-0000-4000-8000-000000000032','eeeeeeee-0000-4000-8000-000000000033','{"construction":"twisted_pair","label":"thermometer"}') returning id into segment;
  update public.wire_segment_properties set wire_properties='{"construction":"coaxial","datasheet_url":"https://example.com/wire.pdf"}' where id=segment;
  if not exists(select 1 from public.wire_segment_properties where id=segment and wire_properties->>'construction'='coaxial' and wire_properties->>'datasheet_url'='https://example.com/wire.pdf') then raise exception 'FAIL editor update'; end if;
  update public.connections set wire_properties='{"label":"RF","construction":"coaxial","datasheet_url":"https://example.com/coax.pdf"}' where id='eeeeeeee-0000-4000-8000-00000000003c';
  delete from public.wire_segment_properties where id=segment;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'FAIL editor delete'; end if;
  insert into public.wire_segment_properties(id,fridge_id,sheet_id,line_id,from_component_id,to_component_id) values ('eeeeeeee-0000-4000-8000-000000000050','eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000028','eeeeeeee-0000-4000-8000-000000000032','eeeeeeee-0000-4000-8000-000000000033');
  begin
    insert into public.wire_segment_properties(fridge_id,sheet_id,line_id,from_component_id,to_component_id) values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000028','eeeeeeee-0000-4000-8000-000000000032','eeeeeeee-0000-4000-8000-000000000033');
    raise exception 'FAIL duplicate segment';
  exception when unique_violation then null; end;
  begin
    insert into public.wire_segment_properties(fridge_id,sheet_id,line_id,from_component_id,to_component_id) values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000028','eeeeeeee-0000-4000-8000-000000000033','eeeeeeee-0000-4000-8000-000000000032');
    raise exception 'FAIL reversed endpoint ordering';
  exception when check_violation then null; end;
  raise notice '[pass] editor CRUD and canonical segment identity';
end $$;

do $$ declare n int; begin
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000003');
  if not exists(select 1 from public.wire_segment_properties where id='eeeeeeee-0000-4000-8000-000000000050') then raise exception 'FAIL viewer read'; end if;
  update public.wire_segment_properties set wire_properties='{}' where id='eeeeeeee-0000-4000-8000-000000000050';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL viewer updated'; end if;
  delete from public.wire_segment_properties where id='eeeeeeee-0000-4000-8000-000000000050';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL viewer deleted'; end if;
  update public.connections set wire_properties='{}' where id='eeeeeeee-0000-4000-8000-00000000003c';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL viewer updated connection'; end if;
  begin
    insert into public.wire_segment_properties(fridge_id,sheet_id,line_id,from_component_id,to_component_id) values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000028','eeeeeeee-0000-4000-8000-000000000032','eeeeeeee-0000-4000-8000-000000000033');
    raise exception 'FAIL viewer inserted';
  exception when insufficient_privilege then null; end;
  raise notice '[pass] viewers can read but cannot modify wire metadata';
end $$;

do $$ declare n int; begin
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000004');
  if exists(select 1 from public.wire_segment_properties where id='eeeeeeee-0000-4000-8000-000000000050') then raise exception 'FAIL cross-tenant read'; end if;
  update public.wire_segment_properties set wire_properties='{}' where id='eeeeeeee-0000-4000-8000-000000000050';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL outsider updated'; end if;
  delete from public.wire_segment_properties where id='eeeeeeee-0000-4000-8000-000000000050';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'FAIL outsider deleted'; end if;
  begin
    insert into public.wire_segment_properties(fridge_id,sheet_id,line_id,from_component_id,to_component_id) values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000028','eeeeeeee-0000-4000-8000-000000000032','eeeeeeee-0000-4000-8000-000000000033');
    raise exception 'FAIL outsider inserted';
  exception when insufficient_privilege or check_violation then null; end;
  raise notice '[pass] wire metadata is isolated between tenants';
end $$;

do $$ begin
  -- This administrator can edit BOTH fridges; scope still must be consistent.
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000001');
  begin
    update public.wire_segment_properties set to_component_id='eeeeeeee-0000-4000-8000-000000000034' where id='eeeeeeee-0000-4000-8000-000000000050';
    raise exception 'FAIL cross-fridge endpoint accepted';
  exception when check_violation then null; end;
  begin
    update public.wire_segment_properties set line_id='eeeeeeee-0000-4000-8000-00000000002a' where id='eeeeeeee-0000-4000-8000-000000000050';
    raise exception 'FAIL different line accepted';
  exception when check_violation then null; end;
  begin
    update public.wire_segment_properties set sheet_id='eeeeeeee-0000-4000-8000-000000000020' where id='eeeeeeee-0000-4000-8000-000000000050';
    raise exception 'FAIL room-temp scope accepted';
  exception when check_violation then null; end;
  begin
    update public.wire_segment_properties set fridge_id='eeeeeeee-0000-4000-8000-000000000015' where id='eeeeeeee-0000-4000-8000-000000000050';
    raise exception 'FAIL mismatched fridge accepted';
  exception when check_violation then null; end;
  update public.components set x_offset=12 where id='eeeeeeee-0000-4000-8000-000000000032';
  if not exists(select 1 from public.wire_segment_properties where id='eeeeeeee-0000-4000-8000-000000000050') then raise exception 'FAIL layout move lost properties'; end if;
  update public.components set line_id='eeeeeeee-0000-4000-8000-00000000002a' where id='eeeeeeee-0000-4000-8000-000000000032';
  if exists(select 1 from public.wire_segment_properties where id='eeeeeeee-0000-4000-8000-000000000050') then raise exception 'FAIL reparent retained invalid segment'; end if;
  update public.components set line_id='eeeeeeee-0000-4000-8000-000000000028' where id='eeeeeeee-0000-4000-8000-000000000032';
  insert into public.wire_segment_properties(id,fridge_id,sheet_id,line_id,from_component_id,to_component_id) values ('eeeeeeee-0000-4000-8000-000000000051','eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000028','eeeeeeee-0000-4000-8000-000000000032','eeeeeeee-0000-4000-8000-000000000033');
  delete from public.components where id='eeeeeeee-0000-4000-8000-000000000032';
  if exists(select 1 from public.wire_segment_properties where id='eeeeeeee-0000-4000-8000-000000000051') then raise exception 'FAIL endpoint deletion left properties'; end if;
  raise notice '[pass] scope checks, layout preservation, reassignment cleanup, endpoint cascades';
end $$;
