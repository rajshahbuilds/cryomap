import type { Stage } from "@/lib/types";

interface StagesBarProps {
  stages: Stage[];
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onSetTemp: (id: string, temp: string) => void;
  onSetColor: (id: string, color: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string) => void;
}

const iconButton =
  "rounded px-1.5 py-0.5 text-xs text-muted transition hover:bg-background disabled:opacity-40";
const fieldClass =
  "rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-status-planned";

/**
 * Stage-management strip (shown when the user holds the lock): add stages and,
 * per stage, rename / set temperature / recolor / hide / reorder / delete.
 * Bands are also resizable by dragging their dividers on the canvas.
 */
export function StagesBar({
  stages,
  onAdd,
  onRename,
  onSetTemp,
  onSetColor,
  onToggleHidden,
  onMove,
  onDelete,
}: StagesBarProps) {
  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-1.5">
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded-md border border-transparent bg-foreground px-2.5 py-1 text-xs font-medium text-surface transition hover:opacity-90"
      >
        + Add stage
      </button>

      {ordered.map((stage, index) => (
        <div
          key={stage.id}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1"
        >
          <input
            type="color"
            aria-label="Stage color"
            value={stage.color ?? "#ffffff"}
            onChange={(e) => onSetColor(stage.id, e.target.value)}
            className="h-5 w-5 cursor-pointer rounded border border-border bg-surface p-0"
          />
          <input
            aria-label="Stage name"
            defaultValue={stage.name}
            onBlur={(e) => onRename(stage.id, e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={`w-20 ${fieldClass}`}
          />
          <input
            aria-label="Stage temperature"
            defaultValue={stage.nominal_temp ?? ""}
            placeholder="temp"
            onBlur={(e) => onSetTemp(stage.id, e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={`w-16 ${fieldClass}`}
          />
          <label className="flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={stage.hidden}
              onChange={(e) => onToggleHidden(stage.id, e.target.checked)}
            />
            hide
          </label>
          <button
            type="button"
            aria-label="Move stage up"
            disabled={index === 0}
            onClick={() => onMove(stage.id, "up")}
            className={iconButton}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move stage down"
            disabled={index === ordered.length - 1}
            onClick={() => onMove(stage.id, "down")}
            className={iconButton}
          >
            ▼
          </button>
          <button
            type="button"
            aria-label="Delete stage"
            onClick={() => onDelete(stage.id)}
            className={`${iconButton} hover:text-status-broken`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
