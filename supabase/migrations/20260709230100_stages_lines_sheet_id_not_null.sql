-- Tighten stages.sheet_id / lines.sheet_id to NOT NULL
--
-- ⚠️  APPLY THIS LAST, alongside 20260709220200. See that file's header for the
-- full order of operations: it is only safe once every deployed bundle writes a
-- `sheet_id` when inserting a stage or a line.

do $$
declare
  orphan_stages integer;
  orphan_lines integer;
begin
  select count(*) into orphan_stages from public.stages where sheet_id is null;
  select count(*) into orphan_lines from public.lines where sheet_id is null;

  if orphan_stages > 0 or orphan_lines > 0 then
    raise exception
      'refusing to set NOT NULL: % stage(s) and % line(s) still have a null sheet_id. Re-run 20260709230000, or delete the orphans.',
      orphan_stages, orphan_lines;
  end if;
end $$;

alter table public.stages alter column sheet_id set not null;
alter table public.lines alter column sheet_id set not null;
