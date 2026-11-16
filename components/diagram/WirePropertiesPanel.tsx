"use client";

import { useState, type FocusEvent } from "react";
import {
  WIRE_CONSTRUCTIONS,
  wirePropertiesSchema,
  type WireProperties,
} from "@/lib/types";
import { WIRE_CONSTRUCTION_META } from "@/lib/diagram/wireAppearance";

interface Props {
  properties: WireProperties;
  readOnly: boolean;
  endpoints: string;
  onSave: (patch: Partial<WireProperties>) => void;
  onDelete?: () => void;
}
const inputClass =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-status-planned disabled:opacity-60";
const captionClass = "block text-xs font-medium text-muted";
const formatSize = (size: WireProperties["size"]) =>
  size?.unit === "awg" && size.value < 0
    ? `${1 - size.value}/0`
    : String(size?.value ?? "");

/** Save text on blur, so a selection change never cancels a pending timer.
 * Keys follow individual saved values: undo updates inputs without resetting
 * an unrelated field that the user is still typing in.
 */
export function WirePropertiesPanel({
  properties,
  readOnly,
  endpoints,
  onSave,
  onDelete,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState({
    saved: properties.show_label,
    value: properties.show_label,
  });
  // Keep toggles responsive while earlier edits are queued. A changed saved
  // value also synchronizes undo/redo and failed-save rollback without remounting.
  if (visibility.saved !== properties.show_label) {
    setVisibility({
      saved: properties.show_label,
      value: properties.show_label,
    });
  }
  const save = (patch: Partial<WireProperties>, force = false) => {
    if (readOnly) return;
    const parsed = wirePropertiesSchema.safeParse({ ...properties, ...patch });
    if (!parsed.success) {
      setError(
        "length" in patch
          ? "Enter a length greater than zero."
          : "size" in patch
            ? "Enter a positive diameter or a whole AWG number. You can also use 2/0, 3/0, or 4/0."
            : "conductor_count" in patch
              ? "Enter a positive whole number of conductors."
              : "datasheet_url" in patch
                ? "Enter a valid datasheet URL."
                : "Check the wire properties.",
      );
      return;
    }
    setError(null);
    if (
      force ||
      Object.entries(patch).some(
        ([key, value]) =>
          JSON.stringify(properties[key as keyof WireProperties]) !==
          JSON.stringify(value),
      )
    )
      onSave(patch);
  };
  const text = (
    key:
      | "label"
      | "material"
      | "inner_shield_material"
      | "outer_shield_material"
      | "datasheet_url"
      | "notes",
    title: string,
    multiline = false,
  ) => (
    <label className="block space-y-1" key={key}>
      <span className={captionClass}>{title}</span>
      {multiline ? (
        <textarea
          key={properties[key] ?? ""}
          defaultValue={properties[key] ?? ""}
          rows={3}
          disabled={readOnly}
          className={inputClass}
          onBlur={(e) => save({ [key]: e.target.value.trim() || null })}
        />
      ) : (
        <input
          key={properties[key] ?? ""}
          defaultValue={properties[key] ?? ""}
          disabled={readOnly}
          className={inputClass}
          onBlur={(e) => save({ [key]: e.target.value.trim() || null })}
        />
      )}
    </label>
  );
  return (
    <aside
      aria-label="Wire properties"
      className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface"
    >
      <div className="border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">Wire</h2>
        <p className="mt-1 text-xs text-muted">{endpoints}</p>
        {readOnly ? (
          <p className="mt-1 text-xs text-muted">
            Read-only — check out to edit.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">
            Changes save when you leave a field.
          </p>
        )}
      </div>
      <div className="space-y-3 p-4">
        <label className="block space-y-1">
          <span className={captionClass}>Construction</span>
          <select
            aria-label="Construction"
            value={properties.construction}
            disabled={readOnly}
            className={inputClass}
            onChange={(e) =>
              save({
                construction: e.target.value as WireProperties["construction"],
              })
            }
          >
            {WIRE_CONSTRUCTIONS.map((value) => (
              <option key={value} value={value}>
                {WIRE_CONSTRUCTION_META[value].label}
              </option>
            ))}
          </select>
        </label>
        {text("label", "Label")}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={visibility.value}
            disabled={readOnly}
            onChange={(e) => {
              setVisibility({
                saved: properties.show_label,
                value: e.target.checked,
              });
              // A second toggle may cancel a first one that hasn't reached the
              // command queue yet; enqueue both even if the saved value matches.
              save({ show_label: e.target.checked }, true);
            }}
          />
          Show label on diagram
        </label>
        {text("material", "Conductor material")}
        {properties.construction === "coaxial" ||
        properties.construction === "triaxial"
          ? text(
              "inner_shield_material",
              properties.construction === "triaxial"
                ? "Inner shield material"
                : "Shield material",
            )
          : null}
        {properties.construction === "triaxial"
          ? text("outer_shield_material", "Outer shield material")
          : null}
        <Measurement
          key={`length:${JSON.stringify(properties.length)}`}
          title="Length"
          initialValue={String(properties.length?.value ?? "")}
          initialUnit={properties.length?.unit ?? "m"}
          units={[
            ["m", "m"],
            ["cm", "cm"],
            ["mm", "mm"],
          ]}
          readOnly={readOnly}
          onSave={(value, unit) =>
            save({
              length:
                value === ""
                  ? null
                  : { value: Number(value), unit: unit as "m" | "cm" | "mm" },
            })
          }
        />
        <Measurement
          key={`size:${JSON.stringify(properties.size)}`}
          title="Gauge / diameter"
          initialValue={formatSize(properties.size)}
          initialUnit={properties.size?.unit ?? "awg"}
          units={[
            ["awg", "AWG"],
            ["mm", "mm"],
            ["um", "µm"],
          ]}
          readOnly={readOnly}
          onSave={(value, unit) => {
            const zero = /^([234])\/0$/.exec(value);
            const number =
              zero && unit === "awg" ? 1 - Number(zero[1]) : Number(value);
            save({
              size:
                value === ""
                  ? null
                  : { value: number, unit: unit as "awg" | "mm" | "um" },
            });
          }}
        />
        <label className="block space-y-1">
          <span className={captionClass}>Conductor count</span>
          <input
            key={properties.conductor_count ?? ""}
            type="number"
            min={1}
            step={1}
            defaultValue={properties.conductor_count ?? ""}
            disabled={readOnly}
            className={inputClass}
            onBlur={(e) =>
              save({
                conductor_count:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
        {text("datasheet_url", "Datasheet URL")}
        {text("notes", "Notes", true)}
        {error ? (
          <p role="alert" className="text-xs text-status-broken">
            {error}
          </p>
        ) : null}
      </div>
      {onDelete ? (
        <div className="border-t border-border p-4">
          <button
            type="button"
            disabled={readOnly}
            onClick={onDelete}
            className="w-full rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-40"
          >
            Delete wire
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function Measurement({
  title,
  initialValue,
  initialUnit,
  units,
  readOnly,
  onSave,
}: {
  title: string;
  initialValue: string;
  initialUnit: string;
  units: string[][];
  readOnly: boolean;
  onSave: (value: string, unit: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [unit, setUnit] = useState(initialUnit);
  const leave = (event: FocusEvent<HTMLFieldSetElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget))
      onSave(value.trim(), unit);
  };
  return (
    <fieldset className="space-y-1" onBlur={leave} disabled={readOnly}>
      <legend className={captionClass}>{title}</legend>
      <div className="flex gap-2">
        <input
          aria-label={title}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select
          aria-label={`${title} unit`}
          value={unit}
          className={`${inputClass.replace("w-full", "w-20")} shrink-0`}
          onChange={(e) => {
            setUnit(e.target.value);
            if (value.trim()) onSave(value.trim(), e.target.value);
          }}
        >
          {units.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
