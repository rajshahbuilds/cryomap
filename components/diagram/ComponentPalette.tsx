import { useState } from "react";
import type { BuiltInComponentType, CustomComponentDef } from "@/lib/types";
import {
  COMPONENT_CATEGORIES,
  componentsByCategory,
} from "@/lib/constants/componentLibrary";
import { ContextMenu } from "./ContextMenu";

export type PaletteSelection =
  | { kind: "builtin"; type: BuiltInComponentType }
  | { kind: "custom"; defId: string };

const CATEGORY_LABEL: Record<(typeof COMPONENT_CATEGORIES)[number], string> = {
  passive: "Passive",
  active: "Active",
  source: "Sources",
  instrument: "Instruments",
  microwave: "Microwave",
  connector: "Connectors",
  io: "Signal I/O",
  fridge: "Fridge",
};

interface ComponentPaletteProps {
  customDefs: CustomComponentDef[];
  disabled?: boolean;
  /** Begin placing the selected component (pointer-down to drag onto canvas). */
  onStartPlace: (selection: PaletteSelection) => void;
  /** Open the modal to define a new custom component. */
  onCreateCustom?: () => void;
  /** Open the modal to edit an existing custom definition. */
  onEditCustom?: (def: CustomComponentDef) => void;
  /** Delete a custom definition (the caller blocks deletion while in use). */
  onDeleteCustom?: (def: CustomComponentDef) => void;
}

const itemClass =
  "w-full cursor-grab rounded-md border border-border bg-surface px-2.5 py-1.5 text-left text-xs text-foreground transition hover:bg-background active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Left palette of placeable components: every built-in grouped by category plus
 * a Custom section. All components are available on every sheet regardless of
 * kind. Pointer-down on an item starts a drag-to-place onto the canvas (handled
 * by the editor). Presentational — gating is the caller's `disabled`.
 */
export function ComponentPalette({
  customDefs,
  disabled = false,
  onStartPlace,
  onCreateCustom,
  onEditCustom,
  onDeleteCustom,
}: ComponentPaletteProps) {
  // The custom def whose ⋯ menu is open, anchored at the button's screen rect.
  const [menu, setMenu] = useState<{
    def: CustomComponentDef;
    x: number;
    y: number;
  } | null>(null);
  const hasCustomMenu = Boolean(onEditCustom || onDeleteCustom);

  return (
    <aside className="h-full w-44 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
      {COMPONENT_CATEGORIES.map((category) => {
        const defs = componentsByCategory(category);
        if (defs.length === 0) return null;
        return (
          <section key={category} className="mb-4">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {CATEGORY_LABEL[category]}
            </h3>
            <div className="space-y-1">
              {defs.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  disabled={disabled}
                  onPointerDown={() =>
                    onStartPlace({ kind: "builtin", type: def.type })
                  }
                  className={itemClass}
                >
                  {def.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <section className="mb-2">
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Custom
        </h3>
        <div className="space-y-1">
          {customDefs.map((def) => (
            <div key={def.id} className="flex items-stretch gap-1">
              <button
                type="button"
                disabled={disabled}
                onPointerDown={() =>
                  onStartPlace({ kind: "custom", defId: def.id })
                }
                className={`${itemClass} min-w-0 flex-1 truncate`}
              >
                {def.name}
              </button>
              {hasCustomMenu ? (
                <button
                  type="button"
                  aria-label={`Edit or delete ${def.name}`}
                  disabled={disabled}
                  // Stop the place-drag from starting; open on click instead.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenu({ def, x: r.left, y: r.bottom + 2 });
                  }}
                  className="shrink-0 rounded-md border border-border bg-surface px-1.5 text-xs text-muted transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⋯
                </button>
              ) : null}
            </div>
          ))}
          {onCreateCustom ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onCreateCustom}
              className="w-full rounded-md border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted transition hover:bg-background disabled:opacity-50"
            >
              + Custom component
            </button>
          ) : null}
        </div>
      </section>

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            ...(onEditCustom
              ? [
                  {
                    label: "Edit",
                    onSelect: () => onEditCustom(menu.def),
                  },
                ]
              : []),
            ...(onDeleteCustom
              ? [
                  {
                    label: "Delete",
                    danger: true,
                    onSelect: () => onDeleteCustom(menu.def),
                  },
                ]
              : []),
          ]}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </aside>
  );
}
