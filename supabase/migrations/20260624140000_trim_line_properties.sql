-- Drop unused line metadata columns. These fields were removed from the
-- line editor (Properties panel) and are never read or written. Old version
-- snapshots ignore the extra keys (Zod strips unknown keys), so no data
-- migration is needed. Lines keep name/line_type/direction/status/notes.
alter table public.lines
  drop column if exists owner,
  drop column if exists description,
  drop column if exists connector_type,
  drop column if exists cable_type,
  drop column if exists frequency_range,
  drop column if exists line_impedance,
  drop column if exists last_verified_date;
