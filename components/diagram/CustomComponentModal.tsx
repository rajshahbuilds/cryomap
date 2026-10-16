"use client";

import { useState } from "react";
import type { Port, PortSide } from "@/lib/types";
import { PORT_SIDES } from "@/lib/types";
import type { CustomDefFormValues } from "@/lib/diagram/customDef";

interface CustomComponentModalProps {
  mode: "create" | "edit";
  initial?: CustomDefFormValues;
  onSubmit: (values: CustomDefFormValues) => void;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-status-planned";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-muted">{children}</span>;
}

/** Create or edit a per-fridge custom component definition. */
export function CustomComponentModal({
  mode,
  initial,
  onSubmit,
  onClose,
}: CustomComponentModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [width, setWidth] = useState(String(initial?.width_px ?? 80));
  const [height, setHeight] = useState(String(initial?.height_px ?? 40));
  const [ports, setPorts] = useState<Port[]>(
    initial?.ports ?? [
      { side: "left", index: 0 },
      { side: "right", index: 0 },
    ],
  );
  const [keys, setKeys] = useState<string[]>(initial?.extra_field_keys ?? []);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    onSubmit({
      name: name.trim(),
      width_px: Number(width) || 80,
      height_px: Number(height) || 40,
      ports,
      extra_field_keys: keys.map((k) => k.trim()).filter(Boolean),
    });
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onPointerDown={onClose}
    >
      <form
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[80vh] w-96 space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-foreground">
          {mode === "create" ? "New custom component" : "Edit definition"}
        </h2>

        <label className="block space-y-1">
          <Label>Name</Label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <Label>Width</Label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1">
            <Label>Height</Label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Ports</Label>
            <button
              type="button"
              onClick={() =>
                setPorts((p) => [...p, { side: "left", index: 0 }])
              }
              className="text-xs text-status-planned"
            >
              + Port
            </button>
          </div>
          {ports.map((port, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                aria-label="Port side"
                value={port.side}
                onChange={(e) =>
                  setPorts((p) =>
                    p.map((q, j) =>
                      j === i ? { ...q, side: e.target.value as PortSide } : q,
                    ),
                  )
                }
                className={fieldClass}
              >
                {PORT_SIDES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="number"
                aria-label="Port index"
                value={port.index}
                onChange={(e) =>
                  setPorts((p) =>
                    p.map((q, j) =>
                      j === i
                        ? { ...q, index: Number(e.target.value) || 0 }
                        : q,
                    ),
                  )
                }
                className="w-16 rounded border border-border bg-surface px-2 py-1 text-sm"
              />
              <button
                type="button"
                aria-label="Remove port"
                onClick={() => setPorts((p) => p.filter((_, j) => j !== i))}
                className="text-xs text-muted hover:text-status-broken"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Extra fields</Label>
            <button
              type="button"
              onClick={() => setKeys((k) => [...k, ""])}
              className="text-xs text-status-planned"
            >
              + Field
            </button>
          </div>
          {keys.map((key, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label="Extra field key"
                value={key}
                placeholder="field name"
                onChange={(e) =>
                  setKeys((k) =>
                    k.map((q, j) => (j === i ? e.target.value : q)),
                  )
                }
                className={fieldClass}
              />
              <button
                type="button"
                aria-label="Remove field"
                onClick={() => setKeys((k) => k.filter((_, j) => j !== i))}
                className="text-xs text-muted hover:text-status-broken"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-status-broken">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md border border-transparent bg-foreground px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
