"use client";

import { useState } from "react";

export interface StageModalValues {
  name: string;
  nominalTemp: string | null;
  color: string | null;
}

interface StageModalProps {
  /** Pre-filled name (e.g. "Stage 3"). */
  defaultName: string;
  busy?: boolean;
  onConfirm: (values: StageModalValues) => void;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-status-planned";

/**
 * Create a new stage: name (required), nominal temperature, and color. The
 * temperature also decides where the stage lands — hotter stages sit on top.
 */
export function StageModal({
  defaultName,
  busy = false,
  onConfirm,
  onClose,
}: StageModalProps) {
  const [name, setName] = useState(defaultName);
  const [temp, setTemp] = useState("");
  const [color, setColor] = useState("#e5e7eb");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("A stage name is required.");
      return;
    }
    onConfirm({
      name: name.trim(),
      nominalTemp: temp.trim() || null,
      color,
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
        className="w-96 space-y-3 rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-foreground">New stage</h2>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">
            Name <span className="text-status-broken">*</span>
          </span>
          <input
            autoFocus
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>

        <div className="space-y-1">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Temperature</span>
            <input
              aria-label="Temperature"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder="e.g. 4 K, ~700 mK"
              className={fieldClass}
            />
          </label>
          <p className="text-[11px] text-muted">
            Positions the stage — hotter stages sit on top.
          </p>
        </div>

        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">Color</span>
          <input
            type="color"
            aria-label="Color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border border-border bg-surface p-0"
          />
        </label>

        {error ? (
          <p role="alert" className="text-xs text-status-broken">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-surface transition hover:opacity-90 disabled:opacity-60"
          >
            Create stage
          </button>
        </div>
      </form>
    </div>
  );
}
