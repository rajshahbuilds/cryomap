\set ON_ERROR_STOP on
create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$ begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid::text,'role','authenticated')::text,true);
end $$;
-- Reuse the synthetic tenant fixtures, never a hosted database.
do $$ declare n int; begin
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000002');
  insert into public.components(id,fridge_id,sheet_id,component_type,line_endpoint_id,free_floating,x_abs,y_abs,rotation)
    values ('eeeeeeee-0000-4000-8000-000000000060','eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','input_port','eeeeeeee-0000-4000-8000-000000000028',true,320,-48,180);
  update public.components set x_abs=240,y_abs=40 where id='eeeeeeee-0000-4000-8000-000000000060';
  if not exists(select 1 from public.components where id='eeeeeeee-0000-4000-8000-000000000060' and x_abs=240) then raise exception 'FAIL editor cannot move port'; end if;
  insert into public.connections(fridge_id,sheet_id,from_component_id,from_port_side,to_component_id,to_port_side)
    values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','eeeeeeee-0000-4000-8000-000000000060','left','eeeeeeee-0000-4000-8000-000000000033','left');
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000003');
  if not exists(select 1 from public.components where id='eeeeeeee-0000-4000-8000-000000000060') then raise exception 'FAIL viewer cannot read port'; end if;
  update public.components set x_abs=600 where id='eeeeeeee-0000-4000-8000-000000000060';
  get diagnostics n=row_count;if n<>0 then raise exception 'FAIL viewer moved port'; end if;
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000004');
  if exists(select 1 from public.components where id='eeeeeeee-0000-4000-8000-000000000060') then raise exception 'FAIL other tenant reads port'; end if;
  perform pg_temp.login('eeeeeeee-0000-4000-8000-000000000001');
  begin
    update public.components set line_endpoint_id='eeeeeeee-0000-4000-8000-000000000029' where id='eeeeeeee-0000-4000-8000-000000000060';
    raise exception 'FAIL cross-fridge endpoint accepted';
  exception when check_violation then null; end;
  begin
    update public.components set sheet_id='eeeeeeee-0000-4000-8000-000000000020' where id='eeeeeeee-0000-4000-8000-000000000060';
    raise exception 'FAIL cross-sheet endpoint accepted';
  exception when check_violation then null; end;
  begin
    update public.components set component_type='filter_lp' where id='eeeeeeee-0000-4000-8000-000000000060';
    raise exception 'FAIL non-I/O component accepted';
  exception when check_violation then null; end;
  begin
    insert into public.components(fridge_id,sheet_id,component_type,line_endpoint_id)
      values ('eeeeeeee-0000-4000-8000-000000000014','eeeeeeee-0000-4000-8000-00000000001e','input_port','eeeeeeee-0000-4000-8000-000000000028');
    raise exception 'FAIL duplicate endpoint accepted';
  exception when unique_violation then null; end;
  raise notice '[pass] line ports connect and move with existing tenant permissions and scope constraints';
end $$;
