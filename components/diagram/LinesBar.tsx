import type { Line, LineType } from "@/lib/types";
import { LINE_TYPES } from "@/lib/types";
import { getLineTypeColor, getLineTypeLabel } from "@/lib/constants/lineTypes";

interface LinesBarProps {
  lines: Line[];
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onSetType: (id: string, type: LineType | null) => void;
  onToggleLabel: (id: string, show: boolean) => void;
  onMove: (id: string, direction: "left" | "right") => void;
  onDelete: (id: string) => void;
}

const iconButton =
  "rounded px-1.5 py-0.5 text-xs text-muted transition hover:bg-background disabled:opacity-40";

/**
 * Line-management strip (shown when the user holds the lock): add lines and,
 * per line, rename / set type / toggle label / reorder / delete. Detailed line
 * properties live in the PropertiesPanel.
 */
export function LinesBar({
  lines,
  onAdd,
  onRename,
  onSetType,
  onToggleLabel,
  onMove,
  onDelete,
}: LinesBarProps) {
  const ordered = [...lines].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-1.5">
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded-md border border-transparent bg-foreground px-2.5 py-1 text-xs font-medium text-surface transition hover:opacity-90"
      >
        + Add line
      </button>

      {ordered.map((line, index) => (
        <div
          key={line.id}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{
              background: line.line_type
                ? getLineTypeColor(line.line_type)
                : "#6b7280",
            }}
          />
          <input
            aria-label="Line name"
            defaultValue={line.name}
            onBlur={(e) => onRename(line.id, e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-24 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-status-planned"
          />
          <select
            aria-label="Line type"
            value={line.line_type ?? ""}
            onChange={(e) =>
              onSetType(line.id, (e.target.value || null) as LineType | null)
            }
            className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          >
            <option value="">Untyped</option>
            {LINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {getLineTypeLabel(type)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={line.show_label}
              onChange={(e) => onToggleLabel(line.id, e.target.checked)}
            />
            label
          </label>
          <button
            type="button"
            aria-label="Move line left"
            disabled={index === 0}
            onClick={() => onMove(line.id, "left")}
            className={iconButton}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="Move line right"
            disabled={index === ordered.length - 1}
            onClick={() => onMove(line.id, "right")}
            className={iconButton}
          >
            ▶
          </button>
          <button
            type="button"
            aria-label="Delete line"
            onClick={() => onDelete(line.id)}
            className={`${iconButton} hover:text-status-broken`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
