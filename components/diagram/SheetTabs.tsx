"use client";

import { useEffect, useRef, useState } from "react";
import type { Sheet, SheetKind } from "@/lib/types";
import { canDeleteSheet } from "@/lib/diagram/sheetService";

interface SheetTabsProps {
  sheets: Sheet[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Omitted when the user can't edit — the tabs stay navigable, not editable. */
  onAdd?: (kind: SheetKind) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (sheet: Sheet) => void;
}

const tabBase =
  "group relative flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium transition";

const NEW_SHEET_OPTIONS: { kind: SheetKind; label: string; hint: string }[] = [
  {
    kind: "fridge",
    label: "Fridge wiring",
    hint: "Temperature stages and trunk lines",
  },
  {
    kind: "room_temp",
    label: "Room temp wiring",
    hint: "Free-placed bench instrumentation",
  },
];

/**
 * The sheet tab bar: one tab per sheet of the fridge, plus "+" to add one of
 * either kind. A fridge sheet owns its own stages and lines, so a fridge may
 * hold several — an input chain and an output chain, say. The last remaining
 * sheet is never deletable (see `canDeleteSheet`).
 *
 * Double-clicking an editable tab renames it in place.
 */
export function SheetTabs({
  sheets,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: SheetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  // Dismiss the add menu on an outside click or Escape, like the context menu.
  useEffect(() => {
    if (!addOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addOpen]);

  const commitRename = (sheet: Sheet, value: string) => {
    setEditingId(null);
    const name = value.trim();
    if (name && name !== sheet.name) onRename?.(sheet.id, name);
  };

  return (
    <div className="flex items-end gap-1 border-b border-border bg-background px-3 pt-1.5">
      {sheets.map((sheet) => {
        const isActive = sheet.id === activeId;
        const isEditing = sheet.id === editingId;
        return (
          <div
            key={sheet.id}
            className={`${tabBase} ${
              isActive
                ? "border-border bg-surface text-foreground"
                : "border-transparent text-muted hover:bg-surface/60 hover:text-foreground"
            }`}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                defaultValue={sheet.name}
                onBlur={(e) => commitRename(sheet, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    commitRename(sheet, e.currentTarget.value);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-28 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground outline-none"
                aria-label="Sheet name"
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelect(sheet.id)}
                onDoubleClick={() => onRename && setEditingId(sheet.id)}
                aria-current={isActive ? "page" : undefined}
                className="whitespace-nowrap"
              >
                {sheet.name}
              </button>
            )}

            {onDelete && canDeleteSheet(sheet, sheets) && !isEditing ? (
              <button
                type="button"
                onClick={() => onDelete(sheet)}
                aria-label={`Delete sheet ${sheet.name}`}
                title={`Delete "${sheet.name}"`}
                className="rounded px-1 text-muted opacity-0 transition hover:bg-background hover:text-foreground focus:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}

      {onAdd ? (
        <div ref={addRef} className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((open) => !open)}
            aria-label="Add sheet"
            aria-haspopup="menu"
            aria-expanded={addOpen}
            title="Add a sheet"
            className="mb-px shrink-0 rounded px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground"
          >
            ＋
          </button>

          {addOpen ? (
            <div
              role="menu"
              aria-label="New sheet"
              className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
            >
              {NEW_SHEET_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddOpen(false);
                    onAdd(option.kind);
                  }}
                  className="block w-full px-3 py-1.5 text-left transition hover:bg-background"
                >
                  <span className="block text-xs font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
