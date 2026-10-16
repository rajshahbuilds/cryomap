import type { LockState } from "@/lib/locks/state";

export type ExportFormat = "png" | "pdf" | "json";

interface ToolbarProps {
  lockState: LockState;
  busy?: boolean;
  dirty?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  /** When offline, checkout/check-in are disabled to avoid silent write failures. */
  offline?: boolean;
  /** Current fridge name; renders a name field/label when provided. */
  fridgeName?: string;
  /** Rename handler; when set (and editable) the name becomes an input. */
  onRenameFridge?: (name: string) => void;
  /** Current zoom level as a whole-number percentage. */
  zoomPercent?: number;
  /** Zoom controls; the cluster renders only when `onZoomIn` is provided. */
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  /** Show the export menu (PNG / PDF / JSON). Requires `onExport` to render. */
  showExport?: boolean;
  /** Export the diagram in the chosen format. */
  onExport?: (format: ExportFormat) => void;
  /** Disable the export menu while a capture is in flight. */
  exporting?: boolean;
  /** Whether the user's role permits checking out (editor+). Viewers see a
   * read-only badge instead of the check-out button. */
  canCheckOut?: boolean;
  onCheckOut: () => void;
  onRelease: () => void;
  onCheckIn?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleHistory?: () => void;
}

const iconButton =
  "rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-40";

const zoomButton =
  "px-2 py-1 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-40";

/**
 * Editor toolbar: inline-editable fridge name, checkout status, undo/redo, zoom
 * controls, version-history toggle, and a (stubbed) export button. The chrome
 * beyond lock/undo is gated on its props so read-only and minimal mounts stay
 * uncluttered.
 */
export function Toolbar({
  lockState,
  busy = false,
  dirty = false,
  canUndo = false,
  canRedo = false,
  offline = false,
  fridgeName,
  onRenameFridge,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  showExport = false,
  onExport,
  exporting = false,
  canCheckOut = true,
  onCheckOut,
  onRelease,
  onCheckIn,
  onUndo,
  onRedo,
  onToggleHistory,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
      {fridgeName !== undefined ? (
        onRenameFridge ? (
          <input
            key={fridgeName}
            aria-label="Fridge name"
            defaultValue={fridgeName}
            onBlur={(e) => onRenameFridge(e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-40 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-foreground outline-none hover:border-border focus:border-status-planned"
          />
        ) : (
          <span className="px-1.5 text-sm font-semibold text-foreground">
            {fridgeName}
          </span>
        )
      ) : null}

      {lockState === "LOCKED_BY_ME" ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-status-working">
            <span className="h-1.5 w-1.5 rounded-full bg-status-working" />
            Editing
          </span>
          <button
            type="button"
            aria-label="Undo"
            onClick={onUndo}
            disabled={!canUndo || busy}
            className={iconButton}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            aria-label="Redo"
            onClick={onRedo}
            disabled={!canRedo || busy}
            className={iconButton}
          >
            ↷ Redo
          </button>
          {dirty ? (
            <span className="text-xs text-muted">Unsaved changes</span>
          ) : null}
        </>
      ) : lockState === "LOCKED_BY_OTHER" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-status-noisy" />
          Read-only
        </span>
      ) : canCheckOut ? (
        <button
          type="button"
          onClick={onCheckOut}
          disabled={busy || offline}
          title={offline ? "You're offline" : undefined}
          className="rounded-md border border-transparent bg-foreground px-3 py-1 text-xs font-medium text-surface transition hover:opacity-90 disabled:opacity-60"
        >
          Check Out to Edit
        </button>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted"
          title="Your role in this workspace is view-only"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-status-noisy" />
          View only
        </span>
      )}

      <div className="ml-auto flex items-center gap-3">
        {offline ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-full border border-status-noisy px-2.5 py-0.5 text-xs font-medium text-status-noisy"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-status-noisy" />
            Offline
          </span>
        ) : null}
        {onZoomIn ? (
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={onZoomOut}
              className={zoomButton}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={onZoomReset}
              className="min-w-[3.25rem] border-x border-border px-1 py-1 text-center text-xs font-medium tabular-nums text-foreground transition hover:bg-background"
            >
              {zoomPercent ?? 100}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={onZoomIn}
              className={zoomButton}
            >
              +
            </button>
          </div>
        ) : null}
        {onToggleHistory ? (
          <button
            type="button"
            onClick={onToggleHistory}
            className={iconButton}
          >
            History
          </button>
        ) : null}
        {showExport && onExport ? (
          <details className="relative">
            <summary
              aria-label="Export"
              className={`${iconButton} flex cursor-pointer list-none items-center gap-1 ${
                exporting ? "opacity-60" : ""
              } [&::-webkit-details-marker]:hidden`}
            >
              {exporting ? "Exporting…" : "Export"} ▾
            </summary>
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-md"
            >
              {(
                [
                  { format: "png", label: "PNG image" },
                  { format: "pdf", label: "PDF document" },
                  { format: "json", label: "JSON snapshot" },
                ] as const
              ).map(({ format, label }) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  disabled={exporting}
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    onExport(format);
                  }}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-background disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          </details>
        ) : null}
        {lockState === "LOCKED_BY_ME" ? (
          <>
            <button
              type="button"
              onClick={onCheckIn}
              disabled={busy || offline}
              title={offline ? "Reconnect to check in" : undefined}
              className="rounded-md border border-transparent bg-foreground px-3 py-1 text-xs font-medium text-surface transition hover:opacity-90 disabled:opacity-60"
            >
              Check In
            </button>
            <button
              type="button"
              onClick={onRelease}
              disabled={busy}
              className="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-60"
            >
              Discard
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
