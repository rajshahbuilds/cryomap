-- Per-line horizontal spacing. Each line column gets an explicit width
-- (the horizontal space it consumes before the next column), so users can
-- widen/narrow a column by dragging its divider — the line-equivalent of a
-- stage band's height. Default 120 matches the previous fixed COLUMN_WIDTH, so
-- existing diagrams are unchanged.
alter table public.lines
  add column width_px integer not null default 120;
