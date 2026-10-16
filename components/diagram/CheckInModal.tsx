"use client";

import { useState } from "react";
import type { SnapshotType } from "@/lib/types";

export interface CheckInValues {
  message: string;
  tag: string | null;
  snapshotType: SnapshotType;
}

interface CheckInModalProps {
  busy?: boolean;
  onConfirm: (values: CheckInValues) => void;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none focus:border-status-planned";

/** Commit the working state as a version: message (required), tag, snapshot type. */
export function CheckInModal({
  busy = false,
  onConfirm,
  onClose,
}: CheckInModalProps) {
  const [message, setMessage] = useState("");
  const [tag, setTag] = useState("");
  const [snapshotType, setSnapshotType] = useState<SnapshotType>("current");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("A commit message is required.");
      return;
    }
    onConfirm({
      message: message.trim(),
      tag: tag.trim() || null,
      snapshotType,
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
        <h2 className="text-base font-semibold text-foreground">Check in</h2>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">
            Message <span className="text-status-broken">*</span>
          </span>
          <textarea
            value={message}
            rows={3}
            autoFocus
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What changed?"
            className={fieldClass}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Tag</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="optional, e.g. v1.2"
            className={fieldClass}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Snapshot type</span>
          <select
            value={snapshotType}
            onChange={(e) => setSnapshotType(e.target.value as SnapshotType)}
            className={fieldClass}
          >
            <option value="current">Current</option>
            <option value="planned">Planned</option>
          </select>
        </label>

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
            disabled={busy}
            className="rounded-md border border-transparent bg-foreground px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Checking in…" : "Check in"}
          </button>
        </div>
      </form>
    </div>
  );
}
