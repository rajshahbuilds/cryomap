"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Component, CustomComponentDef, Fridge, Line } from "@/lib/types";
import { DIRECTIONS, ENTITY_STATUSES, LINE_TYPES } from "@/lib/types";
import { getLineTypeLabel } from "@/lib/constants/lineTypes";
import { getComponentDefinition } from "@/lib/constants/componentLibrary";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";

export type PanelSelection =
  | { kind: "component"; component: Component; def: CustomComponentDef | null }
  | { kind: "line"; line: Line }
  | { kind: "fridge"; fridge: Fridge };

type SelectOption = { value: string; label: string };
type Field =
  | { key: string; label: string; kind: "text" | "url" | "date" | "textarea" }
  | { key: string; label: string; kind: "checkbox" }
  | { key: string; label: string; kind: "select"; options: SelectOption[] };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const statusOptions: SelectOption[] = ENTITY_STATUSES.map((s) => ({
  value: s,
  label: cap(s),
}));

const COMPONENT_FIELDS: Field[] = [
  { key: "label", label: "Label", kind: "text" },
  { key: "value", label: "Value", kind: "text" },
  { key: "manufacturer", label: "Manufacturer", kind: "text" },
  { key: "part_number", label: "Part number", kind: "text" },
  { key: "serial_number", label: "Serial number", kind: "text" },
  { key: "frequency_range", label: "Frequency range", kind: "text" },
  { key: "power_rating", label: "Power rating", kind: "text" },
  { key: "datasheet_url", label: "Datasheet URL", kind: "url" },
  { key: "notes", label: "Notes", kind: "textarea" },
];

const LINE_FIELDS: Field[] = [
  { key: "name", label: "Name", kind: "text" },
  {
    key: "line_type",
    label: "Type",
    kind: "select",
    options: LINE_TYPES.map((t) => ({ value: t, label: getLineTypeLabel(t) })),
  },
  {
    key: "direction",
    label: "Direction",
    kind: "select",
    options: DIRECTIONS.map((d) => ({ value: d, label: cap(d) })),
  },
  { key: "status", label: "Status", kind: "select", options: statusOptions },
  { key: "notes", label: "Notes", kind: "textarea" },
  { key: "show_label", label: "Show label", kind: "checkbox" },
];

const FRIDGE_FIELDS: Field[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "vendor", label: "Vendor", kind: "text" },
  { key: "model", label: "Model", kind: "text" },
  { key: "location", label: "Location", kind: "text" },
  { key: "description", label: "Description", kind: "textarea" },
];

type Values = Record<string, string | boolean>;

/** Custom-component extra fields are namespaced so they collect into a record. */
const EXTRA = "__extra__";

function fieldsFor(selection: PanelSelection, lines: Line[]): Field[] {
  if (selection.kind === "component") {
    const extraKeys = selection.def?.extra_field_keys ?? [];
    // A fridge_port links to a fridge line: a picker over the fridge's
    // lines. The "—" none option (rendered for every select) unlinks it.
    const linkField: Field[] =
      selection.component.component_type === "fridge_port"
        ? [
            {
              key: "linked_line_id",
              label: "Linked fridge line",
              kind: "select",
              options: lines.map((l) => ({ value: l.id, label: l.name })),
            },
          ]
        : [];
    return [
      ...COMPONENT_FIELDS,
      ...linkField,
      ...extraKeys.map(
        (k): Field => ({ key: `${EXTRA}${k}`, label: k, kind: "text" }),
      ),
    ];
  }
  if (selection.kind === "line") return LINE_FIELDS;
  return FRIDGE_FIELDS;
}

function entityFor(selection: PanelSelection): Record<string, unknown> {
  if (selection.kind === "component") return selection.component;
  if (selection.kind === "line") return selection.line;
  return selection.fridge;
}

/** Human-readable type for a component: its built-in label or custom-def name. */
function componentTypeName(
  selection: Extract<PanelSelection, { kind: "component" }>,
): string {
  if (selection.component.component_type === "custom") {
    return selection.def?.name ?? "Custom component";
  }
  return getComponentDefinition(selection.component.component_type).label;
}

function initialValues(
  fields: Field[],
  entity: Record<string, unknown>,
): Values {
  const extra = (entity.extra_fields as Record<string, string>) ?? {};
  const values: Values = {};
  for (const field of fields) {
    if (field.key.startsWith(EXTRA)) {
      values[field.key] = extra[field.key.slice(EXTRA.length)] ?? "";
      continue;
    }
    const raw = entity[field.key];
    values[field.key] =
      field.kind === "checkbox" ? Boolean(raw) : raw == null ? "" : String(raw);
  }
  return values;
}

/** Build the persistence patch (empty → null; extra fields → a record). */
function toPatch(fields: Field[], values: Values): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const extraFields: Record<string, string> = {};
  let hasExtra = false;
  for (const field of fields) {
    if (field.key.startsWith(EXTRA)) {
      extraFields[field.key.slice(EXTRA.length)] = String(
        values[field.key] ?? "",
      );
      hasExtra = true;
      continue;
    }
    const value = values[field.key];
    patch[field.key] =
      field.kind === "checkbox" ? value : value === "" ? null : value;
  }
  if (hasExtra) patch.extra_fields = extraFields;
  return patch;
}

interface PropertiesPanelProps {
  selection: PanelSelection;
  readOnly: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  /** Rotate the selected component 90° (component selections only). */
  onRotate?: () => void;
  /** Mirror (horizontally flip) the selected component. */
  onMirror?: () => void;
  /** The fridge's lines, for a `fridge_port`'s linked-line picker. */
  lines?: Line[];
  /** Extra content below the fields — e.g. a line's traced signal chains. */
  footer?: ReactNode;
}

/**
 * Context-sensitive properties editor (component / line / fridge). Edits update
 * local state immediately and auto-save (debounced) to the live tables.
 * Read-only when the fridge isn't checked out.
 */
export function PropertiesPanel({
  selection,
  readOnly,
  onSave,
  onRotate,
  onMirror,
  lines = [],
  footer,
}: PropertiesPanelProps) {
  const fields = fieldsFor(selection, lines);
  const entity = entityFor(selection);

  // Local state initializes once per mount. The editor remounts this panel
  // (via `key`) when the selected entity changes, so in-progress edits survive
  // background reloads but reset on a new selection.
  const [values, setValues] = useState<Values>(() =>
    initialValues(fields, entity),
  );

  const debouncedSave = useDebouncedCallback((next: Values) => {
    onSave(toPatch(fields, next));
  }, 500);

  // The component's type doubles as the panel title (e.g. "HEMT Amplifier").
  const heading = useMemo(() => {
    if (selection.kind === "component") return componentTypeName(selection);
    if (selection.kind === "line") return "Line";
    return "Fridge";
  }, [selection]);

  const update = (key: string, value: string | boolean) => {
    const next = { ...values, [key]: value };
    setValues(next);
    debouncedSave(next);
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface">
      <div className="border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
        {readOnly ? (
          <p className="mt-0.5 text-xs text-muted">
            Read-only — check out to edit.
          </p>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        {selection.kind === "component" && (onRotate || onMirror) ? (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Orientation</span>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-foreground">
                {selection.component.rotation}°
              </span>
              {onRotate ? (
                <button
                  type="button"
                  onClick={onRotate}
                  disabled={readOnly}
                  aria-label="Rotate 90°"
                  title="Rotate 90° (R)"
                  className="rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-40"
                >
                  ↻ 90°
                </button>
              ) : null}
              {onMirror ? (
                <button
                  type="button"
                  onClick={onMirror}
                  disabled={readOnly}
                  aria-label="Mirror"
                  title="Mirror horizontally (M)"
                  className={`rounded border px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
                    selection.component.mirrored
                      ? "border-status-planned text-status-planned"
                      : "border-border bg-surface text-foreground hover:bg-background"
                  }`}
                >
                  ⇄ Flip
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {fields.map((field) => (
          <label key={field.key} className="block space-y-1">
            {field.kind === "checkbox" ? (
              <span className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={Boolean(values[field.key])}
                  onChange={(e) => update(field.key, e.target.checked)}
                />
                {field.label}
              </span>
            ) : (
              <>
                <span className="text-xs font-medium text-muted">
                  {field.label}
                </span>
                {field.kind === "textarea" ? (
                  <textarea
                    rows={2}
                    disabled={readOnly}
                    value={String(values[field.key] ?? "")}
                    onChange={(e) => update(field.key, e.target.value)}
                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-status-planned disabled:opacity-60"
                  />
                ) : field.kind === "select" ? (
                  <select
                    disabled={readOnly}
                    value={String(values[field.key] ?? "")}
                    onChange={(e) => update(field.key, e.target.value)}
                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground disabled:opacity-60"
                  >
                    <option value="">—</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.kind === "date" ? "date" : "text"}
                    disabled={readOnly}
                    value={String(values[field.key] ?? "")}
                    onChange={(e) => update(field.key, e.target.value)}
                    className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-status-planned disabled:opacity-60"
                  />
                )}
              </>
            )}
          </label>
        ))}

        {selection.kind === "component" &&
        selection.component.last_edited_at ? (
          <p className="pt-1 text-xs text-muted">
            Last edited{" "}
            {new Date(selection.component.last_edited_at).toLocaleString()}
          </p>
        ) : null}

        {footer}
      </div>
    </aside>
  );
}
