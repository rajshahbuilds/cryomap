-- component mirror -----------------------------------------------------------
-- Horizontal flip for a component symbol (companion to `rotation`).
alter table public.components
  add column mirrored boolean not null default false;
