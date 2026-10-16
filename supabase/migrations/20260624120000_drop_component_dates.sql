-- Drop the unused install_date / removed_date / status columns from
-- components. These fields were removed from the component editor; old version
-- snapshots ignore the extra keys (Zod strips unknown keys), so no data
-- migration is needed. (Lines keep their own `status` column.)
alter table public.components
  drop column if exists install_date,
  drop column if exists removed_date,
  drop column if exists status;
