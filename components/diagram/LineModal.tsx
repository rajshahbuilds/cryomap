"use client";

import { useState } from "react";
import type { Direction, LineType } from "@/lib/types";
import { DIRECTIONS, LINE_TYPES } from "@/lib/types";
import { getLineTypeLabel } from "@/lib/constants/lineTypes";

export interface LineModalValues {
  name: string;
  lineType: LineType | null;
  direction: Direction | null;
}

interface LineModalProps {
  /** Pre-filled name (e.g. "Line 3"). */
  defaultName: string;
  busy?: boolean;
  onConfirm: (values: LineModalValues) => void;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-status-planned";

const DIRECTION_LABEL: Record<Direction, string> = {
  input: "Input",
  output: "Output",
  bidirectional: "Bidirectional",
};

/**
 * Create a new line: name (required), type, and direction. Mirrors
 * {@link StageModal}; the new line is appended at the end of the bar.
 */
export function LineModal({
  defaultName,
  busy = false,
  onConfirm,
  onClose,
}: LineModalProps) {
  const [name, setName] = useState(defaultName);
  const [lineType, setLineType] = useState<LineType | "">("");
  const [direction, setDirection] = useState<Direction | "">("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("A line name is required.");
      return;
    }
    onConfirm({
      name: name.trim(),
      lineType: lineType || null,
      direction: direction || null,
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
        <h2 className="text-base font-semibold text-foreground">New line</h2>

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

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Type</span>
          <select
            aria-label="Type"
            value={lineType}
            onChange={(e) => setLineType(e.target.value as LineType | "")}
            className={fieldClass}
          >
            <option value="">Untyped</option>
            {LINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {getLineTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Direction</span>
          <select
            aria-label="Direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction | "")}
            className={fieldClass}
          >
            <option value="">Unspecified</option>
            {DIRECTIONS.map((dir) => (
              <option key={dir} value={dir}>
                {DIRECTION_LABEL[dir]}
              </option>
            ))}
          </select>
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
            Create line
          </button>
        </div>
      </form>
    </div>
  );
}
